import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { AssetsPanel } from './components/AssetsPanel';
import { PipelinePanel } from './components/PipelinePanel';
import { PreviewInspector } from './components/PreviewInspector';
import { ScriptConfigPanel } from './components/ScriptConfigPanel';
import { StudioHeader, type Mp4ButtonState, type StudioTab } from './components/StudioHeader';
import { TimelineControls } from './components/TimelineControls';
import { MainVideo } from './remotion/MainVideo';
import { DEFAULT_EPISODE_CONFIG, DEFAULT_TRANSCRIPT } from './remotion/Root';
import {
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  computeTotalFrames,
  getPhaseAtFrame,
} from './remotion/timeline';
import type {
  EpisodeConfig,
  MainVideoProps,
  RenderOptions,
  TranscriptData,
} from './remotion/types';

interface RenderJobPayload {
  id: string;
  cacheKey: string;
  cached: boolean;
  status: 'bundling' | 'rendering' | 'encoding' | 'done' | 'error' | 'cancelled';
  progress: number;
  renderedFrames: number;
  encodedFrames: number;
  totalFrames: number;
  elapsedSec: number;
  etaSec: number | null;
  fileSizeBytes: number | null;
  filename: string;
  resolution: '1080p' | '720p';
  error: string | null;
  downloadUrl: string | null;
}

function triggerFileDownload(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export default function App() {
  const playerRef = useRef<PlayerRef>(null);
  const downloadedJobsRef = useRef<Set<string>>(new Set());
  const doneResetTimerRef = useRef<number | null>(null);

  const [activeTab, setActiveTab] = useState<StudioTab>('preview');
  const [config, setConfig] = useState<EpisodeConfig>(DEFAULT_EPISODE_CONFIG);
  const [transcript, setTranscript] = useState<TranscriptData>(DEFAULT_TRANSCRIPT);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [renderJob, setRenderJob] = useState<RenderJobPayload | null>(null);
  const [isSubmittingRender, setIsSubmittingRender] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const [options, setOptions] = useState<RenderOptions>({
    enableParticles: true,
    enableScanlines: true,
    enableChromaticAberration: true,
    characterBlendMode: 'normal',
    muteAudio: false,
  });

  const [assetOverrides, setAssetOverrides] = useState<
    NonNullable<MainVideoProps['assetOverrides']>
  >({});

  // Load real /config.json, /transcript.json, and reconnect to any active server render
  useEffect(() => {
    let active = true;
    async function loadEpisodeData() {
      try {
        const [cfgRes, trRes] = await Promise.all([
          fetch('/config.json'),
          fetch('/transcript.json'),
        ]);
        if (!cfgRes.ok || !trRes.ok) {
          throw new Error('Falha ao carregar config.json ou transcript.json de /public.');
        }
        const [cfgJson, trJson] = (await Promise.all([
          cfgRes.json(),
          trRes.json(),
        ])) as [EpisodeConfig, TranscriptData];
        if (!active) return;
        setConfig(cfgJson);
        setTranscript(trJson);
        setLoadError(null);
      } catch (err) {
        if (!active) return;
        setLoadError(
          err instanceof Error ? err.message : 'Erro desconhecido ao carregar arquivos de mídia.'
        );
      } finally {
        if (active) setIsLoadingData(false);
      }
    }
    loadEpisodeData();

    fetch('/api/render/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.activeJob) {
          const job = data.activeJob as RenderJobPayload;
          if (
            job.status === 'bundling' ||
            job.status === 'rendering' ||
            job.status === 'encoding'
          ) {
            setRenderJob(job);
          }
        }
      })
      .catch(() => {
        // Ignore optional status reconnect error
      });

    return () => {
      active = false;
      if (doneResetTimerRef.current !== null) {
        window.clearTimeout(doneResetTimerRef.current);
      }
    };
  }, []);

  const totalFrames = useMemo(
    () => computeTotalFrames(config, transcript.durationMs),
    [config, transcript.durationMs]
  );

  // Helper: trigger browser download exactly once when a render job reaches done
  const handleCompletedJob = useCallback((job: RenderJobPayload) => {
    if (job.status !== 'done' || !job.downloadUrl) return;
    if (!downloadedJobsRef.current.has(job.id)) {
      downloadedJobsRef.current.add(job.id);
      triggerFileDownload(job.downloadUrl, job.filename);
    }
    if (doneResetTimerRef.current !== null) {
      window.clearTimeout(doneResetTimerRef.current);
    }
    doneResetTimerRef.current = window.setTimeout(() => {
      setRenderJob((prev) => (prev && prev.id === job.id && prev.status === 'done' ? null : prev));
    }, 5000);
  }, []);

  const isRenderActive =
    renderJob !== null &&
    (renderJob.status === 'bundling' ||
      renderJob.status === 'rendering' ||
      renderJob.status === 'encoding');

  // Poll live render progress while active (800ms) and auto-download at 100%
  useEffect(() => {
    if (!renderJob || !isRenderActive) return;
    const jobId = renderJob.id;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/render/${jobId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { job: RenderJobPayload };
        setRenderJob(data.job);
        if (data.job.status === 'done') {
          handleCompletedJob(data.job);
        } else if (data.job.status === 'error') {
          setRenderError(data.job.error || 'Falha ao gerar o vídeo MP4.');
        }
      } catch {
        // Keep polling gracefully on transient hiccups
      }
    }, 800);
    return () => window.clearInterval(timer);
  }, [renderJob, isRenderActive, handleCompletedJob]);

  // Single-click fast 1080x1920 ultrafast MP4 render & auto-download
  const handleDownloadMp4 = useCallback(async () => {
    if (isSubmittingRender || isRenderActive) return;
    setRenderError(null);
    setIsSubmittingRender(true);
    try {
      const totalSec = Math.ceil(totalFrames / VIDEO_FPS);
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          transcript,
          options,
          startSec: 0,
          endSec: totalSec,
          resolution: '1080p',
          crf: 20,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRenderError(data.error || 'Falha ao iniciar o download do MP4.');
        if (data.job) setRenderJob(data.job);
        return;
      }
      const nextJob = data.job as RenderJobPayload;
      setRenderJob(nextJob);
      if (nextJob.status === 'done') {
        handleCompletedJob(nextJob);
      }
    } catch (err) {
      setRenderError(
        err instanceof Error ? err.message : 'Erro de conexão com o servidor de renderização.'
      );
    } finally {
      setIsSubmittingRender(false);
    }
  }, [
    isSubmittingRender,
    isRenderActive,
    totalFrames,
    config,
    transcript,
    options,
    handleCompletedJob,
  ]);

  const handleCancelMp4 = useCallback(async () => {
    if (!renderJob) return;
    try {
      await fetch(`/api/render/${renderJob.id}/cancel`, { method: 'POST' });
    } catch {
      // Ignore cancel transport error
    } finally {
      setRenderJob(null);
      setIsSubmittingRender(false);
    }
  }, [renderJob]);

  // Sync Remotion Player frame & play state into Studio controls (throttled while playing for 30fps smoothness)
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    let lastHudUpdate = 0;

    const handleFrameUpdate = (e: { detail: { frame: number } }) => {
      const now = performance.now();
      if (!player.isPlaying() || now - lastHudUpdate >= 100) {
        lastHudUpdate = now;
        setCurrentFrame(e.detail.frame);
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => {
      setIsPlaying(false);
      setCurrentFrame(player.getCurrentFrame());
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentFrame(player.getCurrentFrame());
    };

    player.addEventListener('frameupdate', handleFrameUpdate);
    player.addEventListener('play', handlePlay);
    player.addEventListener('pause', handlePause);
    player.addEventListener('ended', handleEnded);

    return () => {
      player.removeEventListener('frameupdate', handleFrameUpdate);
      player.removeEventListener('play', handlePlay);
      player.removeEventListener('pause', handlePause);
      player.removeEventListener('ended', handleEnded);
    };
  }, [isLoadingData]);

  const handleSeek = useCallback(
    (targetFrame: number) => {
      const clamped = Math.max(0, Math.min(totalFrames - 1, Math.round(targetFrame)));
      playerRef.current?.seekTo(clamped);
      setCurrentFrame(clamped);
    },
    [totalFrames]
  );

  const handleStep = useCallback(
    (delta: number) => {
      playerRef.current?.pause();
      handleSeek(currentFrame + delta);
    },
    [currentFrame, handleSeek]
  );

  const handleTogglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) {
      player.pause();
    } else {
      player.play();
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    setOptions((prev) => ({ ...prev, muteAudio: !prev.muteAudio }));
  }, []);

  const handleExportConfig = useCallback(() => {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    triggerFileDownload(url, `config-ep0${config.episodio || 1}.json`);
    URL.revokeObjectURL(url);
  }, [config]);

  const inputProps = useMemo<MainVideoProps>(
    () => ({
      config,
      transcript,
      options,
      assetOverrides,
    }),
    [config, transcript, options, assetOverrides]
  );

  const mp4State = useMemo<Mp4ButtonState>(
    () => ({
      status: renderJob?.status ?? 'idle',
      progress: renderJob?.progress ?? 0,
      fileSizeBytes: renderJob?.fileSizeBytes ?? null,
      cached: Boolean(renderJob?.cached),
      isSubmitting: isSubmittingRender,
    }),
    [renderJob, isSubmittingRender]
  );

  const currentPhase = getPhaseAtFrame(currentFrame);

  return (
    <div
      className="h-screen w-screen overflow-hidden flex flex-col bg-[#09090B] text-[#F4F4F5]"
      data-phase={currentPhase}
      data-frame={currentFrame}
    >
      <StudioHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        mp4State={mp4State}
        onDownloadMp4={handleDownloadMp4}
        onCancelMp4={handleCancelMp4}
      />

      {loadError ? (
        <div
          role="alert"
          className="px-6 py-2.5 bg-red-950/70 border-b border-red-800/70 text-xs text-red-200 flex items-center justify-between"
        >
          <span>{loadError}</span>
        </div>
      ) : null}

      {renderError ? (
        <div
          role="alert"
          className="px-6 py-2.5 bg-red-950/80 border-b border-red-800/70 text-xs text-red-100 flex items-center justify-between gap-4"
        >
          <span className="truncate">{renderError}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadMp4}
              className="px-2.5 py-1 rounded bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => setRenderError(null)}
              className="px-2 py-1 rounded text-red-200 hover:text-white text-[11px] transition-colors cursor-pointer whitespace-nowrap"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}

      {/* Main Split Broadcast Studio Workspace */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Left/Center Stage: Live 9:16 Vertical Remotion Player + Transport Timeline */}
        <section
          aria-label="Palco de pré-visualização 9:16"
          className="flex-1 min-w-0 min-h-0 flex flex-col bg-[#09090B]"
        >
          {/* Quiet contextual metadata row (zero pills, zero duplicate CTA buttons) */}
          <div className="px-6 py-2.5 border-b border-white/[0.06] flex items-center justify-between gap-4 text-xs text-zinc-400">
            <div className="flex items-center gap-2 min-w-0 truncate">
              <span className="text-zinc-200 font-medium truncate">
                Episódio 0{config.episodio}: {config.subtitulo}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{config.serie}</span>
            </div>
            <div className="font-mono tabular-nums text-[11px] text-zinc-500 whitespace-nowrap shrink-0">
              {transcript.wordCount} palavras sincronizadas · {Math.round(totalFrames / VIDEO_FPS)}s · 1080×1920
            </div>
          </div>

          {/* Centered 9:16 Remotion Viewport */}
          <div
            data-testid="remotion-stage"
            className="flex-1 min-h-0 flex items-center justify-center p-4 lg:p-6 overflow-hidden bg-[radial-gradient(circle_at_50%_40%,rgba(220,38,38,0.07),rgba(9,9,11,0)_62%)]"
          >
            {isLoadingData ? (
              <div className="aspect-[9/16] h-full max-h-[660px] rounded-lg border border-white/[0.08] bg-[#111114] animate-pulse flex items-center justify-center text-xs text-zinc-500">
                Carregando composição Remotion...
              </div>
            ) : (
              <div className="relative h-full max-h-[680px] aspect-[9/16] rounded-lg overflow-hidden border border-white/[0.12] bg-black shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
                <Player
                  ref={playerRef}
                  component={MainVideo}
                  inputProps={inputProps}
                  durationInFrames={totalFrames}
                  compositionWidth={VIDEO_WIDTH}
                  compositionHeight={VIDEO_HEIGHT}
                  fps={VIDEO_FPS}
                  style={{ width: '100%', height: '100%' }}
                  controls={false}
                  clickToPlay
                  loop
                  acknowledgeRemotionLicense
                />
              </div>
            )}
          </div>

          <TimelineControls
            currentFrame={currentFrame}
            totalFrames={totalFrames}
            isPlaying={isPlaying}
            isMuted={options.muteAudio}
            onTogglePlay={handleTogglePlay}
            onToggleMute={handleToggleMute}
            onSeek={handleSeek}
            onStep={handleStep}
          />
        </section>

        {/* Right Contextual Inspector Panel */}
        <aside
          aria-label="Painel de inspeção e pipeline"
          className="w-full lg:w-[440px] xl:w-[480px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/[0.08] bg-[#0F0F13] overflow-y-auto"
        >
          {activeTab === 'preview' ? (
            <PreviewInspector
              config={config}
              transcript={transcript}
              currentFrame={currentFrame}
              totalFrames={totalFrames}
              options={options}
              onChangeOptions={setOptions}
              onSeek={handleSeek}
            />
          ) : null}

          {activeTab === 'script' ? (
            <ScriptConfigPanel
              config={config}
              transcript={transcript}
              currentFrame={currentFrame}
              onChangeConfig={setConfig}
              onSeek={handleSeek}
              onExportConfig={handleExportConfig}
            />
          ) : null}

          {activeTab === 'assets' ? (
            <AssetsPanel
              config={config}
              assetOverrides={assetOverrides}
              onUploadOverride={(key, url) =>
                setAssetOverrides((prev) => ({ ...prev, [key]: url }))
              }
              onResetOverrides={() => setAssetOverrides({})}
            />
          ) : null}

          {activeTab === 'pipeline' ? <PipelinePanel config={config} /> : null}
        </aside>
      </main>
    </div>
  );
}
