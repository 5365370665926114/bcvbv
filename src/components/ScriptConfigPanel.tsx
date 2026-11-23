import React, { useMemo, useState } from 'react';
import { FileJson, Plus, Search, X } from 'lucide-react';
import {
  SUBTITLE_DELAY_MS,
  VIDEO_FPS,
  formatDisplayWord,
  formatTimecode,
  isRedKeyword,
  normalizeWord,
} from '../remotion/timeline';
import type { EpisodeConfig, TranscriptData } from '../remotion/types';

interface ScriptConfigPanelProps {
  config: EpisodeConfig;
  transcript: TranscriptData;
  currentFrame: number;
  onChangeConfig: (next: EpisodeConfig) => void;
  onSeek: (frame: number) => void;
  onExportConfig?: () => void;
}

export const ScriptConfigPanel: React.FC<ScriptConfigPanelProps> = ({
  config,
  transcript,
  currentFrame,
  onChangeConfig,
  onSeek,
  onExportConfig,
}) => {
  const [newKeyword, setNewKeyword] = useState('');
  const [wordFilter, setWordFilter] = useState('');
  const [onlyRedFilter, setOnlyRedFilter] = useState(false);

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newKeyword.trim().toUpperCase();
    if (!cleaned) return;
    const exists = config.palavras_vermelhas.some(
      (k) => normalizeWord(k) === normalizeWord(cleaned)
    );
    if (!exists) {
      onChangeConfig({
        ...config,
        palavras_vermelhas: [cleaned, ...config.palavras_vermelhas],
      });
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (word: string) => {
    onChangeConfig({
      ...config,
      palavras_vermelhas: config.palavras_vermelhas.filter((w) => w !== word),
    });
  };

  const filteredWords = useMemo(() => {
    const q = normalizeWord(wordFilter);
    return transcript.words.filter((item) => {
      const red = isRedKeyword(item.word, config.palavras_vermelhas);
      if (onlyRedFilter && !red) return false;
      if (!q) return true;
      return normalizeWord(item.word).includes(q);
    });
  }, [transcript.words, wordFilter, onlyRedFilter, config.palavras_vermelhas]);

  return (
    <div className="flex flex-col divide-y divide-white/[0.08]">
      {/* Episode Metadata (config.json) */}
      <section className="p-5 flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-white">
            Metadados do Episódio
          </h2>
          {onExportConfig ? (
            <button
              type="button"
              onClick={onExportConfig}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileJson className="w-3 h-3" aria-hidden="true" />
              Baixar config.json
            </button>
          ) : (
            <span className="text-xs font-mono text-zinc-500">public/config.json</span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 text-xs">
          <label className="flex flex-col gap-1.5">
            <span className="text-zinc-400">Título da Série (00:00–00:03)</span>
            <input
              type="text"
              value={config.serie}
              onChange={(e) => onChangeConfig({ ...config, serie: e.target.value })}
              className="w-full px-3 py-2 rounded-md bg-white/[0.04] border border-white/[0.1] text-white focus:outline-none focus:border-[#DC2626]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-zinc-400">Parte</span>
              <input
                type="text"
                value={config.parte}
                onChange={(e) => onChangeConfig({ ...config, parte: e.target.value })}
                className="w-full px-3 py-2 rounded-md bg-white/[0.04] border border-white/[0.1] text-white focus:outline-none focus:border-[#DC2626]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-zinc-400">Subtítulo (00:03–00:08)</span>
              <input
                type="text"
                value={config.subtitulo}
                onChange={(e) => onChangeConfig({ ...config, subtitulo: e.target.value })}
                className="w-full px-3 py-2 rounded-md bg-white/[0.04] border border-white/[0.1] text-white focus:outline-none focus:border-[#DC2626]"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-zinc-400">Frase de Tese</span>
            <textarea
              rows={2}
              value={config.tese}
              onChange={(e) => onChangeConfig({ ...config, tese: e.target.value })}
              className="w-full px-3 py-2 rounded-md bg-white/[0.04] border border-white/[0.1] text-white focus:outline-none focus:border-[#DC2626] resize-none"
            />
          </label>
        </div>
      </section>

      {/* Red Keywords Manager */}
      <section className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-white">
            Palavras Vermelhas de Impacto
          </h2>
          <span className="text-xs font-mono tabular-nums text-zinc-500">
            {config.palavras_vermelhas.length} ativas
          </span>
        </div>

        <form onSubmit={handleAddKeyword} className="flex items-center gap-2">
          <input
            type="text"
            aria-label="Adicionar palavra vermelha"
            placeholder="Adicionar palavra (ex: PERGAMINHO)"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            className="flex-1 px-3 py-2 text-xs rounded-md bg-white/[0.04] border border-white/[0.1] text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#DC2626]"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md bg-[#DC2626] hover:bg-[#B91C1C] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Adicionar
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
          {config.palavras_vermelhas.map((kw) => (
            <button
              key={kw}
              type="button"
              onClick={() => handleRemoveKeyword(kw)}
              aria-label={`Remover destaque de ${kw}`}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono text-red-300 bg-red-950/50 hover:bg-red-900/60 border border-red-800/60 rounded transition-colors cursor-pointer"
            >
              <span>{kw}</span>
              <X className="w-3 h-3 opacity-70" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      {/* Searchable Word-Level Transcript Table */}
      <section className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-white">
            Sincronia Word-Level (transcript.json)
          </h2>
          <span className="text-xs font-mono tabular-nums text-zinc-500">
            {filteredWords.length} / {transcript.words.length} palavras
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              aria-label="Filtrar palavras na transcrição"
              placeholder="Buscar palavra na narração..."
              value={wordFilter}
              onChange={(e) => setWordFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-white/[0.04] border border-white/[0.1] text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#DC2626]"
            />
          </div>

          <button
            type="button"
            onClick={() => setOnlyRedFilter((v) => !v)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              onlyRedFilter
                ? 'bg-[#DC2626] border-[#DC2626] text-white'
                : 'bg-white/[0.04] border-white/[0.1] text-zinc-300 hover:text-white'
            }`}
          >
            Só Vermelhas
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto border border-white/[0.08] rounded-md divide-y divide-white/[0.06]">
          {filteredWords.slice(0, 180).map((item, idx) => {
            const startFrame = Math.round(((item.startMs + SUBTITLE_DELAY_MS) / 1000) * VIDEO_FPS);
            const isRed = isRedKeyword(item.word, config.palavras_vermelhas);
            const isActive =
              currentFrame >= startFrame &&
              currentFrame <= Math.ceil(((item.endMs + SUBTITLE_DELAY_MS) / 1000) * VIDEO_FPS);

            return (
              <button
                key={`${item.startMs}-${idx}`}
                type="button"
                onClick={() => onSeek(startFrame)}
                className={`w-full px-3 py-2 flex items-center justify-between text-xs transition-colors text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#DC2626]/20 text-white'
                    : 'hover:bg-white/[0.04] text-zinc-300'
                }`}
              >
                <span className={isRed ? 'text-[#FF3B3B] font-semibold' : 'font-medium'}>
                  {formatDisplayWord(item.word)}
                </span>
                <span className="font-mono tabular-nums text-[11px] text-zinc-500">
                  {formatTimecode(startFrame, VIDEO_FPS)} · {item.startMs}ms
                </span>
              </button>
            );
          })}
          {filteredWords.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-500">
              Nenhuma palavra encontrada para o filtro atual.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};
