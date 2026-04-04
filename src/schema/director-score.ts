import { z } from "zod";

export const MusicMood = z.enum([
  "epic_cinematic",
  "tense_electronic",
  "chill_lofi",
  "uplifting_pop",
  "mysterious_ambient",
  "warm_acoustic",
  "dark_cinematic",
  "dreamy_ethereal",
]);
export type MusicMood = z.infer<typeof MusicMood>;

export const VisualType = z.enum(["ai_image", "ai_video", "stock_image", "stock_video", "text_card"]);
export type VisualType = z.infer<typeof VisualType>;

export const Motion = z.enum(["zoom_in", "zoom_out", "pan_right", "pan_left", "static"]);
export type Motion = z.infer<typeof Motion>;

export const TransitionType = z.enum([
  "none", // hard cut (default via mapper cascade)
  "crossfade", // smooth opacity blend
  "slide_left", // slide new scene in from right
  "slide_right", // slide new scene in from left
  "wipe", // horizontal wipe
  "flip", // 3D card flip
]);
export type TransitionType = z.infer<typeof TransitionType>;

export const Scene = z.object({
  visual_type: VisualType,
  visual_prompt: z.string().min(1),
  motion: Motion,
  script_line: z.string().min(1),
  // Controls how THIS scene transitions into the NEXT scene.
  // Optional — mapper cascade resolves: scene value → archetype default → "none".
  transition: TransitionType.nullable(),
});
export type Scene = z.infer<typeof Scene>;

export const DirectorScore = z
  .object({
    emotional_arc: z.string().min(1),
    archetype: z.string().min(1),
    music_mood: MusicMood,
    scenes: z.array(Scene).min(3).max(10),
  })
  .refine(
    (score) => {
      // Golden rule: no more than 2 consecutive scenes of the same visual_type
      for (let i = 2; i < score.scenes.length; i++) {
        const prev2 = score.scenes[i - 2]?.visual_type;
        const prev1 = score.scenes[i - 1]?.visual_type;
        const curr = score.scenes[i]?.visual_type;
        if (prev2 === prev1 && prev1 === curr) {
          return false;
        }
      }
      return true;
    },
    { message: "Golden rule violation: no more than 2 consecutive scenes of the same visual_type" },
  );
export type DirectorScore = z.infer<typeof DirectorScore>;
