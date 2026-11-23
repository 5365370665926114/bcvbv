import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import {
  GENERATE_SFX_PY_SNIPPET,
  PROJECT_TREE,
  TERMINAL_COMMANDS,
  TRANSCRIBE_PY_SNIPPET,
} from '../data/pipelineTemplates';
import type { EpisodeConfig } from '../remotion/types';

interface PipelinePanelProps {
  config: EpisodeConfig;
}

type CodeViewId = 'commands' | 'transcribe' | 'sfx' | 'config' | 'tree';

export const PipelinePanel: React.FC<PipelinePanelProps> = ({ config }) => {
  const [selectedView, setSelectedView] = useState<CodeViewId>('commands');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      // Clipboard blocked in sandboxed iframe
    }
  };

  const tabs: ReadonlyArray<{ id: CodeViewId; label: string }> = [
    { id: 'commands', label: 'Terminal' },
    { id: 'transcribe', label: 'transcribe.py' },
    { id: 'sfx', label: 'generate_sfx.py' },
    { id: 'config', label: 'config.json' },
    { id: 'tree', label: 'Estrutura' },
  ];

  const configJsonText = JSON.stringify(config, null, 2);

  return (
    <div className="flex flex-col divide-y divide-white/[0.08]">
      <section className="p-5 flex flex-col gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-white">
            Pipeline Remotion + Python + FFmpeg
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Todos os scripts e componentes estão salvos prontos para renderização 1080×1920 30fps H.264.
          </p>
        </div>

        {/* Single-line sub-tabs */}
        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-md overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedView(tab.id)}
              className={`px-2 py-1.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedView === tab.id
                  ? 'bg-[#DC2626] text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {selectedView === 'commands' ? (
        <section className="p-5 flex flex-col gap-4">
          {[
            {
              key: 'node',
              title: '01. Instalar dependências Remotion (Node.js)',
              code: TERMINAL_COMMANDS.installNode,
            },
            {
              key: 'python',
              title: '02. Instalar WhisperX / Faster-Whisper + SciPy (Python)',
              code: TERMINAL_COMMANDS.installPython,
            },
            {
              key: 'prep',
              title: '03. Gerar SFX procedurais e transcript.json word-level',
              code: TERMINAL_COMMANDS.runPipeline,
            },
            {
              key: 'render',
              title: '04. Renderizar MP4 final 1080×1920 H.264',
              code: TERMINAL_COMMANDS.renderMp4,
            },
          ].map((block) => (
            <div key={block.key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-200">{block.title}</span>
                <button
                  type="button"
                  onClick={() => copyText(block.key, block.code)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] rounded transition-colors cursor-pointer"
                >
                  {copiedKey === block.key ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 rounded-md bg-black border border-white/[0.08] text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                <code>{block.code}</code>
              </pre>
            </div>
          ))}
        </section>
      ) : null}

      {selectedView === 'transcribe' ? (
        <section className="p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-300">scripts/transcribe.py</span>
            <button
              type="button"
              onClick={() => copyText('transcribe', TRANSCRIBE_PY_SNIPPET)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-300 hover:text-white bg-white/[0.05] rounded cursor-pointer"
            >
              {copiedKey === 'transcribe' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copiedKey === 'transcribe' ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <pre className="p-3 rounded-md bg-black border border-white/[0.08] text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed max-h-[520px]">
            <code>{TRANSCRIBE_PY_SNIPPET}</code>
          </pre>
        </section>
      ) : null}

      {selectedView === 'sfx' ? (
        <section className="p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-300">scripts/generate_sfx.py</span>
            <button
              type="button"
              onClick={() => copyText('sfx', GENERATE_SFX_PY_SNIPPET)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-300 hover:text-white bg-white/[0.05] rounded cursor-pointer"
            >
              {copiedKey === 'sfx' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copiedKey === 'sfx' ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <pre className="p-3 rounded-md bg-black border border-white/[0.08] text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed max-h-[520px]">
            <code>{GENERATE_SFX_PY_SNIPPET}</code>
          </pre>
        </section>
      ) : null}

      {selectedView === 'config' ? (
        <section className="p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-300">public/config.json (ao vivo)</span>
            <button
              type="button"
              onClick={() => copyText('config', configJsonText)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-300 hover:text-white bg-white/[0.05] rounded cursor-pointer"
            >
              {copiedKey === 'config' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copiedKey === 'config' ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <pre className="p-3 rounded-md bg-black border border-white/[0.08] text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed max-h-[520px]">
            <code>{configJsonText}</code>
          </pre>
        </section>
      ) : null}

      {selectedView === 'tree' ? (
        <section className="p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-300">Arquitetura de Diretórios</span>
            <button
              type="button"
              onClick={() => copyText('tree', PROJECT_TREE)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-300 hover:text-white bg-white/[0.05] rounded cursor-pointer"
            >
              {copiedKey === 'tree' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copiedKey === 'tree' ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <pre className="p-3 rounded-md bg-black border border-white/[0.08] text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed max-h-[520px]">
            <code>{PROJECT_TREE}</code>
          </pre>
        </section>
      ) : null}
    </div>
  );
};
