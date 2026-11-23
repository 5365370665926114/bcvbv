import type { EpisodeConfig, TranscriptWord, VideoPhaseId } from './types';

export const VIDEO_FPS = 30;
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;

// Exact VAD-synced timeline boundaries locked to narracao.mp3 (30fps)
// 00:00.0–00:04.0 -> "Desmistificando religiões." (0.00s) + "Parte um." (2.33s)
// 00:04.0–00:09.0 -> "Os Evangelhos." (4.21s) + "Quando a tradição fala mais alto que os manuscritos." (6.13s–8.78s)
// 00:09.0–00:13.5 -> Hyper-fast 9-cut Whip Pan Drop + "Abre o olho para a história." (10.15s–11.78s)
// 00:13.5–04:11.0 -> Phase 3 Body ("Você já parou..." starts at 13.73s / frame 412)
export const INTRO_PART1_START = 0; // 00:00.0
export const INTRO_PART1_SUB_ENTER = 68; // 00:02.27 ("Parte um")
export const INTRO_PART1_END = 120; // 00:04.0
export const INTRO_PART2_START = 120; // 00:04.0
export const INTRO_PART2_THESIS_START = 182; // 00:06.07 ("Quando a tradição...")
export const INTRO_PART2_END = 270; // 00:09.0
export const WHIP_PAN_START = 270; // 00:09.0
export const WHIP_PAN_END = 405; // 00:13.5
export const BODY_START = 405; // 00:13.5

// Hyper-fast Whip Pan montage cadence in Phase 2 (9 cuts x 15 frames = 135 frames = 4.5s)
export const WHIP_CUT_DURATION = 15; // 0.5s exact per flash cut (equal to fast viral reference!)
export const WHIP_CUT_COUNT = 9;
export const WHIP_CHROMATIC_FRAMES = 6;

// Rapid repeating background loop cadence in Phase 3 (1.0s per cut, repeating continuously)
export const BG_SLIDE_DURATION = 30; // 1.0s at 30fps
export const BG_CROSSFADE_FRAMES = 4;

// Fade out duration for soundtrack at the end of the episode
export const OUTRO_FADE_FRAMES = 60; // 2.0s smooth cinematic fade at 30fps

// Impact envelope durations on red words
export const IMPACT_SHAKE_FRAMES = 4;
export const RED_ENVELOPE_FRAMES = 20;

// Exact acoustic onset sync (0ms offset — zero artificial lag)
export const SUBTITLE_DELAY_MS = 0;

export interface ActiveWordState {
  word: TranscriptWord;
  index: number;
  isRed: boolean;
  startFrame: number;
  endFrame: number;
  framesSinceStart: number;
}

export interface RedImpactEnvelope {
  intensity: number; // 0.0 -> 1.0 -> 0.0 C1-continuous, never snaps
  framesSinceHit: number;
  isActive: boolean;
}

export interface KenBurnsTransform {
  mode: 'zoom-in' | 'pan-lateral' | 'zoom-out';
  scale: number;
  translateX: number;
  translateY: number;
}

/**
 * Normaliza uma palavra removendo pontuacao externa e acentos para comparacao
 * deterministica com o array `palavras_vermelhas`.
 */
export function normalizeWord(raw: string): string {
  return raw
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

/**
 * Remove pontuacao de exibicao apenas das bordas mantendo acentos, ? e ! em caixa alta.
 */
export function formatDisplayWord(raw: string): string {
  return raw
    .trim()
    .replace(/^["""'«(\[]+|["""'»)\],.;:]+$/g, '')
    .toUpperCase();
}

/**
 * Verifica se a palavra falada pertence a lista de destaque vermelho.
 */
export function isRedKeyword(word: string, redKeywords: readonly string[]): boolean {
  const normalized = normalizeWord(word);
  if (!normalized) {
    return false;
  }
  for (let i = 0; i < redKeywords.length; i++) {
    if (normalizeWord(redKeywords[i]) === normalized) {
      return true;
    }
  }
  return false;
}

/**
 * Retorna a fase atual do video para um determinado frame.
 */
export function getPhaseAtFrame(frame: number): VideoPhaseId {
  if (frame < INTRO_PART1_END) {
    return 'intro_part1';
  }
  if (frame < INTRO_PART2_END) {
    return 'intro_part2';
  }
  if (frame < WHIP_PAN_END) {
    return 'whip_pan';
  }
  return 'body';
}

export function getPhaseLabel(phase: VideoPhaseId): string {
  switch (phase) {
    case 'intro_part1':
      return 'Fase 1A · Abertura Cinética (00:00–00:04)';
    case 'intro_part2':
      return 'Fase 1B · Tese Sincronizada (00:04–00:09)';
    case 'whip_pan':
      return 'Fase 2 · Whip Pan 9 Cortes (00:09–00:13.5)';
    case 'body':
      return 'Fase 3 · Narração 4 Camadas (00:13.5+)';
  }
}

/**
 * Encontra a palavra ativa em `transcript.words` para o frame atual usando
 * amostragem no ponto medio do frame ((frame + 0.5) / fps) para erro medio 0ms
 * em 30fps (precisao +/-16.7ms sem atraso de quantizacao).
 * Retorna null se nenhuma palavra estiver ativa naquele instante.
 */
export function getActiveWordAtFrame(
  words: readonly TranscriptWord[],
  frame: number,
  fps: number = VIDEO_FPS,
  redKeywords: readonly string[] = [],
  delayMs: number = SUBTITLE_DELAY_MS
): ActiveWordState | null {
  const currentMs = ((frame + 0.5) / fps) * 1000 - delayMs;
  if (currentMs < 0) {
    return null;
  }

  let lo = 0;
  let hi = words.length - 1;
  let candidateIndex = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const item = words[mid];
    if (currentMs >= item.startMs && currentMs <= item.endMs) {
      candidateIndex = mid;
      break;
    }
    if (currentMs < item.startMs) {
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  // Ponte curta de 65ms apenas para oclusivas intra-clausula (sem segurar palavras em pausas reais)
  if (candidateIndex === -1 && hi >= 0) {
    const prev = words[hi];
    const next = words[hi + 1];
    if (next && currentMs > prev.endMs && currentMs < next.startMs && next.startMs - prev.endMs <= 65) {
      candidateIndex = hi;
    }
  }

  if (candidateIndex === -1) {
    return null;
  }

  const word = words[candidateIndex];
  const startFrame = Math.round(((word.startMs + delayMs) / 1000) * fps);
  const endFrame = Math.ceil(((word.endMs + delayMs) / 1000) * fps);

  return {
    word,
    index: candidateIndex,
    isRed: isRedKeyword(word.word, redKeywords),
    startFrame,
    endFrame,
    framesSinceStart: Math.max(0, frame - startFrame),
  };
}

/**
 * Envelope continuo (0 -> 1 -> 0) baseado no ultimo disparo de palavra vermelha
 * (sincronizado com o atraso de +0,1s das legendas).
 * Continua decaindo suavemente mesmo apos o fim de palavras curtas, eliminando
 * qualquer salto ou "pulo" repentino no personagem ou na camera.
 */
export function getRedImpactEnvelope(
  words: readonly TranscriptWord[],
  frame: number,
  fps: number = VIDEO_FPS,
  redKeywords: readonly string[] = [],
  delayMs: number = SUBTITLE_DELAY_MS
): RedImpactEnvelope {
  if (frame < BODY_START || words.length === 0 || redKeywords.length === 0) {
    return { intensity: 0, framesSinceHit: 999, isActive: false };
  }

  const currentMs = ((frame + 0.5) / fps) * 1000 - delayMs;
  if (currentMs < 0) {
    return { intensity: 0, framesSinceHit: 999, isActive: false };
  }

  // Binary search for the last word with startMs <= currentMs
  let lo = 0;
  let hi = words.length - 1;
  let lastIdx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (words[mid].startMs <= currentMs) {
      lastIdx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // Walk backward up to RED_ENVELOPE_FRAMES window to find most recent red hit
  const windowMs = ((RED_ENVELOPE_FRAMES + 2) / fps) * 1000;
  let bestDelta = 999;

  for (let i = lastIdx; i >= 0; i--) {
    const w = words[i];
    if (currentMs - w.startMs > windowMs) {
      break;
    }
    const startFrame = Math.round(((w.startMs + delayMs) / 1000) * fps);
    if (startFrame < BODY_START) {
      break;
    }
    if (isRedKeyword(w.word, redKeywords)) {
      const delta = frame - startFrame;
      if (delta >= 0 && delta <= RED_ENVELOPE_FRAMES) {
        bestDelta = delta;
        break;
      }
    }
  }

  if (bestDelta > RED_ENVELOPE_FRAMES) {
    return { intensity: 0, framesSinceHit: 999, isActive: false };
  }

  // Smooth attack over frames 0..4 (max per-frame delta <= 0.35), smooth decay over frames 4..20
  let intensity = 0;
  if (bestDelta <= 4) {
    intensity = smoothstep(bestDelta / 4);
  } else {
    const decayT = (bestDelta - 4) / (RED_ENVELOPE_FRAMES - 4);
    intensity = Math.pow(Math.max(0, 1 - decayT), 2.1);
  }

  return {
    intensity: Number(intensity.toFixed(4)),
    framesSinceHit: bestDelta,
    isActive: intensity > 0.005,
  };
}

/**
 * Curva automatizada de volume da trilha sonora (Little Dark Age Slowed + Reverb
 * cortada exatamente em 02:56.75 para o drop cair em 00:09.0 e seguir ate o fim):
 * - 00:00 a 00:09 (frames 0..270): 0.26 (-11.7dB) — tensao crescente pre-drop
 * - 00:09 a 00:13.5 (frames 270..405, Drop Whip Pan): sobe para 0.62 (-4.2dB)
 * - 00:13.5 ao final: auto-ducking suave para 0.14 (-17.1dB)
 * - Ultimos 2.0s (60 frames): fade-out suave ate 0.0
 */
export function getMusicVolumeAtFrame(
  frame: number,
  totalFrames: number,
  fps: number = VIDEO_FPS
): number {
  const f = Math.max(0, frame);
  const rampUpFrames = Math.round(0.3 * fps);
  const duckFrames = Math.round(0.65 * fps);
  const fadeOutFrames = Math.round(2.0 * fps);

  let baseVolume = 0.26;

  if (f < WHIP_PAN_START) {
    baseVolume = 0.26;
  } else if (f < WHIP_PAN_START + rampUpFrames) {
    const t = (f - WHIP_PAN_START) / rampUpFrames;
    baseVolume = 0.26 + (0.62 - 0.26) * smoothstep(t);
  } else if (f < BODY_START) {
    baseVolume = 0.62;
  } else if (f < BODY_START + duckFrames) {
    const t = (f - BODY_START) / duckFrames;
    baseVolume = 0.62 + (0.14 - 0.62) * smoothstep(t);
  } else {
    baseVolume = 0.14;
  }

  const fadeStart = Math.max(BODY_START, totalFrames - fadeOutFrames);
  if (f >= fadeStart) {
    const t = Math.min(1, (f - fadeStart) / Math.max(1, fadeOutFrames));
    return Number((baseVolume * (1 - smoothstep(t))).toFixed(4));
  }

  return Number(baseVolume.toFixed(4));
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Converte ganho linear (0..1) em decibeis para exibicao no medidor de estudio.
 */
export function linearToDb(gain: number): number {
  if (gain <= 0.0001) {
    return -60;
  }
  return Math.round(20 * Math.log10(gain) * 10) / 10;
}

/**
 * Alterna movimentos Ken Burns energicos sem repetir o mesmo modo em slides consecutivos:
 * 0 -> zoom-in (1.06 -> 1.18)
 * 1 -> pan-lateral (scale 1.14, pan horizontal dinamico)
 * 2 -> zoom-out (1.18 -> 1.06)
 */
export function getKenBurnsTransform(
  slideIndex: number,
  progress: number
): KenBurnsTransform {
  const p = Math.max(0, Math.min(1, progress));
  const cycle = ((slideIndex % 3) + 3) % 3;

  if (cycle === 0) {
    return {
      mode: 'zoom-in',
      scale: 1.06 + 0.12 * p,
      translateX: -12 * p,
      translateY: -8 * p,
    };
  }
  if (cycle === 1) {
    const dir = slideIndex % 2 === 0 ? 1 : -1;
    return {
      mode: 'pan-lateral',
      scale: 1.14,
      translateX: dir * (-28 + 56 * p),
      translateY: -6 + 12 * p,
    };
  }
  return {
    mode: 'zoom-out',
    scale: 1.18 - 0.12 * p,
    translateX: 14 * (1 - p),
    translateY: 8 * p,
  };
}

/**
 * Micro-shake amortecido no fundo/balao (nunca teleporta o personagem) quando
 * uma palavra vermelha dispara durante a Fase 3.
 */
export function getImpactShakeOffset(
  activeWord: ActiveWordState | null
): { x: number; y: number } {
  if (!activeWord || !activeWord.isRed) {
    return { x: 0, y: 0 };
  }
  if (activeWord.framesSinceStart < 0 || activeWord.framesSinceStart >= IMPACT_SHAKE_FRAMES) {
    return { x: 0, y: 0 };
  }

  const pattern: ReadonlyArray<{ x: number; y: number }> = [
    { x: 3.5, y: -2.2 },
    { x: -3.0, y: 2.0 },
    { x: 1.8, y: -1.1 },
    { x: -0.8, y: 0.5 },
  ];
  return pattern[activeWord.framesSinceStart] ?? { x: 0, y: 0 };
}

/**
 * Calcula a duracao total em frames garantindo cobertura completa da narracao.
 */
export function computeTotalFrames(
  config: Pick<EpisodeConfig, 'duracaoSegundos' | 'fps'>,
  transcriptDurationMs?: number
): number {
  const fps = config.fps || VIDEO_FPS;
  const fromConfig = Math.ceil((config.duracaoSegundos || 15) * fps);
  const fromTranscript = transcriptDurationMs
    ? Math.ceil((transcriptDurationMs / 1000) * fps)
    : 0;
  return Math.max(BODY_START + fps * 2, fromConfig, fromTranscript);
}

/**
 * Formata frame em timecode profissional MM:SS:FF.
 */
export function formatTimecode(frame: number, fps: number = VIDEO_FPS): string {
  const safeFrame = Math.max(0, Math.floor(frame));
  const totalSeconds = Math.floor(safeFrame / fps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const remFrames = safeFrame % fps;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(remFrames).padStart(2, '0')}`;
}
