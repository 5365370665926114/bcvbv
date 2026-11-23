import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { noise2D } from '@remotion/noise';
import { FONT_ANTON } from '../fonts';
import { formatDisplayWord, type ActiveWordState, type RedImpactEnvelope } from '../timeline';

interface SpeechBubbleProps {
  activeWord: ActiveWordState | null;
  redEnvelope: RedImpactEnvelope;
}

function getWordFontSize(word: string): number {
  const len = word.length;
  if (len <= 4) return 122;
  if (len <= 7) return 104;
  if (len <= 10) return 86;
  if (len <= 13) return 70;
  return 56;
}

const BUBBLE_PATH = `M 54 12
  L 516 12
  Q 558 12, 558 54
  L 558 290
  Q 558 332, 516 332
  L 154 332
  C 134 374, 96 402, 54 414
  C 76 390, 88 362, 92 332
  L 54 332
  Q 12 332, 12 290
  L 12 54
  Q 12 12, 54 12 Z`;

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({ activeWord, redEnvelope }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeSec = frame / fps;

  const displayText = activeWord ? formatDisplayWord(activeWord.word.word) : '';
  const isRed = Boolean(activeWord?.isRed);

  // Smooth gentle floating bob synced with character rhythm
  const floatY = noise2D('bubble-float-y', timeSec * 0.44, 2.4) * 4.0;
  const floatX = noise2D('bubble-float-x', 1.2, timeSec * 0.34) * 2.0;

  // Crisp bubble entrance finishing BEFORE the first spoken word ("VOCÊ" at frame 412 / local frame 7)
  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 320, mass: 0.55 },
  });
  const enterScale = interpolate(enterSpring, [0, 1], [0.88, 1.0]);
  const enterOpacity = interpolate(frame, [0, 5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Zero-lag kinetic word pop: instant 100% opacity on frame 0 + snappy 4-frame scale settle
  const popSpring = activeWord
    ? spring({
        frame: activeWord.framesSinceStart,
        fps,
        config: {
          damping: 14,
          stiffness: 620,
          mass: 0.28,
        },
        durationInFrames: 4,
      })
    : 1;

  const wordScale = interpolate(popSpring, [0, 1], [isRed ? 1.28 : 1.16, 1.0]);
  const tiltDir = activeWord && activeWord.index % 2 === 0 ? 1 : -1;
  const wordTilt = activeWord ? interpolate(popSpring, [0, 1], [tiltDir * (isRed ? 2.4 : 1.1), 0]) : 0;
  const wordOpacity = activeWord ? 1 : 0;

  // Continuous RGB chromatic split ghosting on red impact keywords
  const redChroma =
    isRed && activeWord
      ? interpolate(activeWord.framesSinceStart, [0, 5], [7, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 0;

  // Continuous smooth bubble pulse driven by redEnvelope (zero snapping, zero SVG filter!)
  const env = redEnvelope.intensity;
  const bubbleScale = enterScale * (1.0 + env * 0.04);
  const underlineWidth = isRed && activeWord
    ? interpolate(popSpring, [0, 1], [0, 250])
    : 0;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: enterOpacity }}>
      {/* Seamless Comic HQ Speech Bubble positioned upper-right above avatar's shoulder */}
      <div
        style={{
          position: 'absolute',
          right: 44,
          top: 380,
          width: 570,
          height: 420,
          transformOrigin: '20% 90%',
          willChange: 'transform',
          transform: `translate3d(${floatX}px, ${floatY}px, 0) scale(${bubbleScale})`,
        }}
      >
        {/* Pure GPU layered vector neon strokes (zero backdropFilter blur, zero feDropShadow!) */}
        <svg
          width="570"
          height="420"
          viewBox="0 0 570 420"
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'visible',
          }}
        >
          <defs>
            <linearGradient id="bubbleGlassFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(22, 9, 11, 0.94)" />
              <stop offset="100%" stopColor="rgba(7, 7, 10, 0.92)" />
            </linearGradient>
            <linearGradient id="bubbleTopEdge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="50%" stopColor="rgba(255,95,95,0.65)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>

          {/* Outer soft crimson neon halo strokes (zero Gaussian filter cost) */}
          <path
            d={BUBBLE_PATH}
            fill="none"
            stroke="#FF0000"
            strokeWidth={18 + env * 8}
            strokeLinejoin="round"
            opacity={(0.12 + env * 0.16).toFixed(3)}
          />
          <path
            d={BUBBLE_PATH}
            fill="none"
            stroke="#FF1A1A"
            strokeWidth={9 + env * 3}
            strokeLinejoin="round"
            opacity={(0.24 + env * 0.24).toFixed(3)}
          />

          {/* Main unified comic bubble fill + crisp neon rim */}
          <path
            d={BUBBLE_PATH}
            fill="url(#bubbleGlassFill)"
            stroke="#FF1A1A"
            strokeWidth={(3.2 + env * 0.9).toFixed(2)}
            strokeLinejoin="round"
          />

          {/* Subtle top specular glass glint inside bubble rim */}
          <line
            x1="74"
            y1="18"
            x2="496"
            y2="18"
            stroke="url(#bubbleTopEdge)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>

        {/* Active Word centered cleanly inside the bubble body (ONE WORD AT A TIME) */}
        <div
          style={{
            position: 'absolute',
            left: 12,
            top: 12,
            width: 546,
            height: 320,
            padding: '28px 34px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          {displayText ? (
            <>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {redChroma > 0.3 ? (
                  <>
                    <span
                      style={{
                        position: 'absolute',
                        fontFamily: FONT_ANTON,
                        fontSize: getWordFontSize(displayText),
                        lineHeight: 1.05,
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                        color: '#00E5FF',
                        opacity: 0.42,
                        transform: `translateX(${-redChroma}px) scale(${wordScale}) rotate(${wordTilt}deg)`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {displayText}
                    </span>
                    <span
                      style={{
                        position: 'absolute',
                        fontFamily: FONT_ANTON,
                        fontSize: getWordFontSize(displayText),
                        lineHeight: 1.05,
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                        color: '#FF0022',
                        opacity: 0.68,
                        transform: `translateX(${redChroma}px) scale(${wordScale}) rotate(${wordTilt}deg)`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {displayText}
                    </span>
                  </>
                ) : null}
                <span
                  style={{
                    display: 'inline-block',
                    fontFamily: FONT_ANTON,
                    fontSize: getWordFontSize(displayText),
                    lineHeight: 1.05,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                    color: isRed ? '#FF0000' : '#FFFFFF',
                    textShadow: isRed
                      ? '0 0 18px rgba(255, 0, 0, 0.92), 0 0 38px rgba(255, 0, 0, 0.5)'
                      : '0 4px 16px rgba(0, 0, 0, 0.85)',
                    transform: `scale(${wordScale}) rotate(${wordTilt}deg)`,
                    opacity: wordOpacity,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayText}
                </span>
              </div>

              {/* Crimson kinetic impact underline on highlighted red keywords */}
              {underlineWidth > 4 ? (
                <div
                  style={{
                    marginTop: 14,
                    width: underlineWidth,
                    height: 4,
                    borderRadius: 99,
                    background:
                      'linear-gradient(90deg, transparent 0%, #FF1A1A 50%, transparent 100%)',
                    boxShadow: '0 0 14px rgba(255, 0, 0, 0.9)',
                  }}
                />
              ) : null}
            </>
          ) : (
            <span
              style={{
                fontFamily: FONT_ANTON,
                fontSize: 44,
                letterSpacing: '0.28em',
                color: 'rgba(255, 255, 255, 0.22)',
              }}
            >
              •••
            </span>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
