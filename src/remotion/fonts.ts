import { loadFont as loadCinzel } from '@remotion/google-fonts/Cinzel';
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadCormorant } from '@remotion/google-fonts/CormorantGaramond';

const cinzel = loadCinzel('normal', {
  weights: ['600', '700', '800', '900'],
  subsets: ['latin', 'latin-ext'],
});

const anton = loadAnton('normal', {
  weights: ['400'],
  subsets: ['latin', 'latin-ext'],
});

const cormorant = loadCormorant('italic', {
  weights: ['500', '600'],
  subsets: ['latin', 'latin-ext'],
});

export const FONT_CINZEL = cinzel.fontFamily;
export const FONT_ANTON = anton.fontFamily;
export const FONT_SERIF_ITALIC = cormorant.fontFamily;
