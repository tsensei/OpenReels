import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMerriweather } from "@remotion/google-fonts/Merriweather";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadPlayfairDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";

const { fontFamily: montserrat } = loadMontserrat("normal", {
  weights: ["700", "900"],
  subsets: ["latin"],
});

const { fontFamily: inter } = loadInter("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});

const { fontFamily: playfairDisplay } = loadPlayfairDisplay("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});

const { fontFamily: oswald } = loadOswald("normal", {
  weights: ["700"],
  subsets: ["latin"],
});

const { fontFamily: merriweather } = loadMerriweather("normal", {
  weights: ["700", "900"],
  subsets: ["latin"],
});

const { fontFamily: spaceGrotesk } = loadSpaceGrotesk("normal", {
  weights: ["700"],
  subsets: ["latin"],
});

export const CAPTION_FONTS = {
  montserrat,
  inter,
  playfairDisplay,
  oswald,
} as const;

/** Maps archetype textCardFont names to registered Remotion font families */
export const TEXT_CARD_FONTS: Record<string, string> = {
  Inter: inter,
  Merriweather: merriweather,
  "Space Grotesk": spaceGrotesk,
};
