import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { FONT_ANTON } from '../fonts';
import {
  WHIP_CHROMATIC_FRAMES,
  WHIP_CUT_COUNT,
  WHIP_CUT_DURATION,
} from '../timeline';

interface WhipPanSequenceProps {
  backgrounds: [string, string, string];
  enableChromaticAberration?: boolean;
  enableScanlines?: boolean;
}

interface WhipSlideProps {
  src: string;
  cutIndex: number;
  isMonochrome: boolean;
  enableChromaticAberration: boolean;
}

const WhipSlide: React.FC<WhipSlideProps> = ({
  src,
  cutIndex,
  isMonochrome,
  enableChromaticAberration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Violent punch-in slam -> aggressive zoom drive across 15 frames
  const punchSpring = spring({
    frame,
    fps,
    config: { damping: 11, stiffness: 360, mass: 0.45 },
  });
  const baseDrive = interpolate(frame, [0, WHIP_CUT_DURATION], [1.08, 1.32], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const impactBounce = interpolate(punchSpring, [0, 1], [0.22, 0]);
  const scale = baseDrive + impactBounce;

  // GPU-fast directional whip stretch in first 4 frames (replaces expensive full-frame SVG Gaussian blur)
  const whipStretchX = interpolate(frame, [0, 4], [1.14, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Dynamic Dutch camera tilt kick alternating direction on every rapid cut
  const tiltDir = cutIndex % 2 === 0 ? 1 : -1;
  const tiltDeg = interpolate(frame, [0, 6, WHIP_CUT_DURATION], [tiltDir * 3.4, tiltDir * 0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Intense RGB Chromatic Aberration (8.5px split) during first 5 frames of each cut
  const chromaActive = enableChromaticAberration && frame < WHIP_CHROMATIC_FRAMES;
  const chromaShift = chromaActive
    ? interpolate(frame, [0, WHIP_CHROMATIC_FRAMES], [8.5, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  // Anamorphic crimson laser flash across center on cut impact (pure gradient, zero blur filter)
  const flareOpacity = interpolate(frame, [0, 5], [0.78, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Expanding beat shockwave ring on alternate cuts
  const ringProg = cutIndex % 2 === 0
    ? interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;

  const gradeFilter = isMonochrome
    ? 'grayscale(1) brightness(0.84) contrast(1.52)'
    : 'brightness(0.82) contrast(1.38) saturate(1.16)';

  const baseImgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    willChange: 'transform',
    transform: `scale(${scale}) scaleX(${whipStretchX}) rotate(${tiltDeg}deg)`,
    filter: gradeFilter,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', overflow: 'hidden' }}>
      {/* Main Image with GPU-fast directional whip stretch */}
      <AbsoluteFill>
        <Img src={src} style={baseImgStyle} />
      </AbsoluteFill>

      {/* Crimson tint wash on color strobe frames */}
      {!isMonochrome ? (
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(circle at 50% 45%, rgba(220, 20, 20, 0.16) 0%, rgba(90, 0, 0, 0.36) 100%)',
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {/* GPU-fast RGB Chromatic Aberration split in first frames */}
      {chromaShift > 0.3 ? (
        <>
          <AbsoluteFill
            style={{
              transform: `translate3d(${chromaShift}px, 0, 0)`,
              mixBlendMode: 'screen',
              opacity: 0.44,
              pointerEvents: 'none',
            }}
          >
            <Img
              src={src}
              style={{
                ...baseImgStyle,
                filter: 'sepia(1) hue-rotate(-55deg) saturate(6)',
              }}
            />
          </AbsoluteFill>
          <AbsoluteFill
            style={{
              transform: `translate3d(${-chromaShift}px, 0, 0)`,
              mixBlendMode: 'screen',
              opacity: 0.38,
              pointerEvents: 'none',
            }}
          >
            <Img
              src={src}
              style={{
                ...baseImgStyle,
                filter: 'sepia(1) hue-rotate(175deg) saturate(6)',
              }}
            />
          </AbsoluteFill>
        </>
      ) : null}

      {/* Expanding beat shockwave ring */}
      {ringProg > 0 && ringProg < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 480,
            height: 480,
            marginLeft: -240,
            marginTop: -240,
            borderRadius: '50%',
            border: '2px solid rgba(255, 36, 36, 0.8)',
            transform: `scale(${0.35 + ringProg * 2.1})`,
            opacity: (1 - ringProg) * 0.55,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {/* Zero-blur soft radial anamorphic crimson cut flare */}
      {flareOpacity > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: '-10%',
            right: '-10%',
            top: '50%',
            height: 44,
            marginTop: -22,
            background:
              'radial-gradient(ellipse 52% 45% at 50% 50%, rgba(255,255,255,0.85) 0%, rgba(255,26,26,0.75) 28%, rgba(255,0,0,0) 75%)',
            opacity: flareOpacity,
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {/* High-energy white/crimson shutter flash on frame 0..2 of every cut */}
      {frame < 3 ? (
        <AbsoluteFill
          style={{
            backgroundColor: cutIndex % 3 === 1 ? '#FF1A1A' : '#FFFFFF',
            opacity: interpolate(frame, [0, 3], [0.28, 0]),
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

export const WhipPanSequence: React.FC<WhipPanSequenceProps> = ({
  backgrounds,
  enableChromaticAberration = true,
  enableScanlines = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 9 hyper-fast repeating cuts (0.5s / 15 frames each = 135 frames exact = 4.5s)
  const transitionFrames = 3;
  const cuts = Array.from({ length: WHIP_CUT_COUNT }, (_, idx) => backgrounds[idx % backgrounds.length]);
  const directions = [
    'from-right',
    'from-left',
    'from-bottom',
    'from-right',
    'from-left',
    'from-top',
    'from-right',
    'from-left',
  ] as const;

  // Kinetic Hook Text synced to real narracao.mp3:
  // "Abre o olho" = 10.15s..10.85s (local frames 33..56)
  // "para a história" = 10.85s..12.10s (local frames 56..96)
  const hookLine1Active = frame >= 33 && frame < 56;
  const hookLine2Active = frame >= 56 && frame < 96;
  const hookLocal = hookLine1Active ? frame - 33 : hookLine2Active ? frame - 56 : 0;
  const hookSpring = spring({
    frame: hookLocal,
    fps,
    config: { damping: 11, stiffness: 440, mass: 0.38 },
  });
  const hookScale = interpolate(hookSpring, [0, 1], [1.46, 1.0]);
  const hookChroma = interpolate(hookLocal, [0, 6], [8.5, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hookBarScaleX = interpolate(hookSpring, [0, 1], [0, 1]);

  // Ultra-fast jittered grain offset (replaces 2M-pixel CPU feTurbulence!)
  const grainOffsetX = ((frame * 47) % 120) - 60;
  const grainOffsetY = ((frame * 73) % 120) - 60;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', overflow: 'hidden' }}>
      <TransitionSeries>
        {cuts.map((src, idx) => {
          const isLast = idx === cuts.length - 1;
          const duration = isLast ? WHIP_CUT_DURATION : WHIP_CUT_DURATION + transitionFrames;
          const isMonochrome = idx % 2 === 0;

          return (
            <React.Fragment key={idx}>
              <TransitionSeries.Sequence durationInFrames={duration}>
                <WhipSlide
                  src={src}
                  cutIndex={idx}
                  isMonochrome={isMonochrome}
                  enableChromaticAberration={enableChromaticAberration}
                />
              </TransitionSeries.Sequence>
              {!isLast ? (
                <TransitionSeries.Transition
                  presentation={slide({ direction: directions[idx % directions.length] })}
                  timing={linearTiming({ durationInFrames: transitionFrames })}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </TransitionSeries>

      {/* Synced Kinetic Hook Slam ("ABRE O OLHO" / "PARA A HISTÓRIA") with RGB split & crimson bar */}
      {hookLine1Active || hookLine2Active ? (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none',
            padding: '0 44px',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: `scale(${hookScale})`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: '-16px -44px',
                background: hookLine2Active
                  ? 'linear-gradient(90deg, transparent, rgba(160, 0, 0, 0.74) 22%, rgba(160, 0, 0, 0.74) 78%, transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.80) 20%, rgba(0, 0, 0, 0.80) 80%, transparent)',
                transform: `scaleX(${hookBarScaleX}) skewX(-8deg)`,
                borderTop: '2px solid rgba(255, 30, 30, 0.78)',
                borderBottom: '2px solid rgba(255, 30, 30, 0.78)',
              }}
            />
            <div style={{ position: 'relative' }}>
              {hookChroma > 0.3 ? (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      fontFamily: FONT_ANTON,
                      fontSize: hookLine1Active ? 132 : 114,
                      lineHeight: 1.02,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      textAlign: 'center',
                      color: '#00E5FF',
                      opacity: 0.5,
                      transform: `translate3d(${-hookChroma}px, 0, 0)`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {hookLine1Active ? 'ABRE O OLHO' : 'PARA A HISTÓRIA'}
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      fontFamily: FONT_ANTON,
                      fontSize: hookLine1Active ? 132 : 114,
                      lineHeight: 1.02,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      textAlign: 'center',
                      color: '#FF0022',
                      opacity: 0.68,
                      transform: `translate3d(${hookChroma}px, 0, 0)`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {hookLine1Active ? 'ABRE O OLHO' : 'PARA A HISTÓRIA'}
                  </div>
                </>
              ) : null}
              <div
                style={{
                  position: 'relative',
                  fontFamily: FONT_ANTON,
                  fontSize: hookLine1Active ? 132 : 114,
                  lineHeight: 1.02,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  color: '#FFFFFF',
                  textShadow: hookLine2Active
                    ? '0 0 28px rgba(255,0,0,0.95), 0 8px 36px rgba(0,0,0,0.98)'
                    : '0 8px 36px rgba(0,0,0,0.98), 0 0 24px rgba(255,0,0,0.55)',
                  WebkitTextStroke: '2px rgba(0,0,0,0.88)',
                  whiteSpace: 'nowrap',
                }}
              >
                {hookLine1Active ? 'ABRE O OLHO' : 'PARA A HISTÓRIA'}
              </div>
            </div>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* Zero-CPU lightweight jittered film-grain texture + scanlines */}
      {enableScanlines ? (
        <>
          <div
            style={{
              position: 'absolute',
              inset: -80,
              backgroundImage:
                'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 0), radial-gradient(rgba(255,255,255,0.10) 1px, transparent 0)',
              backgroundSize: '26px 26px',
              backgroundPosition: '0 0, 13px 13px',
              transform: `translate3d(${grainOffsetX}px, ${grainOffsetY}px, 0)`,
              opacity: 0.25,
              pointerEvents: 'none',
            }}
          />
          <AbsoluteFill
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.25) 0px, rgba(0, 0, 0, 0.25) 1px, transparent 1px, transparent 4px)',
              opacity: 0.45,
              pointerEvents: 'none',
            }}
          />
        </>
      ) : null}

      {/* Heavy Cinematic Edge Vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.92) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
