import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { noise2D } from '@remotion/noise';

interface ParticlesProps {
  mode: 'embers' | 'fog';
  opacity?: number;
  count?: number;
}

interface EmberSeed {
  id: number;
  baseX: number;
  baseY: number;
  radius: number;
  speedY: number;
  driftScale: number;
  phase: number;
  warmth: number;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export const Particles: React.FC<ParticlesProps> = ({
  mode,
  opacity = 0.25,
  count = 36,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;

  const embers = useMemo<EmberSeed[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      baseX: seededRandom(i * 3 + 1) * 1080,
      baseY: seededRandom(i * 3 + 2) * 1920,
      radius: 2.2 + seededRandom(i * 3 + 3) * 5.2,
      speedY: 16 + seededRandom(i * 5 + 7) * 34,
      driftScale: 24 + seededRandom(i * 7 + 11) * 46,
      phase: seededRandom(i * 11 + 13) * 100,
      warmth: seededRandom(i * 13 + 17),
    }));
  }, [count]);

  if (mode === 'fog') {
    const driftA = noise2D('fogA', t * 0.08, 0.5) * 140;
    const driftB = noise2D('fogB', 0.3, t * 0.06) * 180;
    const driftC = noise2D('fogC', t * 0.05, 1.4) * 110;

    return (
      <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
        {/* Zero-blur GPU radial mist layers (naturally soft gradients, 60fps fast) */}
        <div
          style={{
            position: 'absolute',
            inset: -180,
            opacity: opacity * 0.85,
            willChange: 'transform',
            transform: `translate3d(${driftA}px, ${driftC * 0.4}px, 0) scale(1.15)`,
            background:
              'radial-gradient(ellipse 58% 38% at 28% 72%, rgba(180, 14, 20, 0.18) 0%, rgba(16, 12, 16, 0.28) 42%, transparent 74%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: -200,
            opacity,
            willChange: 'transform',
            transform: `translate3d(${-driftB}px, ${Math.sin(t * 0.25) * 26}px, 0) scale(1.18)`,
            background:
              'radial-gradient(ellipse 62% 34% at 75% 24%, rgba(30, 26, 36, 0.38) 0%, rgba(10, 10, 14, 0.22) 48%, transparent 76%)',
          }}
        />
        {/* Lightweight floating crimson embers (pure gradient fill, zero SVG blur) */}
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: 'absolute', inset: 0, opacity: opacity * 0.7 }}
        >
          <defs>
            <radialGradient id="fogDustRed">
              <stop offset="0%" stopColor="#FF5544" stopOpacity="1" />
              <stop offset="45%" stopColor="#FF1A1A" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#FF0000" stopOpacity="0" />
            </radialGradient>
          </defs>
          {embers.slice(0, 14).map((p) => {
            const y = ((p.baseY - t * p.speedY * 0.7) % height + height) % height;
            const x =
              ((p.baseX + noise2D(`dust-${p.id}`, t * 0.14, p.phase) * p.driftScale) % width +
                width) %
              width;
            const flicker = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.4 + p.phase));
            return (
              <circle
                key={p.id}
                cx={x}
                cy={y}
                r={p.radius * 1.3}
                fill="url(#fogDustRed)"
                opacity={flicker * 0.85}
              />
            );
          })}
        </svg>
        {/* Global Cinematic Vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 50% 48%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.62) 82%, rgba(0,0,0,0.92) 100%)',
          }}
        />
      </AbsoluteFill>
    );
  }

  // Mode: 'embers' (GPU-fast radial gradient glowing embers — zero feGaussianBlur!)
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: 'absolute', inset: 0, opacity }}
      >
        <defs>
          <radialGradient id="emberBright">
            <stop offset="0%" stopColor="#FF9A76" stopOpacity="1" />
            <stop offset="38%" stopColor="#FF1E1E" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#B91C1C" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="emberDeep">
            <stop offset="0%" stopColor="#FF3B3B" stopOpacity="1" />
            <stop offset="45%" stopColor="#DC2626" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#7F1D1D" stopOpacity="0" />
          </radialGradient>
        </defs>
        {embers.slice(0, 38).map((p) => {
          const y = ((p.baseY - t * p.speedY) % height + height) % height;
          const x =
            ((p.baseX + noise2D(`ember-${p.id}`, t * 0.22, p.phase) * p.driftScale) % width +
              width) %
            width;
          const flicker = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.8 + p.phase));
          return (
            <circle
              key={p.id}
              cx={x}
              cy={y}
              r={p.radius * 1.6}
              fill={p.warmth > 0.5 ? 'url(#emberBright)' : 'url(#emberDeep)'}
              opacity={flicker}
            />
          );
        })}
      </svg>

      {/* Subtle crimson center haze + deep radial vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 50%, rgba(185, 16, 16, 0.08) 0%, rgba(0, 0, 0, 0.2) 48%, rgba(0, 0, 0, 0.94) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
