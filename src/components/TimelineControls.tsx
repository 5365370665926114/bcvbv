import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  BODY_START,
  INTRO_PART1_END,
  VIDEO_FPS,
  WHIP_PAN_START,
  formatTimecode,
  getPhaseAtFrame,
} from '../remotion/timeline';

interface TimelineControlsProps {
  currentFrame: number;
  totalFrames: number;
  isPlaying: boolean;
  isMuted: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onSeek: (frame: number) => void;
  onStep: (delta: number) => void;
}

const PHASE_MARKERS = [
  { id: 'intro_part1', label: '00:00 Abertura', frame: 0 },
  { id: 'intro_part2', label: '00:04 Tese', frame: INTRO_PART1_END + 6 },
  { id: 'whip_pan', label: '00:09 Whip Pan', frame: WHIP_PAN_START + 2 },
  { id: 'body', label: '00:13 Corpo', frame: BODY_START + 7 },
] as const;

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  currentFrame,
  totalFrames,
  isPlaying,
  isMuted,
  onTogglePlay,
  onToggleMute,
  onSeek,
  onStep,
}) => {
  const activePhase = getPhaseAtFrame(currentFrame);
  const progressPct = totalFrames > 0 ? Math.min(100, (currentFrame / totalFrames) * 100) : 0;

  return (
    <div className="w-full border-t border-white/[0.08] bg-[#0E0E12] px-5 py-3.5 flex flex-col gap-3">
      {/* Quick-jump phase buttons + Transport controls + Timecode */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pausar reprodução' : 'Iniciar reprodução'}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => onStep(-1)}
            aria-label="Voltar 1 frame"
            title="Voltar 1 frame"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onStep(1)}
            aria-label="Avançar 1 frame"
            title="Avançar 1 frame"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onSeek(0)}
            aria-label="Reiniciar no frame 0"
            title="Voltar ao início"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Ativar áudio' : 'Silenciar áudio'}
            title={isMuted ? 'Ativar áudio' : 'Silenciar áudio'}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer ${
              isMuted
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className="ml-2 font-mono tabular-nums text-xs text-zinc-200 tracking-tight whitespace-nowrap">
            <span className="text-white font-semibold">{formatTimecode(currentFrame, VIDEO_FPS)}</span>
            <span className="text-zinc-500 mx-1.5">/</span>
            <span className="text-zinc-400">{formatTimecode(totalFrames, VIDEO_FPS)}</span>
            <span className="text-zinc-500 ml-2">F{currentFrame}</span>
          </div>
        </div>

        {/* Phase Jump Controls */}
        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-md">
          {PHASE_MARKERS.map((marker) => {
            const active = activePhase === marker.id;
            return (
              <button
                key={marker.id}
                type="button"
                onClick={() => onSeek(marker.frame)}
                className={`px-2.5 py-1.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#DC2626] text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                {marker.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Scrubber with Phase Map */}
      <div className="flex flex-col gap-1.5">
        <div className="relative h-6 flex items-center">
          {/* Background track showing phase segments */}
          <div className="absolute inset-x-0 h-2 rounded-full bg-zinc-800 overflow-hidden flex pointer-events-none">
            <div
              className="h-full bg-zinc-600/80"
              style={{ width: `${(INTRO_PART1_END / totalFrames) * 100}%` }}
            />
            <div
              className="h-full bg-red-900/90"
              style={{ width: `${((WHIP_PAN_START - INTRO_PART1_END) / totalFrames) * 100}%` }}
            />
            <div
              className="h-full bg-red-500/85"
              style={{ width: `${((BODY_START - WHIP_PAN_START) / totalFrames) * 100}%` }}
            />
            <div className="h-full flex-1 bg-zinc-700/70" />
          </div>

          {/* Active progress fill */}
          <div
            className="absolute left-0 h-2 rounded-l-full bg-[#DC2626] pointer-events-none"
            style={{ width: `${progressPct}%` }}
          />

          <input
            type="range"
            aria-label="Linha do tempo do vídeo"
            min={0}
            max={Math.max(1, totalFrames - 1)}
            value={currentFrame}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="relative z-10 w-full h-6 opacity-0 cursor-pointer"
          />

          {/* Custom Playhead Marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#DC2626] shadow pointer-events-none"
            style={{ left: `${progressPct}%` }}
          />
        </div>

        {/* Audio ducking legend */}
        <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono tabular-nums">
          <span>Trilha (02:56→07:08): 00:00 (-11.7dB) · 00:09 Drop (-4.2dB) · 00:13.5 Duck (-17.1dB) · Fade 2s</span>
          <span>1080×1920 · 30fps · H.264</span>
        </div>
      </div>
    </div>
  );
};
