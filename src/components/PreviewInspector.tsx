import React, { useMemo } from 'react';
import {
  BODY_START,
  SUBTITLE_DELAY_MS,
  VIDEO_FPS,
  formatDisplayWord,
  formatTimecode,
  getActiveWordAtFrame,
  getMusicVolumeAtFrame,
  getPhaseAtFrame,
  getPhaseLabel,
  isRedKeyword,
  linearToDb,
} from '../remotion/timeline';
import type { EpisodeConfig, RenderOptions, TranscriptData } from '../remotion/types';

interface PreviewInspectorProps {
  config: EpisodeConfig;
  transcript: TranscriptData;
  currentFrame: number;
  totalFrames: number;
  options: RenderOptions;
  onChangeOptions: (next: RenderOptions) => void;
  onSeek: (frame: number) => void;
}

export const PreviewInspector: React.FC<PreviewInspectorProps> = ({
  config,
  transcript,
  currentFrame,
  totalFrames,
  options,
  onChangeOptions,
  onSeek,
}) => {
  const phase = getPhaseAtFrame(currentFrame);
  const musicGain = getMusicVolumeAtFrame(currentFrame, totalFrames, VIDEO_FPS);
  const musicDb = linearToDb(musicGain);
  const activeWord =
    currentFrame >= BODY_START
      ? getActiveWordAtFrame(transcript.words, currentFrame, VIDEO_FPS, config.palavras_vermelhas)
      : null;

  // First 14 red-word impact moments in Phase 3 for 1-click verification
  const redMoments = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ label: string; frame: number }> = [];
    for (const w of transcript.words) {
      const f = Math.round(((w.startMs + SUBTITLE_DELAY_MS) / 1000) * VIDEO_FPS);
      if (f < BODY_START) continue;
      if (!isRedKeyword(w.word, config.palavras_vermelhas)) continue;
      const display = formatDisplayWord(w.word);
      if (seen.has(display)) continue;
      seen.add(display);
      list.push({ label: display, frame: f });
      if (list.length >= 14) break;
    }
    return list;
  }, [transcript.words, config.palavras_vermelhas]);

  return (
    <div className="flex flex-col divide-y divide-white/[0.08]">
      {/* Current Frame State */}
      <section className="p-5 flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold text-white">Estado da Cena</h2>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-zinc-500 mb-1">Fase ativa</div>
            <div className="text-zinc-100 font-medium">{getPhaseLabel(phase)}</div>
          </div>
          <div>
            <div className="text-zinc-500 mb-1">Palavra no balão</div>
            <div
              className={`font-mono font-semibold ${
                activeWord?.isRed ? 'text-[#FF2424]' : 'text-zinc-100'
              }`}
            >
              {activeWord
                ? `${formatDisplayWord(activeWord.word.word)}${activeWord.isRed ? ' (IMPACTO)' : ''}`
                : currentFrame < BODY_START
                  ? 'Aguardando 00:13.5'
                  : 'Pausa de fala'}
            </div>
          </div>
        </div>
      </section>

      {/* Automated Audio Engineering Meters */}
      <section className="p-5 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-white">Engenharia de Áudio</h2>
          <span className="text-xs text-zinc-500 font-mono tabular-nums">Auto-Ducking</span>
        </div>

        <div className="flex flex-col gap-3 text-xs">
          {/* Narration track */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between font-mono tabular-nums">
              <span className="text-zinc-300">narracao.mp3 (Voz)</span>
              <span className="text-zinc-400">1.00 · 0.0 dB</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-zinc-200 transition-all duration-150"
                style={{ width: options.muteAudio ? '0%' : '100%' }}
              />
            </div>
          </div>

          {/* Music track with live ducking gain */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between font-mono tabular-nums">
              <span className="text-zinc-300">trilha.mp3 (Little Dark Age)</span>
              <span className={musicGain >= 0.45 ? 'text-[#FF3B3B] font-semibold' : 'text-zinc-400'}>
                {musicGain.toFixed(2)} · {musicDb > -59 ? `${musicDb} dB` : '-∞ dB'}
              </span>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#DC2626] transition-all duration-150"
                style={{ width: options.muteAudio ? '0%' : `${Math.min(100, musicGain * 100)}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] text-zinc-500 leading-relaxed">
            SFX sincronizados: <span className="text-zinc-300 font-mono">sub_bass.mp3</span> (00:00, 00:02.3, 00:04.0) · Sincronia acústica <span className="text-zinc-300 font-mono">0ms (104 cláusulas)</span>
          </div>
        </div>
      </section>

      {/* Visual Shader & Layer Toggles */}
      <section className="p-5 flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold text-white">Camadas e Shaders</h2>

        <div className="flex flex-col gap-2.5 text-xs">
          <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-zinc-300">Partículas de brasa e névoa global</span>
            <input
              type="checkbox"
              checked={options.enableParticles}
              onChange={(e) =>
                onChangeOptions({ ...options, enableParticles: e.target.checked })
              }
              className="accent-[#DC2626] w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-zinc-300">Aberração cromática RGB (Whip Pan)</span>
            <input
              type="checkbox"
              checked={options.enableChromaticAberration}
              onChange={(e) =>
                onChangeOptions({
                  ...options,
                  enableChromaticAberration: e.target.checked,
                })
              }
              className="accent-[#DC2626] w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-zinc-300">Film grain e scanlines (Fase 2)</span>
            <input
              type="checkbox"
              checked={options.enableScanlines}
              onChange={(e) =>
                onChangeOptions({ ...options, enableScanlines: e.target.checked })
              }
              className="accent-[#DC2626] w-4 h-4 cursor-pointer"
            />
          </label>

          <div className="flex items-center justify-between pt-1">
            <span className="text-zinc-300">Blend do personagem</span>
            <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded">
              <button
                type="button"
                onClick={() =>
                  onChangeOptions({ ...options, characterBlendMode: 'normal' })
                }
                className={`px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer ${
                  options.characterBlendMode === 'normal'
                    ? 'bg-zinc-200 text-black font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Alpha + Rim
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeOptions({ ...options, characterBlendMode: 'lighten' })
                }
                className={`px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer ${
                  options.characterBlendMode === 'lighten'
                    ? 'bg-zinc-200 text-black font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Lighten
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Word Quick Jump List */}
      <section className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-white">
            Saltos de Impacto (Palavras Vermelhas)
          </h2>
          <span className="text-xs text-zinc-500 font-mono tabular-nums">
            {redMoments.length} destaques
          </span>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Clique para ir direto ao frame em que a palavra ativa o brilho vermelho, pulso suave contínuo no avatar e vibração isolada no fundo.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {redMoments.map((item) => (
            <button
              key={`${item.label}-${item.frame}`}
              type="button"
              onClick={() => onSeek(item.frame)}
              className="flex items-center justify-between px-2.5 py-1.5 text-left rounded bg-white/[0.03] hover:bg-[#DC2626]/20 border border-white/[0.06] hover:border-[#DC2626]/50 transition-colors cursor-pointer"
            >
              <span className="text-xs font-medium text-zinc-100 truncate">{item.label}</span>
              <span className="text-[11px] font-mono tabular-nums text-zinc-500 ml-2 shrink-0">
                {formatTimecode(item.frame, VIDEO_FPS).slice(0, 5)}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
