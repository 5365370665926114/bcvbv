import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BODY_START,
  INTRO_PART1_END,
  SUBTITLE_DELAY_MS,
  WHIP_PAN_START,
  computeTotalFrames,
  formatDisplayWord,
  formatTimecode,
  getActiveWordAtFrame,
  getImpactShakeOffset,
  getKenBurnsTransform,
  getMusicVolumeAtFrame,
  getPhaseAtFrame,
  getRedImpactEnvelope,
  isRedKeyword,
  normalizeWord,
} from './timeline';
import type { TranscriptWord } from './types';

test('normalizeWord strips accents/punctuation while formatDisplayWord preserves ? and !', () => {
  assert.equal(normalizeWord('"Tradição,"'), 'TRADICAO');
  assert.equal(normalizeWord('anônimos.'), 'ANONIMOS');
  assert.equal(normalizeWord('EVANGELHOS?'), 'EVANGELHOS');
  assert.equal(formatDisplayWord('"tradição,"'), 'TRADIÇÃO');
  assert.equal(formatDisplayWord('estante?'), 'ESTANTE?');
  assert.equal(formatDisplayWord('túmulo?'), 'TÚMULO?');
  assert.equal(formatDisplayWord('brilhantes?'), 'BRILHANTES?');
  assert.equal(formatDisplayWord('história!'), 'HISTÓRIA!');
});

test('isRedKeyword matches regardless of case, accents, or punctuation', () => {
  const reds = ['TRADIÇÃO', 'MANUSCRITOS', 'ANÔNIMOS'];
  assert.equal(isRedKeyword('tradição,', reds), true);
  assert.equal(isRedKeyword('manuscritos.', reds), true);
  assert.equal(isRedKeyword('anonimos', reds), true);
  assert.equal(isRedKeyword('estante', reds), false);
});

test('getPhaseAtFrame partitions timeline at exact VAD-synced marks (0s, 4s, 9s, 13.5s)', () => {
  assert.equal(getPhaseAtFrame(0), 'intro_part1');
  assert.equal(getPhaseAtFrame(INTRO_PART1_END - 1), 'intro_part1');
  assert.equal(getPhaseAtFrame(INTRO_PART1_END), 'intro_part2');
  assert.equal(getPhaseAtFrame(WHIP_PAN_START - 1), 'intro_part2');
  assert.equal(getPhaseAtFrame(WHIP_PAN_START), 'whip_pan');
  assert.equal(getPhaseAtFrame(BODY_START - 1), 'whip_pan');
  assert.equal(getPhaseAtFrame(BODY_START), 'body');
});

test('getMusicVolumeAtFrame follows automated ducking & 2.0s outro fade spec', () => {
  const totalFrames = 7538;
  // 00:00..00:09 -> 0.26 (-11.7dB)
  assert.equal(getMusicVolumeAtFrame(0, totalFrames), 0.26);
  assert.equal(getMusicVolumeAtFrame(WHIP_PAN_START - 1, totalFrames), 0.26);
  // 00:09..00:13.5 -> rises smoothly to 0.62 (-4.2dB) at exact chorus drop
  const midWhip = getMusicVolumeAtFrame(WHIP_PAN_START + 30, totalFrames);
  assert.equal(midWhip, 0.62);
  // 00:13.5+ -> smoothly ducks to 0.14 (-17.1dB)
  const bodySteady = getMusicVolumeAtFrame(BODY_START + 90, totalFrames);
  assert.equal(bodySteady, 0.14);
  // Last 2.0s (60 frames) -> fades smoothly to 0
  const nearEnd = getMusicVolumeAtFrame(totalFrames - 30, totalFrames);
  assert.ok(nearEnd > 0 && nearEnd < 0.14);
  assert.equal(getMusicVolumeAtFrame(totalFrames, totalFrames), 0);
});

test('getActiveWordAtFrame locks to 0ms acoustic onset (midpoint rounding) and triggers damped micro-shake on red keywords', () => {
  assert.equal(SUBTITLE_DELAY_MS, 0);
  const words: TranscriptWord[] = [
    { word: 'todos', startMs: 14000, endMs: 14400 },
    { word: 'anônimos.', startMs: 14500, endMs: 15100 },
  ];
  const reds = ['ANÔNIMOS'];

  // Frame 425 = 14183ms midpoint -> "todos" (white, no shake)
  const whiteHit = getActiveWordAtFrame(words, 425, 30, reds);
  assert.ok(whiteHit);
  assert.equal(whiteHit.word.word, 'todos');
  assert.equal(whiteHit.isRed, false);
  assert.deepEqual(getImpactShakeOffset(whiteHit), { x: 0, y: 0 });

  // Frame 435 = 14516.7ms midpoint -> "anônimos." (starts at 14500ms -> exact frame 435, framesSinceStart 0, shake 3.5px)
  const redHit0 = getActiveWordAtFrame(words, 435, 30, reds);
  assert.ok(redHit0);
  assert.equal(redHit0.word.word, 'anônimos.');
  assert.equal(redHit0.framesSinceStart, 0);
  assert.equal(redHit0.isRed, true);
  assert.equal(Math.abs(getImpactShakeOffset(redHit0).x), 3.5);

  // Frame 440 = 5 frames after start -> shake finished
  const redHit5 = getActiveWordAtFrame(words, 440, 30, reds);
  assert.ok(redHit5);
  assert.deepEqual(getImpactShakeOffset(redHit5), { x: 0, y: 0 });
});

test('getRedImpactEnvelope stays C1-continuous with zero jumps at exact 0ms acoustic onset', () => {
  // Short 4-frame red word ("Deus") followed immediately by non-red word ("disse")
  const words: TranscriptWord[] = [
    { word: 'Deus', startMs: 15000, endMs: 15130 },
    { word: 'disse', startMs: 15140, endMs: 15600 },
  ];
  const reds = ['DEUS'];

  let prev = 0;
  for (let f = 448; f <= 475; f++) {
    const env = getRedImpactEnvelope(words, f, 30, reds);
    assert.ok(env.intensity >= 0 && env.intensity <= 1);
    // Max single-frame jump must stay strictly smooth (never teleports 1.0 -> 0.0!)
    assert.ok(
      Math.abs(env.intensity - prev) <= 0.36,
      `Frame ${f} jumped discontinuously from ${prev} to ${env.intensity}`
    );
    prev = env.intensity;
  }

  // Triggers at frame 450, peaks at frame 454 (450 + 4), still smoothly active at 457
  assert.equal(getRedImpactEnvelope(words, 449, 30, reds).intensity, 0);
  assert.equal(getRedImpactEnvelope(words, 454, 30, reds).intensity, 1);
  assert.ok(getRedImpactEnvelope(words, 457, 30, reds).intensity > 0.5);
  // Decays cleanly to 0 after window
  assert.equal(getRedImpactEnvelope(words, 472, 30, reds).intensity, 0);
});

test('getKenBurnsTransform never repeats the same motion mode on consecutive slides', () => {
  for (let i = 0; i < 12; i++) {
    const a = getKenBurnsTransform(i, 0.5);
    const b = getKenBurnsTransform(i + 1, 0.5);
    assert.notEqual(a.mode, b.mode);
  }
  const zoomInStart = getKenBurnsTransform(0, 0);
  const zoomInEnd = getKenBurnsTransform(0, 1);
  assert.ok(Math.abs(zoomInStart.scale - 1.06) < 1e-6);
  assert.ok(Math.abs(zoomInEnd.scale - 1.18) < 1e-6);

  const zoomOutStart = getKenBurnsTransform(2, 0);
  const zoomOutEnd = getKenBurnsTransform(2, 1);
  assert.ok(Math.abs(zoomOutStart.scale - 1.18) < 1e-6);
  assert.ok(Math.abs(zoomOutEnd.scale - 1.06) < 1e-6);
});

test('computeTotalFrames & formatTimecode produce valid broadcast values', () => {
  assert.equal(computeTotalFrames({ duracaoSegundos: 251, fps: 30 }, 251254), 7538);
  assert.equal(formatTimecode(0, 30), '00:00:00');
  assert.equal(formatTimecode(405, 30), '00:13:15');
});
