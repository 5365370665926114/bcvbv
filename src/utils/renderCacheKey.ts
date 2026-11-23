import type { EpisodeConfig, RenderOptions, TranscriptData } from '../remotion/types';

export interface RenderCacheDescriptor {
  config: EpisodeConfig;
  transcript: TranscriptData;
  options: RenderOptions;
  resolution: '1080p' | '720p';
  startFrame: number;
  endFrame: number;
  crf: number;
  preset: string;
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const v = obj[key];
      if (v !== undefined) {
        sorted[key] = sortDeep(v);
      }
    }
    return sorted;
  }
  return value;
}

/**
 * Serializes render inputs into a canonical deterministic JSON string so
 * identical episode parameters always resolve to the exact same cache hash.
 */
export function canonicalizeRenderPayload(descriptor: RenderCacheDescriptor): string {
  return JSON.stringify(
    sortDeep({
      version: 2,
      config: descriptor.config,
      transcript: {
        audioFile: descriptor.transcript.audioFile,
        durationMs: descriptor.transcript.durationMs,
        words: descriptor.transcript.words,
      },
      options: {
        enableParticles: Boolean(descriptor.options.enableParticles),
        enableScanlines: Boolean(descriptor.options.enableScanlines),
        enableChromaticAberration: Boolean(descriptor.options.enableChromaticAberration),
        characterBlendMode:
          descriptor.options.characterBlendMode === 'lighten' ? 'lighten' : 'normal',
        muteAudio: Boolean(descriptor.options.muteAudio),
      },
      resolution: descriptor.resolution,
      startFrame: descriptor.startFrame,
      endFrame: descriptor.endFrame,
      crf: descriptor.crf,
      preset: descriptor.preset,
    })
  );
}

/**
 * Formats byte size into a compact tabular string (KB / MB).
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Formats remaining render seconds into a compact human-readable ETA.
 */
export function formatEta(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec) || sec < 0) {
    return 'calculando';
  }
  const rounded = Math.round(sec);
  const mins = Math.floor(rounded / 60);
  const rem = rounded % 60;
  return mins > 0 ? `${mins}m${String(rem).padStart(2, '0')}s` : `${rem}s`;
}
