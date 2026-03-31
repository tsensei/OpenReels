import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPlayfairDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";

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

export const CAPTION_FONTS = {
  montserrat,
  inter,
  playfairDisplay,
  oswald,
} as const;
