import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BackgroundLoop } from './components/BackgroundLoop';
import { Character } from './components/Character';
import { Intro } from './components/Intro';
import { Particles } from './components/Particles';
import { SpeechBubble } from './components/SpeechBubble';
import { WhipPanSequence } from './components/WhipPanSequence';
import {
  BODY_START,
  INTRO_PART1_END,
  INTRO_PART1_SUB_ENTER,
  INTRO_PART2_END,
  OUTRO_FADE_FRAMES,
  WHIP_PAN_END,
  WHIP_PAN_START,
  getActiveWordAtFrame,
  getImpactShakeOffset,
  getMusicVolumeAtFrame,
  getRedImpactEnvelope,
} from './timeline';
import type { MainVideoProps } from './types';

function resolveAsset(filename: string, overrideUrl?: string): string {
  if (overrideUrl) {
    return overrideUrl;
  }
  if (
    filename.startsWith('http://') ||
    filename.startsWith('https://') ||
    filename.startsWith('blob:') ||
    filename.startsWith('data:')
  ) {
    return filename;
  }
  return staticFile(filename.replace(/^\/+/, ''));
}

export const MainVideo: React.FC<MainVideoProps> = ({
  config,
  transcript,
  options,
  assetOverrides,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enableParticles = options?.enableParticles ?? true;
  const enableScanlines = options?.enableScanlines ?? true;
  const enableChromaticAberration = options?.enableChromaticAberration ?? true;
  const characterBlendMode = options?.characterBlendMode ?? 'normal';
  const muteAudio = options?.muteAudio ?? false;

  const narracaoSrc = resolveAsset(config.assets.narracao, assetOverrides?.narracao);
  const trilhaSrc = resolveAsset(config.assets.trilha, assetOverrides?.trilha);
  const personagemSrc = resolveAsset(config.assets.personagem, assetOverrides?.personagem);
  const subBassSrc = resolveAsset(config.assets.subBass, assetOverrides?.subBass);

  const backgrounds: [string, string, string] = [
    resolveAsset(config.assets.fundos[0], assetOverrides?.fundo1),
    resolveAsset(config.assets.fundos[1], assetOverrides?.fundo2),
    resolveAsset(config.assets.fundos[2], assetOverrides?.fundo3),
  ];

  // Active word synchronization for Phase 3 (00:13.5 -> end)
  const activeWord =
    frame >= BODY_START
      ? getActiveWordAtFrame(transcript.words, frame, fps, config.palavras_vermelhas)
      : null;

  // Continuous C1-smooth red impact envelope (0 -> 1 -> 0): NEVER jumps or snaps
  const redEnvelope = getRedImpactEnvelope(
    transcript.words,
    frame,
    fps,
    config.palavras_vermelhas
  );

  // Damped background-only micro-shake (keeps the character 100% grounded & jump-free!)
  const bgShake = frame >= BODY_START ? getImpactShakeOffset(activeWord) : { x: 0, y: 0 };
  const bodyDuration = Math.max(30, durationInFrames - BODY_START);

  // Sleek crimson bottom progress bar during Phase 3
  const episodeProgressPct = Math.min(100, (frame / Math.max(1, durationInFrames - 1)) * 100);

  // Smooth cinematic fade-to-black during final 1.2s of episode
  const outroBlackOpacity = interpolate(
    frame,
    [Math.max(BODY_START, durationInFrames - Math.round(OUTRO_FADE_FRAMES * 0.65)), durationInFrames],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', overflow: 'hidden' }}>
      {/* FASE 1: ABERTURA CINEMATOGRÁFICA CINÉTICA — 00:00 a 00:09 (frames 0..270) */}
      <Sequence from={0} durationInFrames={INTRO_PART2_END} name="Fase 1: Abertura Cinética">
        <Intro config={config} enableParticles={enableParticles} />
      </Sequence>

      {/* FASE 2: WHIP PAN STROBE 9 CORTES RÁPIDOS — 00:09 a 00:13.5 (frames 270..405) */}
      <Sequence
        from={WHIP_PAN_START}
        durationInFrames={WHIP_PAN_END - WHIP_PAN_START}
        name="Fase 2: Whip Pan 9 Cortes"
      >
        <WhipPanSequence
          backgrounds={backgrounds}
          enableChromaticAberration={enableChromaticAberration}
          enableScanlines={enableScanlines}
        />
      </Sequence>

      {/* FASE 3: CORPO DO VÍDEO EM 4 CAMADAS — 00:13.5 até o fim da narração */}
      <Sequence from={BODY_START} durationInFrames={bodyDuration} name="Fase 3: Corpo 4 Camadas">
        <AbsoluteFill>
          {/* CAMADA 1: Fundos Rápidos em Loop (1.0s) — recebe micro-shake amortecido isolado */}
          <AbsoluteFill
            style={{
              transform:
                bgShake.x !== 0 || bgShake.y !== 0
                  ? `translate3d(${bgShake.x}px, ${bgShake.y}px, 0) scale(1.015)`
                  : `scale(${(1 + redEnvelope.intensity * 0.008).toFixed(4)})`,
            }}
          >
            <BackgroundLoop backgrounds={backgrounds} redIntensity={redEnvelope.intensity} />
          </AbsoluteFill>

          {/* CAMADA 2: Avatar Real 2.5D — 100% livre de saltos (envelope contínuo) */}
          <Character
            src={personagemSrc}
            redEnvelope={redEnvelope}
            blendMode={characterBlendMode}
          />

          {/* CAMADA 3: Balão de Fala HQ Sem Emenda + Tipografia Dinâmica */}
          <SpeechBubble activeWord={activeWord} redEnvelope={redEnvelope} />

          {/* CAMADA 4: Atmosfera Global (Névoa Escura + Brasas + Vinheta) */}
          {enableParticles ? <Particles mode="fog" opacity={0.36} count={26} /> : null}

          {/* Linha cinemática de progresso do episódio na borda inferior */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 4,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${episodeProgressPct}%`,
                background: 'linear-gradient(90deg, #991B1B 0%, #FF1A1A 100%)',
                boxShadow: '0 0 14px rgba(255, 20, 20, 0.9)',
              }}
            />
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Smooth Cinematic Outro Fade-to-Black */}
      {outroBlackOpacity > 0.005 ? (
        <AbsoluteFill
          style={{
            backgroundColor: '#000000',
            opacity: outroBlackOpacity,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {/* ================================================================= */}
      {/* ENGENHARIA DE ÁUDIO AUTOMATIZADA SINCRONIZADA COM VAD & DROP REAL */}
      {/* ================================================================= */}
      {!muteAudio ? (
        <>
          {/* Trilha principal de narração: volume fixo em 1.0 (0dB) */}
          <Audio src={narracaoSrc} volume={1.0} />

          {/* Trilha musical (Little Dark Age Slowed + Reverb 256s: corte exato em 02:56.75 -> drop 00:09.0 -> clímax até o fim) */}
          <Audio
            src={trilhaSrc}
            volume={(f) => getMusicVolumeAtFrame(f, durationInFrames, fps)}
          />

          {/* SFX sub_bass.mp3 nos impactos dos títulos (00:00, 00:02.3 Parte 1, 00:04.0 Os Evangelhos) */}
          <Sequence from={0} durationInFrames={78} name="SFX Sub Bass Intro 1">
            <Audio src={subBassSrc} volume={0.85} />
          </Sequence>
          <Sequence from={INTRO_PART1_SUB_ENTER} durationInFrames={60} name="SFX Sub Bass Parte 1">
            <Audio src={subBassSrc} volume={0.68} />
          </Sequence>
          <Sequence from={INTRO_PART1_END} durationInFrames={78} name="SFX Sub Bass Os Evangelhos">
            <Audio src={subBassSrc} volume={0.92} />
          </Sequence>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
