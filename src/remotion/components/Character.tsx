import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { noise2D } from '@remotion/noise';
import type { RedImpactEnvelope } from '../timeline';

interface CharacterProps {
  src: string;
  redEnvelope: RedImpactEnvelope;
  blendMode?: 'normal' | 'lighten';
}

export const Character: React.FC<CharacterProps> = ({
  src,
  redEnvelope,
  blendMode = 'normal',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeSec = frame / fps;

  // Smooth one-time cinematic rise when Phase 3 begins (never resets or pops)
  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 160, mass: 0.9 },
  });
  const enterY = interpolate(enterSpring, [0, 1], [110, 0]);
  const enterOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Silk-smooth organic breathing & subtle sway via @remotion/noise (zero sudden jumps)
  const breathY = noise2D('char-breath-y', timeSec * 0.42, 0.25) * 4.5;
  const breathRot = noise2D('char-breath-rot', 0.75, timeSec * 0.32) * 0.55;
  const microDriftX = noise2D('char-breath-x', timeSec * 0.28, 1.8) * 2.2;

  // C1-continuous impact envelope (0 -> 1 -> 0): smooth grounded presence swell
  const env = redEnvelope.intensity;
  const impactScale = 1.0 + env * 0.024;
  const auraOpacity = 0.34 + env * 0.42 + 0.08 * Math.sin(timeSec * 2.6);
  const redChromaShift = env > 0.28 ? (env - 0.28) * 6 : 0;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: enterOpacity }}>
      {/* GPU-fast naturally feathered crimson back-halo (zero filter: blur!) */}
      <div
        style={{
          position: 'absolute',
          left: -100,
          bottom: 80,
          width: 880,
          height: 980,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 46% 44%, rgba(255, 18, 18, 0.42) 0%, rgba(190, 0, 0, 0.22) 28%, rgba(90, 0, 0, 0.08) 52%, rgba(0, 0, 0, 0) 72%)',
          opacity: auraOpacity,
          willChange: 'transform, opacity',
          transform: `translate3d(${microDriftX * 0.6}px, ${breathY * 0.5}px, 0) scale(${1 + env * 0.1})`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: -76,
          bottom: -14,
          height: '62%',
          width: 920,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
          transformOrigin: '38% 95%',
          willChange: 'transform',
          transform: `translate3d(${microDriftX}px, ${breathY + enterY}px, 0) rotate(${breathRot}deg) scale(${impactScale})`,
        }}
      >
        {/* Lightweight chromatic echo only at red impact peak (zero blur pass!) */}
        {redChromaShift > 0.4 ? (
          <Img
            src={src}
            style={{
              position: 'absolute',
              left: redChromaShift,
              bottom: 0,
              height: '100%',
              width: 'auto',
              objectFit: 'contain',
              mixBlendMode: 'screen',
              opacity: env * 0.34,
            }}
          />
        ) : null}

        {/* Single crisp real uploaded avatar cutout (zero animated per-frame drop-shadow blur!) */}
        <Img
          src={src}
          style={{
            height: '100%',
            width: 'auto',
            objectFit: 'contain',
            mixBlendMode: blendMode,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
