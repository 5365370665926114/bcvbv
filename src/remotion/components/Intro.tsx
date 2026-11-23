import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { noise2D } from '@remotion/noise';
import { FONT_CINZEL, FONT_SERIF_ITALIC } from '../fonts';
import {
  INTRO_PART1_END,
  INTRO_PART1_SUB_ENTER,
  INTRO_PART2_END,
  INTRO_PART2_THESIS_START,
  isRedKeyword,
} from '../timeline';
import type { EpisodeConfig } from '../types';
import { Particles } from './Particles';

interface IntroProps {
  config: EpisodeConfig;
  enableParticles?: boolean;
}

const ShockwaveRing: React.FC<{ progress: number }> = ({ progress }) => {
  if (progress <= 0 || progress >= 1) return null;
  const scale = 0.25 + progress * 2.15;
  const opacity = (1 - progress) * (1 - progress) * 0.55;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 520,
        height: 520,
        marginLeft: -260,
        marginTop: -260,
        borderRadius: '50%',
        border: '2px solid rgba(255, 30, 30, 0.85)',
        boxShadow: '0 0 28px rgba(255, 0, 0, 0.55), inset 0 0 20px rgba(255, 0, 0, 0.3)',
        transform: `scale(${scale})`,
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
};

export const Intro: React.FC<IntroProps> = ({
  config,
  enableParticles = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const isPart1 = frame < INTRO_PART1_END;
  const isFrame0Preview = frame === 0;

  // Smooth organic handheld drift throughout the intro
  const camX = noise2D('intro-cam-x', t * 0.55, 0.2) * 4.5;
  const camY = noise2D('intro-cam-y', 0.4, t * 0.5) * 3.5;
  const camRot = noise2D('intro-cam-r', t * 0.35, 1.3) * 0.4;

  // Dynamic cinema letterbox bars that frame the intro and retract smoothly before Whip Pan
  const barHeight = interpolate(
    frame,
    [0, 12, INTRO_PART2_END - 16, INTRO_PART2_END],
    [88, 88, 88, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    }
  );

  // Volumetric crimson spotlight drifting behind the title lockup
  const spotX = 50 + Math.sin(t * 0.85) * 18;
  const spotY = 48 + Math.cos(t * 0.65) * 8;

  // =========================================================================
  // BLOCK 1A: 00:00.0 -> 00:04.0 (frames 0..119)
  // =========================================================================
  const serieWords = config.serie.trim().split(/\s+/);
  const serieLine1 = serieWords.slice(0, Math.ceil(serieWords.length / 2)).join(' ');
  const serieLine2 = serieWords.slice(Math.ceil(serieWords.length / 2)).join(' ');

  const scalePart1 = interpolate(frame, [0, INTRO_PART1_END], [1.0, 1.08], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  // Kinetic 3D perspective Z-slam for Line 1 ("DESMISTIFICANDO")
  const line1Spring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 250, mass: 0.7 },
  });
  const line1Scale = isFrame0Preview ? 1 : interpolate(line1Spring, [0, 1], [1.62, 1.0]);
  const line1RotateX = isFrame0Preview ? 0 : interpolate(line1Spring, [0, 1], [28, 0]);
  const line1Tracking = isFrame0Preview ? 0.1 : interpolate(line1Spring, [0, 1], [0.3, 0.1]);
  const line1Blur = isFrame0Preview
    ? 0
    : interpolate(frame, [0, 6], [7, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
  const line1Chroma = isFrame0Preview
    ? 0
    : interpolate(frame, [0, 10], [10, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  // Kinetic 3D Z-slam for Line 2 ("RELIGIÕES") synced at frame 26 (~0.87s)
  const line2Start = 26;
  const line2Local = Math.max(0, frame - line2Start);
  const line2Spring = spring({
    frame: line2Local,
    fps,
    config: { damping: 11, stiffness: 270, mass: 0.65 },
  });
  const line2Visible = isFrame0Preview ? 1 : frame >= line2Start ? 1 : 0;
  const line2Scale = isFrame0Preview ? 1 : interpolate(line2Spring, [0, 1], [1.7, 1.0]);
  const line2RotateX = isFrame0Preview ? 0 : interpolate(line2Spring, [0, 1], [-24, 0]);
  const line2Blur = isFrame0Preview
    ? 0
    : interpolate(line2Local, [0, 6], [11, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
  const line2Chroma =
    !isFrame0Preview && frame >= line2Start
      ? interpolate(line2Local, [0, 9], [9, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 0;

  // "PARTE 1" slam synced at frame 68 (2.27s = "Parte um")
  const parteLocal = Math.max(0, frame - INTRO_PART1_SUB_ENTER);
  const parteSpring = spring({
    frame: parteLocal,
    fps,
    config: { damping: 10, stiffness: 320, mass: 0.55 },
  });
  const parteShown = isFrame0Preview || frame >= INTRO_PART1_SUB_ENTER;
  const parteScale = isFrame0Preview ? 1 : interpolate(parteSpring, [0, 1], [1.85, 1.0]);
  const parteY = isFrame0Preview ? 0 : interpolate(parteSpring, [0, 1], [30, 0]);
  const parteRuleW = isFrame0Preview ? 130 : interpolate(parteSpring, [0, 1], [0, 140]);

  // Expanding crimson shockwave rings on key audio hits
  const ring1 = isFrame0Preview
    ? 0
    : interpolate(frame, [0, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ringParte =
    !isFrame0Preview && frame >= INTRO_PART1_SUB_ENTER
      ? interpolate(parteLocal, [0, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 0;

  // Anamorphic flare bursts on title slams
  const slamFlare1 = Math.max(
    isFrame0Preview ? 0.25 : interpolate(frame, [0, 14], [0.7, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    !isFrame0Preview && frame >= line2Start
      ? interpolate(line2Local, [0, 12], [0.55, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 0,
    !isFrame0Preview && frame >= INTRO_PART1_SUB_ENTER
      ? interpolate(parteLocal, [0, 16], [0.9, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 0
  );

  // Smooth decaying camera kick on Part 1 slams
  const part1Shake =
    !isFrame0Preview &&
    ((frame >= 1 && frame <= 4) ||
      (frame >= line2Start && frame <= line2Start + 4) ||
      (frame >= INTRO_PART1_SUB_ENTER && frame <= INTRO_PART1_SUB_ENTER + 5))
      ? Math.sin(frame * 2.9) * 5
      : 0;

  // =========================================================================
  // BLOCK 1B: 00:04.0 -> 00:09.0 (frames 120..269)
  // =========================================================================
  const part2Frame = Math.max(0, frame - INTRO_PART1_END);
  const part2Duration = INTRO_PART2_END - INTRO_PART1_END;
  const scalePart2 = interpolate(part2Frame, [0, part2Duration], [1.0, 1.09], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  const subTitleSpring = spring({
    frame: part2Frame,
    fps,
    config: { damping: 11, stiffness: 280, mass: 0.6 },
  });
  const subTitleChroma = interpolate(part2Frame, [0, 14], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const subTitleFlare = interpolate(part2Frame, [0, 20], [1.0, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ringPart2 = !isPart1
    ? interpolate(part2Frame, [0, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;
  const part2Shake = part2Frame >= 0 && part2Frame <= 4 ? Math.cos(part2Frame * 3.1) * 6 : 0;

  // Specular light sheen sweep across OS EVANGELHOS
  const sweepPct = interpolate(part2Frame, [8, 56], [-40, 145], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Word-by-word synced thesis reveal (6.07s..8.78s = frames 182..263)
  const thesisWords = config.tese.trim().split(/\s+/);
  const thesisStartLocal = INTRO_PART2_THESIS_START - INTRO_PART1_END;
  const thesisSpanFrames = 78;

  // Hard cut 3-frame glitch slice shutter across frames 119..121
  const isHardCutGlitch = frame >= INTRO_PART1_END - 1 && frame <= INTRO_PART1_END + 1;

  // Split subtitle into word groups so no letter ever wraps as an orphan
  const subtitleWords = config.subtitulo.trim().toUpperCase().split(/\s+/);

  // Subtle editorial HUD reticle opacity
  const hudOpacity = interpolate(frame, [0, 16, INTRO_PART2_END - 12, INTRO_PART2_END], [0.45, 0.45, 0.45, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Volumetric sweeping crimson atmospheric spotlight */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle 620px at ${spotX}% ${spotY}%, rgba(210, 14, 14, ${isPart1 ? 0.16 : 0.24}) 0%, rgba(70, 0, 0, 0.08) 45%, rgba(0, 0, 0, 0) 75%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Procedural red ember dust + dark radial vignette */}
      {enableParticles ? <Particles mode="embers" opacity={0.38} count={64} /> : null}

      {/* Expanding Crimson Shockwave Rings on Audio Impacts */}
      <ShockwaveRing progress={ring1} />
      <ShockwaveRing progress={ringParte} />
      <ShockwaveRing progress={ringPart2} />

      {/* Zero-blur Horizontal Anamorphic Crimson Lens Flare Streak */}
      <div
        style={{
          position: 'absolute',
          left: '-18%',
          right: '-18%',
          top: '50%',
          height: 36,
          marginTop: -18,
          background:
            'radial-gradient(ellipse 46% 36% at 50% 50%, rgba(255,255,255,0.9) 0%, rgba(255,24,24,0.82) 32%, rgba(255,0,0,0) 76%)',
          opacity: isPart1 ? slamFlare1 : subTitleFlare,
          transform: `scaleX(${isPart1 ? 1 + slamFlare1 * 0.45 : 1 + subTitleFlare * 0.65})`,
          pointerEvents: 'none',
        }}
      />

      {/* Editorial Cinema Frame Corner Reticles */}
      <AbsoluteFill style={{ pointerEvents: 'none', opacity: hudOpacity }}>
        <div style={{ position: 'absolute', top: 126, left: 54, width: 32, height: 32, borderTop: '2px solid rgba(255,30,30,0.55)', borderLeft: '2px solid rgba(255,30,30,0.55)' }} />
        <div style={{ position: 'absolute', top: 126, right: 54, width: 32, height: 32, borderTop: '2px solid rgba(255,30,30,0.55)', borderRight: '2px solid rgba(255,30,30,0.55)' }} />
        <div style={{ position: 'absolute', bottom: 126, left: 54, width: 32, height: 32, borderBottom: '2px solid rgba(255,30,30,0.55)', borderLeft: '2px solid rgba(255,30,30,0.55)' }} />
        <div style={{ position: 'absolute', bottom: 126, right: 54, width: 32, height: 32, borderBottom: '2px solid rgba(255,30,30,0.55)', borderRight: '2px solid rgba(255,30,30,0.55)' }} />
      </AbsoluteFill>

      {/* Camera Rig Wrapper (Handheld drift + Impact Shake) */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          perspective: 1200,
          transform: `translate3d(${camX + (isPart1 ? part1Shake : part2Shake)}px, ${camY}px, 0) rotate(${camRot}deg)`,
        }}
      >
        {isPart1 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '0 64px',
              transform: `scale(${scalePart1})`,
            }}
          >
            {/* Top thin crimson editorial hairline */}
            <div
              style={{
                width: isFrame0Preview ? 220 : interpolate(line1Spring, [0, 1], [0, 240]),
                height: 2,
                marginBottom: 34,
                background: 'linear-gradient(90deg, transparent, rgba(255,30,30,0.85), transparent)',
                boxShadow: '0 0 14px rgba(255,0,0,0.75)',
              }}
            />

            {/* Line 1: DESMISTIFICANDO with 3D perspective Z-slam & RGB split */}
            <div style={{ position: 'relative' }}>
              {line1Chroma > 0.3 ? (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      fontFamily: FONT_CINZEL,
                      fontWeight: 800,
                      fontSize: 72,
                      lineHeight: 1.15,
                      letterSpacing: `${line1Tracking}em`,
                      color: '#FF0022',
                      opacity: 0.62,
                      transform: `translateX(${line1Chroma}px) scale(${line1Scale}) rotateX(${line1RotateX}deg)`,
                      mixBlendMode: 'screen',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {serieLine1}
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      fontFamily: FONT_CINZEL,
                      fontWeight: 800,
                      fontSize: 72,
                      lineHeight: 1.15,
                      letterSpacing: `${line1Tracking}em`,
                      color: '#00E5FF',
                      opacity: 0.45,
                      transform: `translateX(${-line1Chroma}px) scale(${line1Scale}) rotateX(${line1RotateX}deg)`,
                      mixBlendMode: 'screen',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {serieLine1}
                  </div>
                </>
              ) : null}
              <div
                style={{
                  fontFamily: FONT_CINZEL,
                  fontWeight: 800,
                  fontSize: 72,
                  lineHeight: 1.15,
                  letterSpacing: `${line1Tracking}em`,
                  color: '#FFFFFF',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  transform: `scale(${line1Scale}) rotateX(${line1RotateX}deg)`,
                  filter: line1Blur > 0.2 ? `blur(${line1Blur}px)` : undefined,
                  textShadow: '0 6px 32px rgba(0, 0, 0, 0.95), 0 0 28px rgba(255,255,255,0.2)',
                }}
              >
                {serieLine1}
              </div>
            </div>

            {/* Line 2: RELIGIÕES synced to second spoken word */}
            {serieLine2 ? (
              <div style={{ position: 'relative', marginTop: 8, opacity: line2Visible }}>
                {line2Chroma > 0.3 ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      fontFamily: FONT_CINZEL,
                      fontWeight: 800,
                      fontSize: 78,
                      lineHeight: 1.15,
                      letterSpacing: '0.16em',
                      color: '#FF0000',
                      opacity: 0.58,
                      transform: `translateX(${line2Chroma}px) scale(${line2Scale}) rotateX(${line2RotateX}deg)`,
                      mixBlendMode: 'screen',
                      textTransform: 'uppercase',
                    }}
                  >
                    {serieLine2}
                  </div>
                ) : null}
                <div
                  style={{
                    fontFamily: FONT_CINZEL,
                    fontWeight: 800,
                    fontSize: 78,
                    lineHeight: 1.15,
                    letterSpacing: '0.16em',
                    color: '#FFFFFF',
                    textTransform: 'uppercase',
                    transform: `scale(${line2Scale}) rotateX(${line2RotateX}deg)`,
                    filter: line2Blur > 0.2 ? `blur(${line2Blur}px)` : undefined,
                    textShadow: '0 6px 32px rgba(0, 0, 0, 0.95)',
                  }}
                >
                  {serieLine2}
                </div>
              </div>
            ) : null}

            {/* Subtext: PARTE 1 with laser bars & explosive crimson slam */}
            {parteShown ? (
              <div
                style={{
                  marginTop: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 28,
                  transform: `translateY(${parteY}px) scale(${parteScale})`,
                }}
              >
                <div
                  style={{
                    width: parteRuleW,
                    height: 3,
                    background: 'linear-gradient(90deg, transparent, #FF0000)',
                    boxShadow: '0 0 18px rgba(255,0,0,0.9)',
                  }}
                />
                <div
                  style={{
                    fontFamily: FONT_CINZEL,
                    fontWeight: 900,
                    fontSize: 58,
                    letterSpacing: '0.22em',
                    color: '#FF0000',
                    textTransform: 'uppercase',
                    textShadow:
                      '0 0 22px rgba(255, 0, 0, 0.95), 0 0 58px rgba(255, 0, 0, 0.62), 0 0 100px rgba(255, 0, 0, 0.35)',
                  }}
                >
                  {config.parte}
                </div>
                <div
                  style={{
                    width: parteRuleW,
                    height: 3,
                    background: 'linear-gradient(90deg, #FF0000, transparent)',
                    boxShadow: '0 0 18px rgba(255,0,0,0.9)',
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '0 64px',
              transform: `scale(${scalePart2})`,
            }}
          >
            {/* OS EVANGELHOS — Staggered kinetic letter-by-letter slam + RGB split + specular light sweep */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              {subTitleChroma > 0.3 ? (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      fontFamily: FONT_CINZEL,
                      fontWeight: 900,
                      fontSize: 74,
                      lineHeight: 1.12,
                      letterSpacing: '0.07em',
                      color: '#00E5FF',
                      opacity: 0.48,
                      transform: `translateX(${-subTitleChroma}px)`,
                      mixBlendMode: 'screen',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {config.subtitulo}
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      fontFamily: FONT_CINZEL,
                      fontWeight: 900,
                      fontSize: 74,
                      lineHeight: 1.12,
                      letterSpacing: '0.07em',
                      color: '#FF0000',
                      opacity: 0.72,
                      transform: `translateX(${subTitleChroma}px)`,
                      mixBlendMode: 'screen',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {config.subtitulo}
                  </div>
                </>
              ) : null}

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: '10px 26px',
                  maxWidth: 960,
                  fontFamily: FONT_CINZEL,
                  fontWeight: 900,
                  fontSize: 74,
                  lineHeight: 1.12,
                  letterSpacing: '0.07em',
                  color: '#FF0000',
                  textTransform: 'uppercase',
                  textShadow:
                    '0 0 26px rgba(255, 0, 0, 0.95), 0 0 68px rgba(255, 0, 0, 0.65), 0 0 120px rgba(200, 0, 0, 0.4)',
                }}
              >
                {(() => {
                  let globalIdx = 0;
                  return subtitleWords.map((word, wIdx) => (
                    <span
                      key={`${word}-${wIdx}`}
                      style={{ display: 'inline-flex', whiteSpace: 'nowrap' }}
                    >
                      {word.split('').map((ch, cIdx) => {
                        const idx = globalIdx++;
                        const delay = Math.min(12, idx * 0.85);
                        const charSpring = spring({
                          frame: Math.max(0, part2Frame - delay),
                          fps,
                          config: { damping: 12, stiffness: 310, mass: 0.5 },
                        });
                        const cScale = interpolate(charSpring, [0, 1], [1.68, 1.0]);
                        const cY = interpolate(charSpring, [0, 1], [-44, 0]);
                        const cOp = interpolate(charSpring, [0, 0.35], [0, 1], {
                          extrapolateRight: 'clamp',
                        });
                        return (
                          <span
                            key={`${wIdx}-${cIdx}`}
                            style={{
                              display: 'inline-block',
                              opacity: cOp,
                              transform: `translateY(${cY}px) scale(${cScale})`,
                            }}
                          >
                            {ch}
                          </span>
                        );
                      })}
                    </span>
                  ));
                })()}
              </div>

              {/* Specular light glint sweeping across OS EVANGELHOS */}
              <div
                style={{
                  position: 'absolute',
                  inset: '-10% 0',
                  background: `linear-gradient(108deg, transparent ${sweepPct - 14}%, rgba(255,255,255,0.48) ${sweepPct}%, transparent ${sweepPct + 14}%)`,
                  mixBlendMode: 'overlay',
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* Expanding Crimson Divider with glowing center diamond */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 34,
                marginBottom: 38,
              }}
            >
              <div
                style={{
                  width: interpolate(subTitleSpring, [0, 1], [0, 180]),
                  height: 2,
                  background: 'linear-gradient(90deg, transparent, #FF0000)',
                  boxShadow: '0 0 18px rgba(255,0,0,0.85)',
                }}
              />
              <div
                style={{
                  width: 10,
                  height: 10,
                  margin: '0 14px',
                  backgroundColor: '#FF2A2A',
                  transform: `rotate(45deg) scale(${interpolate(subTitleSpring, [0, 1], [0, 1])})`,
                  boxShadow: '0 0 18px rgba(255,0,0,1)',
                }}
              />
              <div
                style={{
                  width: interpolate(subTitleSpring, [0, 1], [0, 180]),
                  height: 2,
                  background: 'linear-gradient(90deg, #FF0000, transparent)',
                  boxShadow: '0 0 18px rgba(255,0,0,0.85)',
                }}
              />
            </div>

            {/* Thesis Quote: Blur-to-sharp word-by-word illumination synced to 6.07s–8.78s */}
            <p
              style={{
                margin: 0,
                maxWidth: 860,
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '10px 15px',
                fontFamily: FONT_SERIF_ITALIC,
                fontStyle: 'italic',
                fontWeight: 600,
                fontSize: 48,
                lineHeight: 1.38,
                letterSpacing: '0.02em',
              }}
            >
              {thesisWords.map((word, idx) => {
                const wordTrigger =
                  thesisStartLocal + (idx / Math.max(1, thesisWords.length)) * thesisSpanFrames;
                const localW = part2Frame - wordTrigger;
                const activeProgress = interpolate(localW, [-4, 6], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                const isRed = isRedKeyword(word, config.palavras_vermelhas);
                const opacity = 0.26 + activeProgress * 0.74;
                const y = (1 - activeProgress) * 12;
                const scale = 0.96 + activeProgress * 0.04;
                return (
                  <span
                    key={`${word}-${idx}`}
                    style={{
                      position: 'relative',
                      display: 'inline-block',
                      opacity,
                      color: isRed && activeProgress > 0.4 ? '#FF2424' : '#E8E8EC',
                      transform: `translate3d(0, ${y}px, 0) scale(${scale})`,
                      textShadow:
                        isRed && activeProgress > 0.4
                          ? '0 0 22px rgba(255, 0, 0, 0.9)'
                          : '0 2px 16px rgba(0, 0, 0, 0.95)',
                    }}
                  >
                    {word}
                    {isRed && activeProgress > 0.5 ? (
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: -4,
                          height: 2,
                          background: 'linear-gradient(90deg, transparent, #FF1A1A, transparent)',
                          boxShadow: '0 0 12px rgba(255,0,0,0.9)',
                          transform: `scaleX(${activeProgress})`,
                        }}
                      />
                    ) : null}
                  </span>
                );
              })}
            </p>
          </div>
        )}
      </AbsoluteFill>

      {/* Dynamic Cinematic Letterbox Bars */}
      {barHeight > 0.5 ? (
        <>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: barHeight,
              backgroundColor: '#000000',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: barHeight,
              backgroundColor: '#000000',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              pointerEvents: 'none',
            }}
          />
        </>
      ) : null}

      {/* 3-Frame Hard Cut Crimson Glitch Shutter at 00:04 (frames 119..121) */}
      {isHardCutGlitch ? (
        <AbsoluteFill
          style={{
            background:
              frame === INTRO_PART1_END
                ? 'radial-gradient(circle, rgba(255,20,20,0.44) 0%, rgba(12,0,0,0.92) 85%)'
                : '#0D0000',
            opacity: frame === INTRO_PART1_END - 1 ? 0.95 : frame === INTRO_PART1_END ? 0.72 : 0.25,
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
