import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  BG_CROSSFADE_FRAMES,
  BG_SLIDE_DURATION,
  getKenBurnsTransform,
} from '../timeline';

interface BackgroundLoopProps {
  backgrounds: [string, string, string];
  redIntensity?: number;
}

const TREATED_COLOR_FILTER = 'brightness(0.56) contrast(1.32) saturate(0.82)';
const TREATED_NOIR_FILTER = 'grayscale(1) brightness(0.50) contrast(1.48)';
const TREATED_CRIMSON_FILTER =
  'brightness(0.52) contrast(1.38) sepia(0.35) hue-rotate(-32deg) saturate(1.45)';

function getGradeFilter(slideIndex: number): string {
  const mode = ((slideIndex % 3) + 3) % 3;
  if (mode === 1) return TREATED_NOIR_FILTER;
  if (mode === 2) return TREATED_CRIMSON_FILTER;
  return TREATED_COLOR_FILTER;
}

export const BackgroundLoop: React.FC<BackgroundLoopProps> = ({
  backgrounds,
  redIntensity = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeSec = frame / fps;

  // Rapid repeating cuts every 1.0s (30 frames) cycling fundo1 -> fundo2 -> fundo3 continuously
  const slideIndex = Math.floor(frame / BG_SLIDE_DURATION);
  const localFrame = frame % BG_SLIDE_DURATION;
  const progress = localFrame / BG_SLIDE_DURATION;

  const currentSrc = backgrounds[slideIndex % backgrounds.length];
  const prevSlideIndex = Math.max(0, slideIndex - 1);
  const prevSrc = backgrounds[prevSlideIndex % backgrounds.length];

  const currentFilter = getGradeFilter(slideIndex);
  const prevFilter = getGradeFilter(prevSlideIndex);

  const isCrossfading = slideIndex > 0 && localFrame < BG_CROSSFADE_FRAMES;
  const currentOpacity = isCrossfading
    ? interpolate(localFrame, [0, BG_CROSSFADE_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  // Energetic punch zoom-kick on each rapid cut transition
  const cutKickScale = interpolate(localFrame, [0, 7], [0.065, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const currentKb = getKenBurnsTransform(slideIndex, progress);
  const prevKb = getKenBurnsTransform(prevSlideIndex, 1);

  // Slow volumetric crimson light sweep drifting across the background
  const lightSweepX = 50 + Math.sin(timeSec * 0.55) * 32;
  const lightSweepY = 34 + Math.cos(timeSec * 0.4) * 16;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', overflow: 'hidden' }}>
      {/* Outgoing slide during fast 4-frame crossfade */}
      {isCrossfading ? (
        <AbsoluteFill style={{ opacity: 1 }}>
          <Img
            src={prevSrc}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: prevFilter,
              transform: `translate3d(${prevKb.translateX}px, ${prevKb.translateY}px, 0) scale(${prevKb.scale})`,
            }}
          />
        </AbsoluteFill>
      ) : null}

      {/* Active rapidly cycling slide with Ken Burns + cut punch */}
      <AbsoluteFill style={{ opacity: currentOpacity }}>
        <Img
          src={currentSrc}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: currentFilter,
            transform: `translate3d(${currentKb.translateX}px, ${currentKb.translateY}px, 0) scale(${currentKb.scale + cutKickScale})`,
          }}
        />
      </AbsoluteFill>

      {/* Volumetric drifting crimson atmosphere wash */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle 680px at ${lightSweepX}% ${lightSweepY}%, rgba(220, 18, 18, ${(0.14 + redIntensity * 0.16).toFixed(3)}) 0%, rgba(0, 0, 0, 0) 70%)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />

      {/* Brief subtle flash on rapid cut change */}
      {localFrame < 2 && slideIndex > 0 ? (
        <AbsoluteFill
          style={{
            backgroundColor: slideIndex % 3 === 2 ? '#FF2A2A' : '#FFFFFF',
            opacity: localFrame === 0 ? 0.08 : 0.03,
            mixBlendMode: 'overlay',
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {/* Smooth crimson edge pulse driven continuously by red impact envelope */}
      {redIntensity > 0.01 ? (
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(ellipse 75% 70% at 50% 48%, rgba(255,0,0,0) 42%, rgba(235,0,0,0.34) 100%)',
            opacity: redIntensity,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {/* Heavy radial black edge vignette melting borders to pure #000000 */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 84% 78% at 50% 48%, rgba(0,0,0,0.06) 18%, rgba(0,0,0,0.6) 64%, rgba(0,0,0,0.96) 100%)',
          pointerEvents: 'none',
        }}
      />
      {/* Top & bottom cinema framing gradients */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 64%, rgba(0,0,0,0.96) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
