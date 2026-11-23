import React from 'react';
import { Upload } from 'lucide-react';
import type { EpisodeConfig, MainVideoProps } from '../remotion/types';

type AssetOverrideKey = keyof NonNullable<MainVideoProps['assetOverrides']>;

interface AssetsPanelProps {
  config: EpisodeConfig;
  assetOverrides: NonNullable<MainVideoProps['assetOverrides']>;
  onUploadOverride: (key: AssetOverrideKey, url: string) => void;
  onResetOverrides: () => void;
}

export const AssetsPanel: React.FC<AssetsPanelProps> = ({
  config,
  assetOverrides,
  onUploadOverride,
  onResetOverrides,
}) => {
  const handleFileChange = (key: AssetOverrideKey, file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    onUploadOverride(key, url);
  };

  const hasOverrides = Object.keys(assetOverrides).length > 0;

  const imageAssets: ReadonlyArray<{
    key: AssetOverrideKey;
    label: string;
    file: string;
    role: string;
  }> = [
    { key: 'personagem', label: 'Personagem 2.5D', file: config.assets.personagem, role: 'Camada 2 · Contorno Neon' },
    { key: 'fundo1', label: 'Fundo 01', file: config.assets.fundos[0], role: 'Whip Pan + Loop 1.0s' },
    { key: 'fundo2', label: 'Fundo 02', file: config.assets.fundos[1], role: 'Whip Pan + Loop 1.0s' },
    { key: 'fundo3', label: 'Fundo 03', file: config.assets.fundos[2], role: 'Whip Pan + Loop 1.0s' },
  ];

  const audioAssets: ReadonlyArray<{
    key: AssetOverrideKey;
    label: string;
    file: string;
    spec: string;
  }> = [
    { key: 'narracao', label: 'Narração ElevenLabs', file: config.assets.narracao, spec: 'Volume fixo 1.0 (0dB)' },
    { key: 'trilha', label: 'Trilha Sonora', file: config.assets.trilha, spec: 'Ducking: 0.26 -> 0.62 -> 0.14' },
    { key: 'subBass', label: 'SFX Sub-Bass', file: config.assets.subBass, spec: '00:00, 00:02.3 e 00:04.0 (Abertura)' },
  ];

  return (
    <div className="flex flex-col divide-y divide-white/[0.08]">
      <section className="p-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-white">Assets de /public</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Arquivos reais carregados dinamicamente pela composição Remotion.
          </p>
        </div>
        {hasOverrides ? (
          <button
            type="button"
            onClick={onResetOverrides}
            className="px-2.5 py-1.5 text-xs font-medium text-zinc-200 bg-white/[0.06] hover:bg-white/[0.12] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Restaurar padrão
          </button>
        ) : null}
      </section>

      {/* Visual Assets Grid */}
      <section className="p-5 flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-zinc-300">Camadas Visuais</h3>
        <div className="grid grid-cols-2 gap-3">
          {imageAssets.map((item) => {
            const src = assetOverrides[item.key] || `/${item.file}`;
            return (
              <div
                key={item.key}
                className="flex flex-col gap-2 border border-white/[0.08] rounded-md p-2.5 bg-white/[0.02]"
              >
                <div className="relative h-28 w-full rounded bg-black overflow-hidden flex items-center justify-center">
                  <img
                    src={src}
                    alt={item.label}
                    referrerPolicy="no-referrer"
                    className={
                      item.key === 'personagem'
                        ? 'h-full w-auto object-contain'
                        : 'h-full w-full object-cover'
                    }
                  />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white truncate">{item.label}</div>
                    <div className="text-[11px] font-mono text-zinc-500 truncate">{item.file}</div>
                  </div>
                  <label
                    title={`Substituir ${item.file}`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 shrink-0 cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => handleFileChange(item.key, e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Audio Assets List */}
      <section className="p-5 flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-zinc-300">Trilhas e Efeitos Sonoros</h3>
        <div className="flex flex-col gap-3">
          {audioAssets.map((item) => {
            const src = assetOverrides[item.key] || `/${item.file}`;
            return (
              <div
                key={item.key}
                className="flex flex-col gap-2 border border-white/[0.08] rounded-md p-3 bg-white/[0.02]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white">{item.label}</div>
                    <div className="text-[11px] font-mono text-zinc-500">
                      {item.file} · {item.spec}
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-zinc-200 bg-white/[0.06] hover:bg-white/[0.12] rounded cursor-pointer transition-colors whitespace-nowrap shrink-0">
                    <Upload className="w-3 h-3" aria-hidden="true" />
                    Trocar
                    <input
                      type="file"
                      accept="audio/*"
                      className="sr-only"
                      onChange={(e) => handleFileChange(item.key, e.target.files?.[0])}
                    />
                  </label>
                </div>
                <audio controls preload="none" src={src} className="w-full h-8 opacity-90" />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
