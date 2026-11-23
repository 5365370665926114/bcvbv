import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUTPUT_PATH = path.join(PUBLIC_DIR, 'desmistificando_ep01_os_evangelhos.mp4');

function detectBrowserExecutable(): string | undefined {
  const candidates = [
    process.env.REMOTION_BROWSER_EXECUTABLE,
    '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return undefined;
}

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'config.json'), 'utf-8'));
  const transcript = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'transcript.json'), 'utf-8'));
  const fps = Number(config.fps) || 30;
  const totalFrames = Math.max(
    Math.ceil((Number(transcript.durationMs) / 1000) * fps),
    Math.ceil(Number(config.duracaoSegundos || 251) * fps)
  );

  const browserExecutable = detectBrowserExecutable();
  console.log(`[Render] Bundling composition (${totalFrames} frames @ ${fps}fps, 1080x1920)...`);
  const t0 = Date.now();

  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'src/remotion/index.ts'),
    publicDir: PUBLIC_DIR,
    webpackOverride: (cfg) => cfg,
  });

  const inputProps = {
    config,
    transcript,
    options: {
      enableParticles: true,
      enableScanlines: true,
      enableChromaticAberration: true,
      characterBlendMode: 'normal' as const,
      muteAudio: false,
    },
  };

  const composition = await selectComposition({
    serveUrl,
    id: 'DesmistificandoEpisode',
    inputProps,
    browserExecutable,
    chromiumOptions: { gl: 'swiftshader' },
  });

  const concurrency = 2;
  console.log(`[Render] Rendering ${totalFrames} frames with concurrency=${concurrency} (x264Preset=ultrafast) -> ${OUTPUT_PATH}`);
  let lastLoggedPct = -10;
  const renderStart = Date.now();

  await renderMedia({
    composition: {
      ...composition,
      durationInFrames: totalFrames,
      fps,
    },
    serveUrl,
    codec: 'h264',
    x264Preset: 'ultrafast',
    pixelFormat: 'yuv420p',
    audioCodec: 'aac',
    audioBitrate: '192k',
    crf: 20,
    imageFormat: 'jpeg',
    jpegQuality: 90,
    outputLocation: OUTPUT_PATH,
    inputProps,
    browserExecutable,
    chromiumOptions: { gl: 'swiftshader' },
    concurrency,
    onProgress: ({ progress, renderedFrames, encodedFrames, stitchStage }) => {
      const pct = Math.floor(progress * 100);
      if (pct >= lastLoggedPct + 10 || pct === 100) {
        lastLoggedPct = pct;
        const elapsed = ((Date.now() - renderStart) / 1000).toFixed(1);
        console.log(
          `[Render] ${pct}% | rendered=${renderedFrames}/${totalFrames} | encoded=${encodedFrames} | stage=${stitchStage} | ${elapsed}s`
        );
      }
    },
  });

  const stat = fs.statSync(OUTPUT_PATH);
  const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `[OK] MP4 concluido em ${totalSec}s -> ${OUTPUT_PATH} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`
  );
}

main().catch((err) => {
  console.error('[Render Failed]', err);
  process.exit(1);
});
