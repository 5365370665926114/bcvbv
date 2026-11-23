import React from 'react';
import { Check, Download, Loader2, X } from 'lucide-react';
import { formatFileSize } from '../utils/renderCacheKey';

export type StudioTab = 'preview' | 'script' | 'assets' | 'pipeline';

export interface Mp4ButtonState {
  status: 'idle' | 'bundling' | 'rendering' | 'encoding' | 'done' | 'error' | 'cancelled';
  progress: number;
  fileSizeBytes: number | null;
  cached: boolean;
  isSubmitting: boolean;
}

interface StudioHeaderProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  mp4State: Mp4ButtonState;
  onDownloadMp4: () => void;
  onCancelMp4: () => void;
}

const NAV_ITEMS: ReadonlyArray<{ id: StudioTab; label: string }> = [
  { id: 'preview', label: 'Preview' },
  { id: 'script', label: 'Roteiro' },
  { id: 'assets', label: 'Assets' },
  { id: 'pipeline', label: 'Pipeline' },
];

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  activeTab,
  onSelectTab,
  mp4State,
  onDownloadMp4,
  onCancelMp4,
}) => {
  const isWorking =
    mp4State.isSubmitting ||
    mp4State.status === 'bundling' ||
    mp4State.status === 'rendering' ||
    mp4State.status === 'encoding';
  const isDone = mp4State.status === 'done' && !mp4State.isSubmitting;
  const pct = Math.max(0, Math.min(100, Math.round(mp4State.progress * 100)));
  const fillScale = isWorking
    ? Math.max(0.06, Math.min(1, mp4State.progress || (mp4State.status === 'bundling' ? 0.08 : 0.06)))
    : 0;

  let buttonLabel = 'Baixar MP4';
  if (mp4State.isSubmitting || mp4State.status === 'bundling') {
    buttonLabel = 'Preparando MP4...';
  } else if (mp4State.status === 'rendering') {
    buttonLabel = `Gerando MP4 · ${pct}%`;
  } else if (mp4State.status === 'encoding') {
    buttonLabel = `Finalizando · ${Math.max(96, pct)}%`;
  } else if (isDone) {
    buttonLabel = mp4State.fileSizeBytes
      ? `MP4 Baixado · ${formatFileSize(mp4State.fileSizeBytes)}`
      : 'MP4 Baixado';
  }

  return (
    <header className="h-14 shrink-0 border-b border-white/[0.08] bg-[#0C0C0F] px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Single text element brand wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onSelectTab('preview');
        }}
        className="font-display text-[15px] font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626] rounded"
      >
        Desmistificando Studio
      </a>

      {/* Zone 2: 4 clean single-line text navigation tabs */}
      <nav aria-label="Navegação do estúdio" className="flex items-center gap-6 h-full">
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative h-full flex items-center text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:text-white ${
                active ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {item.label}
              {active ? (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#DC2626]" />
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single direct fast 1080x1920 MP4 download button */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onDownloadMp4}
          disabled={isWorking}
          aria-live="polite"
          aria-busy={isWorking}
          data-testid="download-mp4-btn"
          className={`relative overflow-hidden inline-flex items-center justify-center gap-2 h-9 px-4 text-xs font-semibold text-white rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
            isWorking
              ? 'bg-zinc-800 border border-white/[0.12] cursor-wait min-w-[168px]'
              : isDone
                ? 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer'
                : 'bg-[#DC2626] hover:bg-[#B91C1C] cursor-pointer'
          }`}
        >
          {/* Compositor-only progress bar fill inside button */}
          {isWorking ? (
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-[#DC2626] origin-left transition-transform duration-300 ease-out"
              style={{ transform: `scaleX(${fillScale})` }}
            />
          ) : null}

          <span className="relative z-10 inline-flex items-center gap-2 font-mono tabular-nums">
            {isWorking ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
            ) : isDone ? (
              <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="font-sans">{buttonLabel}</span>
          </span>
        </button>

        {isWorking ? (
          <button
            type="button"
            onClick={onCancelMp4}
            aria-label="Cancelar geração do MP4"
            title="Cancelar geração do MP4"
            className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </header>
  );
};
