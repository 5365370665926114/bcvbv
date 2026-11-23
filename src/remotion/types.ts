export interface EpisodeAssets {
  narracao: string;
  trilha: string;
  personagem: string;
  fundos: [string, string, string];
  whoosh: string;
  subBass: string;
}

export interface EpisodeConfig {
  serie: string;
  parte: string;
  subtitulo: string;
  tese: string;
  episodio: number;
  fps: number;
  largura: number;
  altura: number;
  duracaoSegundos: number;
  assets: EpisodeAssets;
  palavras_vermelhas: string[];
}

export interface TranscriptWord {
  word: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

export interface TranscriptData {
  audioFile: string;
  language: string;
  engine: string;
  fps: number;
  durationMs: number;
  totalFrames: number;
  wordCount: number;
  words: TranscriptWord[];
}

export interface RenderOptions {
  enableParticles: boolean;
  enableScanlines: boolean;
  enableChromaticAberration: boolean;
  characterBlendMode: 'normal' | 'lighten';
  muteAudio: boolean;
}

export type MainVideoProps = {
  config: EpisodeConfig;
  transcript: TranscriptData;
  options?: RenderOptions;
  /** Optional browser object-URL overrides for live testing in the web studio */
  assetOverrides?: Partial<{
    narracao: string;
    trilha: string;
    personagem: string;
    fundo1: string;
    fundo2: string;
    fundo3: string;
    whoosh: string;
    subBass: string;
  }>;
};

export type VideoPhaseId = 'intro_part1' | 'intro_part2' | 'whip_pan' | 'body';
