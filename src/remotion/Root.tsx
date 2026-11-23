import React from 'react';
import { Composition, staticFile } from 'remotion';
import { MainVideo } from './MainVideo';
import {
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  computeTotalFrames,
} from './timeline';
import type { EpisodeConfig, MainVideoProps, TranscriptData } from './types';

export const DEFAULT_EPISODE_CONFIG: EpisodeConfig = {
  serie: 'DESMISTIFICANDO RELIGIÕES',
  parte: 'PARTE 1',
  subtitulo: 'OS EVANGELHOS',
  tese: '"Quando a tradição fala mais alto que os manuscritos."',
  episodio: 1,
  fps: VIDEO_FPS,
  largura: VIDEO_WIDTH,
  altura: VIDEO_HEIGHT,
  duracaoSegundos: 251,
  assets: {
    narracao: 'narracao.mp3',
    trilha: 'trilha.mp3',
    personagem: 'personagem.png',
    fundos: ['fundo1.jpg', 'fundo2.jpg', 'fundo3.jpg'],
    whoosh: 'whoosh.mp3',
    subBass: 'sub_bass.mp3',
  },
  palavras_vermelhas: [
    'EVANGELHOS',
    'TRADIÇÃO',
    'MANUSCRITOS',
    'HISTÓRIA',
    'ANÔNIMOS',
    'NENHUM',
    'IGREJA',
    'AUTORIDADE',
    'ARAMAICO',
    'ANALFABETISMO',
    'NOVENTA',
    'GREGO',
    'CRUCIFICAÇÃO',
    'COPIANDO',
    'ORIGINAL',
    'CÓPIAS',
    'ALTERAÇÕES',
    'ADÚLTERA',
    'PECADO',
    'PEDRA',
    'EXISTE',
    'INSERIDA',
    'SÉCULOS',
    'MEDO',
    'SILÊNCIO',
    'DIFERENÇAS',
    'RESSURREIÇÃO',
    'TÚMULO',
    'TEOLÓGICA',
    'CONCÍLIOS',
    'BISPOS',
    'HUMANOS',
    'EDITORIAL',
    'INSTITUCIONAL',
    'VERDADE',
    'ILUSÃO',
    'FÉ',
    'INVESTIGADA',
    'DESTRÓI',
  ],
};

export const DEFAULT_TRANSCRIPT: TranscriptData = {
  audioFile: 'narracao.mp3',
  language: 'pt',
  engine: 'aligned-audio-timeline',
  fps: VIDEO_FPS,
  durationMs: 251000,
  totalFrames: 7530,
  wordCount: 0,
  words: [],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DesmistificandoEpisode"
        component={MainVideo}
        durationInFrames={computeTotalFrames(DEFAULT_EPISODE_CONFIG)}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={
          {
            config: DEFAULT_EPISODE_CONFIG,
            transcript: DEFAULT_TRANSCRIPT,
          } satisfies MainVideoProps
        }
        calculateMetadata={async ({ props }) => {
          const typedProps = props as unknown as MainVideoProps;
          let config = typedProps.config ?? DEFAULT_EPISODE_CONFIG;
          let transcript = typedProps.transcript ?? DEFAULT_TRANSCRIPT;

          try {
            const [cfgRes, trRes] = await Promise.all([
              fetch(staticFile('config.json')),
              fetch(staticFile('transcript.json')),
            ]);
            if (cfgRes.ok) {
              config = (await cfgRes.json()) as EpisodeConfig;
            }
            if (trRes.ok) {
              transcript = (await trRes.json()) as TranscriptData;
            }
          } catch {
            // Keep defaultProps when rendering offline without static server
          }

          const durationInFrames = computeTotalFrames(config, transcript.durationMs);
          return {
            durationInFrames,
            fps: config.fps || VIDEO_FPS,
            width: config.largura || VIDEO_WIDTH,
            height: config.altura || VIDEO_HEIGHT,
            props: {
              ...typedProps,
              config,
              transcript,
            },
          };
        }}
      />
    </>
  );
};
