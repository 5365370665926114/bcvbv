import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { bundle } from '@remotion/bundler';
import {
  makeCancelSignal,
  renderMedia,
  selectComposition,
} from '@remotion/renderer';
import { createServer as createViteServer } from 'vite';
import { canonicalizeRenderPayload } from './src/utils/renderCacheKey';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const RENDER_OUT_DIR = path.join(os.tmpdir(), 'desmistificando-renders');
const RENDER_CACHE_DIR = path.join(RENDER_OUT_DIR, 'cache');
fs.mkdirSync(RENDER_CACHE_DIR, { recursive: true });

// Keep container memory stable under Cloud Run limits while maximizing speed
const SAFE_RENDER_CONCURRENCY = 2;
const FAST_X264_PRESET = 'ultrafast' as const;
const DEFAULT_FAST_CRF = 20;

interface RenderJob {
  id: string;
  cacheKey: string;
  cached: boolean;
  status: 'bundling' | 'rendering' | 'encoding' | 'done' | 'error' | 'cancelled';
  progress: number;
  renderedFrames: number;
  encodedFrames: number;
  totalFrames: number;
  startedAt: number;
  finishedAt?: number;
  etaSec: number | null;
  fileSizeBytes: number | null;
  filename: string;
  outputPath: string;
  resolution: '1080p' | '720p';
  cancelled: boolean;
  error?: string;
  cancel?: () => void;
}

const jobs = new Map<string, RenderJob>();
let activeJobId: string | null = null;
let cachedServeUrl: string | null = null;
let bundlePromise: Promise<string> | null = null;

function detectBrowserExecutable(): string | undefined {
  const candidates = [
    process.env.REMOTION_BROWSER_EXECUTABLE,
    '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

async function getBundledServeUrl(): Promise<string> {
  if (cachedServeUrl && fs.existsSync(cachedServeUrl)) {
    return cachedServeUrl;
  }
  if (!bundlePromise) {
    const entryPoint = path.resolve(__dirname, 'src/remotion/index.ts');
    const publicDir = path.resolve(__dirname, 'public');
    bundlePromise = bundle({
      entryPoint,
      publicDir,
      webpackOverride: (config) => config,
    })
      .then((url) => {
        cachedServeUrl = url;
        return url;
      })
      .catch((err) => {
        bundlePromise = null;
        throw err;
      });
  }
  return bundlePromise;
}

function sanitizeJobId(raw: string): string | null {
  return /^[a-f0-9-]{8,64}$/i.test(raw) ? raw : null;
}

function sanitizeCacheKey(raw: string): string | null {
  return /^[a-f0-9]{16,64}$/i.test(raw) ? raw : null;
}

function getCacheFilePath(cacheKey: string): string {
  return path.join(RENDER_CACHE_DIR, `${cacheKey}.mp4`);
}

function serializeJob(job: RenderJob) {
  const now = job.finishedAt ?? Date.now();
  const downloadUrl =
    job.status === 'done'
      ? job.cached
        ? `/api/render/cache/${job.cacheKey}/download?filename=${encodeURIComponent(job.filename)}`
        : `/api/render/${job.id}/download`
      : null;

  return {
    id: job.id,
    cacheKey: job.cacheKey,
    cached: job.cached,
    status: job.status,
    progress: job.progress,
    renderedFrames: job.renderedFrames,
    encodedFrames: job.encodedFrames,
    totalFrames: job.totalFrames,
    elapsedSec: Math.max(0, Math.round((now - job.startedAt) / 1000)),
    etaSec: job.etaSec,
    fileSizeBytes: job.fileSizeBytes,
    filename: job.filename,
    resolution: job.resolution,
    error: job.error ?? null,
    downloadUrl,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Health, bundle readiness, and active job reconnection
  app.get('/api/render/status', (_req, res) => {
    const activeJob = activeJobId ? jobs.get(activeJobId) ?? null : null;
    res.json({
      ready: true,
      browserDetected: Boolean(detectBrowserExecutable()),
      bundleCached: Boolean(cachedServeUrl),
      activeJob: activeJob ? serializeJob(activeJob) : null,
    });
  });

  // Trigger fast 1080x1920 ultrafast MP4 render OR return instant disk cache hit
  app.post('/api/render', async (req, res) => {
    try {
      if (activeJobId) {
        const running = jobs.get(activeJobId);
        if (
          running &&
          (running.status === 'bundling' ||
            running.status === 'rendering' ||
            running.status === 'encoding')
        ) {
          res.status(200).json({ job: serializeJob(running) });
          return;
        }
      }

      const body = req.body ?? {};
      const config = body.config;
      const transcript = body.transcript;
      const rawOptions = body.options ?? {};

      if (!config || !transcript || !Array.isArray(transcript.words)) {
        res.status(400).json({
          error: 'Configuração do episódio ou transcrição inválida para renderização.',
        });
        return;
      }

      const options = {
        enableParticles: rawOptions.enableParticles ?? true,
        enableScanlines: rawOptions.enableScanlines ?? true,
        enableChromaticAberration: rawOptions.enableChromaticAberration ?? true,
        characterBlendMode:
          rawOptions.characterBlendMode === 'lighten' ? ('lighten' as const) : ('normal' as const),
        muteAudio: Boolean(rawOptions.muteAudio),
      };

      const fps = Number(config.fps) > 0 ? Number(config.fps) : 30;
      const durationMs =
        Number(transcript.durationMs) || Number(config.duracaoSegundos || 251) * 1000;
      const maxFrames = Math.max(
        90,
        Math.ceil((durationMs / 1000) * fps),
        Math.ceil(Number(config.duracaoSegundos || 0) * fps)
      );

      const rawStartSec = Number(body.startSec ?? 0);
      const rawEndSec = Number(body.endSec ?? maxFrames / fps);
      if (!Number.isFinite(rawStartSec) || !Number.isFinite(rawEndSec) || rawEndSec <= rawStartSec) {
        res.status(400).json({ error: 'Intervalo de tempo inválido para exportação.' });
        return;
      }

      const startFrame = Math.max(0, Math.min(maxFrames - 2, Math.floor(rawStartSec * fps)));
      const endFrame = Math.max(
        startFrame + 1,
        Math.min(maxFrames - 1, Math.ceil(rawEndSec * fps) - 1)
      );
      const totalFrames = endFrame - startFrame + 1;

      const resolution: '1080p' | '720p' = body.resolution === '720p' ? '720p' : '1080p';
      const crfRaw = Number(body.crf ?? DEFAULT_FAST_CRF);
      const crf = Number.isFinite(crfRaw)
        ? Math.max(16, Math.min(28, Math.round(crfRaw)))
        : DEFAULT_FAST_CRF;

      const canonical = canonicalizeRenderPayload({
        config,
        transcript,
        options,
        resolution,
        startFrame,
        endFrame,
        crf,
        preset: FAST_X264_PRESET,
      });
      const cacheKey = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 24);
      const cachePath = getCacheFilePath(cacheKey);

      const epNum = String(Number(config.episodio) || 1).padStart(2, '0');
      const rangeTag =
        startFrame === 0 && endFrame >= maxFrames - 2
          ? 'completo'
          : `${Math.round(rawStartSec)}s-${Math.round(rawEndSec)}s`;
      const filename = `desmistificando_ep${epNum}_${resolution}_${rangeTag}.mp4`;

      // Instant SHA-256 disk cache hit (< 10ms)
      if (fs.existsSync(cachePath)) {
        const stat = fs.statSync(cachePath);
        if (stat.size >= 50_000) {
          const hitJob: RenderJob = {
            id: crypto.randomUUID(),
            cacheKey,
            cached: true,
            status: 'done',
            progress: 1,
            renderedFrames: totalFrames,
            encodedFrames: totalFrames,
            totalFrames,
            startedAt: Date.now(),
            finishedAt: Date.now(),
            etaSec: 0,
            fileSizeBytes: stat.size,
            filename,
            outputPath: cachePath,
            resolution,
            cancelled: false,
          };
          jobs.set(hitJob.id, hitJob);
          res.status(200).json({ job: serializeJob(hitJob) });
          return;
        }
      }

      const jobId = crypto.randomUUID();
      const tempOutputPath = path.join(RENDER_OUT_DIR, `${jobId}.tmp.mp4`);
      const { cancelSignal, cancel } = makeCancelSignal();

      const job: RenderJob = {
        id: jobId,
        cacheKey,
        cached: false,
        status: 'bundling',
        progress: 0,
        renderedFrames: 0,
        encodedFrames: 0,
        totalFrames,
        startedAt: Date.now(),
        etaSec: null,
        fileSizeBytes: null,
        filename,
        outputPath: tempOutputPath,
        resolution,
        cancelled: false,
        cancel,
      };

      jobs.set(jobId, job);
      activeJobId = jobId;

      res.status(202).json({ job: serializeJob(job) });

      void (async () => {
        try {
          const browserExecutable = detectBrowserExecutable();
          const serveUrl = await getBundledServeUrl();

          if (job.cancelled) {
            return;
          }

          job.status = 'rendering';
          const inputProps = { config, transcript, options };

          const composition = await selectComposition({
            serveUrl,
            id: 'DesmistificandoEpisode',
            inputProps,
            browserExecutable,
            chromiumOptions: {
              gl: 'swiftshader',
            },
          });

          const scale = resolution === '720p' ? 2 / 3 : 1;
          const renderStartedAt = Date.now();

          await renderMedia({
            composition: {
              ...composition,
              durationInFrames: maxFrames,
              fps,
            },
            serveUrl,
            codec: 'h264',
            x264Preset: FAST_X264_PRESET,
            pixelFormat: 'yuv420p',
            audioCodec: 'aac',
            audioBitrate: '192k',
            crf,
            imageFormat: 'jpeg',
            jpegQuality: 90,
            scale,
            frameRange: [startFrame, endFrame],
            outputLocation: tempOutputPath,
            inputProps,
            browserExecutable,
            chromiumOptions: {
              gl: 'swiftshader',
            },
            concurrency: SAFE_RENDER_CONCURRENCY,
            cancelSignal,
            onProgress: ({ progress, renderedFrames, encodedFrames, stitchStage }) => {
              if (job.cancelled) return;
              job.progress = Number(Math.max(0, Math.min(1, progress)).toFixed(4));
              job.renderedFrames = renderedFrames;
              job.encodedFrames = encodedFrames;
              job.status = stitchStage === 'muxing' || progress > 0.96 ? 'encoding' : 'rendering';

              const elapsed = (Date.now() - renderStartedAt) / 1000;
              if (progress > 0.02 && elapsed > 1) {
                const estTotal = elapsed / progress;
                job.etaSec = Math.max(1, Math.round(estTotal - elapsed));
              }
            },
          });

          if (job.cancelled) {
            if (fs.existsSync(tempOutputPath)) {
              fs.unlinkSync(tempOutputPath);
            }
            return;
          }

          // Atomically promote completed render into SHA-256 disk cache
          fs.renameSync(tempOutputPath, cachePath);
          const stat = fs.statSync(cachePath);
          job.outputPath = cachePath;
          job.status = 'done';
          job.progress = 1;
          job.renderedFrames = totalFrames;
          job.encodedFrames = totalFrames;
          job.etaSec = 0;
          job.fileSizeBytes = stat.size;
          job.finishedAt = Date.now();
        } catch (err) {
          if (fs.existsSync(tempOutputPath)) {
            try {
              fs.unlinkSync(tempOutputPath);
            } catch {
              // Ignore temp file cleanup error
            }
          }
          if (job.cancelled) {
            return;
          }
          job.status = 'error';
          job.finishedAt = Date.now();
          job.error = err instanceof Error ? err.message : 'Erro desconhecido ao renderizar MP4.';
          console.error('[MP4 Render Error]', err);
        } finally {
          if (activeJobId === jobId) {
            activeJobId = null;
          }
        }
      })();
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro interno ao iniciar renderização.',
      });
    }
  });

  // Poll render progress
  app.get('/api/render/:jobId', (req, res) => {
    const jobId = sanitizeJobId(req.params.jobId);
    if (!jobId) {
      res.status(400).json({ error: 'ID de renderização inválido.' });
      return;
    }
    const job = jobs.get(jobId);
    if (!job) {
      res.status(404).json({ error: 'Trabalho de renderização não encontrado.' });
      return;
    }
    res.json({ job: serializeJob(job) });
  });

  // Cancel active render
  app.post('/api/render/:jobId/cancel', (req, res) => {
    const jobId = sanitizeJobId(req.params.jobId);
    if (!jobId) {
      res.status(400).json({ error: 'ID de renderização inválido.' });
      return;
    }
    const job = jobs.get(jobId);
    if (!job) {
      res.status(404).json({ error: 'Trabalho de renderização não encontrado.' });
      return;
    }
    job.cancelled = true;
    job.status = 'cancelled';
    job.finishedAt = Date.now();
    try {
      job.cancel?.();
    } catch {
      // Ignore cancel cleanup errors
    }
    if (activeJobId === jobId) {
      activeJobId = null;
    }
    res.json({ job: serializeJob(job) });
  });

  // Stream finished MP4 by jobId
  app.get('/api/render/:jobId/download', (req, res) => {
    const jobId = sanitizeJobId(req.params.jobId);
    if (!jobId) {
      res.status(400).json({ error: 'ID de renderização inválido.' });
      return;
    }
    const job = jobs.get(jobId);
    if (!job || job.status !== 'done' || !fs.existsSync(job.outputPath)) {
      res.status(404).json({ error: 'Arquivo MP4 ainda não disponível.' });
      return;
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
    const stat = fs.statSync(job.outputPath);
    res.setHeader('Content-Length', String(stat.size));
    fs.createReadStream(job.outputPath).pipe(res);
  });

  // Stream cached MP4 by SHA-256 hash
  app.get('/api/render/cache/:cacheKey/download', (req, res) => {
    const cacheKey = sanitizeCacheKey(req.params.cacheKey);
    if (!cacheKey) {
      res.status(400).json({ error: 'Chave de cache inválida.' });
      return;
    }
    const cachePath = getCacheFilePath(cacheKey);
    if (!fs.existsSync(cachePath)) {
      res.status(404).json({ error: 'Arquivo MP4 em cache não encontrado.' });
      return;
    }

    const rawName = typeof req.query.filename === 'string' ? req.query.filename : '';
    const safeName = /^[a-z0-9._-]+\.mp4$/i.test(rawName)
      ? rawName
      : 'desmistificando_ep01_1080p_completo.mp4';

    const stat = fs.statSync(cachePath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Content-Length', String(stat.size));
    fs.createReadStream(cachePath).pipe(res);
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');

  if (isProd && fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Desmistificando Studio] Server listening on http://0.0.0.0:${PORT}`);
    // Pre-warm Remotion webpack bundle in background (no Chromium launched) so first click starts faster
    void getBundledServeUrl().catch((err) => {
      console.warn('[Remotion Bundle Pre-warm skipped]', err instanceof Error ? err.message : err);
    });
  });
}

startServer().catch((err) => {
  console.error('Failed to start Desmistificando Studio server:', err);
  process.exit(1);
});
