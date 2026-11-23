import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalizeRenderPayload,
  formatEta,
  formatFileSize,
  type RenderCacheDescriptor,
} from './renderCacheKey';

const BASE_DESCRIPTOR: RenderCacheDescriptor = {
  config: {
    serie: 'DESMISTIFICANDO RELIGIÕES',
    parte: 'PARTE 1',
    subtitulo: 'OS EVANGELHOS',
    tese: 'Quando a tradição fala mais alto que os manuscritos.',
    episodio: 1,
    fps: 30,
    largura: 1080,
    altura: 1920,
    duracaoSegundos: 251,
    palavras_vermelhas: ['DEUS', 'VERDADE'],
    assets: {
      narracao: 'narracao.mp3',
      trilha: 'trilha.mp3',
      personagem: 'personagem.png',
      fundos: ['fundo1.jpg', 'fundo2.jpg', 'fundo3.jpg'],
      subBass: 'sub_bass.mp3',
      whoosh: 'whoosh.mp3',
    },
  },
  transcript: {
    audioFile: 'narracao.mp3',
    language: 'pt',
    engine: 'acoustic-viterbi-104clauses',
    fps: 30,
    durationMs: 251254,
    totalFrames: 7538,
    wordCount: 2,
    words: [
      { word: 'Você', startMs: 13730, endMs: 14065 },
      { word: 'verdade.', startMs: 244200, endMs: 244620 },
    ],
  },
  options: {
    enableParticles: true,
    enableScanlines: true,
    enableChromaticAberration: true,
    characterBlendMode: 'normal',
    muteAudio: false,
  },
  resolution: '1080p',
  startFrame: 0,
  endFrame: 7537,
  crf: 20,
  preset: 'ultrafast',
};

test('canonicalizeRenderPayload is deterministic regardless of key insertion order', () => {
  const reordered: RenderCacheDescriptor = {
    preset: BASE_DESCRIPTOR.preset,
    crf: BASE_DESCRIPTOR.crf,
    endFrame: BASE_DESCRIPTOR.endFrame,
    startFrame: BASE_DESCRIPTOR.startFrame,
    resolution: BASE_DESCRIPTOR.resolution,
    options: {
      muteAudio: false,
      characterBlendMode: 'normal',
      enableChromaticAberration: true,
      enableScanlines: true,
      enableParticles: true,
    },
    transcript: { ...BASE_DESCRIPTOR.transcript },
    config: {
      ...BASE_DESCRIPTOR.config,
      palavras_vermelhas: ['DEUS', 'VERDADE'],
    },
  };

  assert.equal(canonicalizeRenderPayload(BASE_DESCRIPTOR), canonicalizeRenderPayload(reordered));
});

test('canonicalizeRenderPayload invalidates cache when keywords, options, or range change', () => {
  const baseKey = canonicalizeRenderPayload(BASE_DESCRIPTOR);

  const changedKeyword = canonicalizeRenderPayload({
    ...BASE_DESCRIPTOR,
    config: {
      ...BASE_DESCRIPTOR.config,
      palavras_vermelhas: ['DEUS', 'VERDADE', 'MANUSCRITOS'],
    },
  });
  assert.notEqual(baseKey, changedKeyword);

  const changedOptions = canonicalizeRenderPayload({
    ...BASE_DESCRIPTOR,
    options: { ...BASE_DESCRIPTOR.options, enableParticles: false },
  });
  assert.notEqual(baseKey, changedOptions);

  const changedRange = canonicalizeRenderPayload({
    ...BASE_DESCRIPTOR,
    endFrame: 539,
  });
  assert.notEqual(baseKey, changedRange);
});

test('formatFileSize & formatEta format tabular metrics cleanly', () => {
  assert.equal(formatFileSize(null), '—');
  assert.equal(formatFileSize(512 * 1024), '512 KB');
  assert.equal(formatFileSize(24.6 * 1024 * 1024), '24.6 MB');

  assert.equal(formatEta(null), 'calculando');
  assert.equal(formatEta(42), '42s');
  assert.equal(formatEta(125), '2m05s');
});
