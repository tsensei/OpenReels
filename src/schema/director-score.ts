import { z } from "zod";

export const VisualType = z.enum(["ai_image", "stock_image", "stock_video", "text_card"]);
export type VisualType = z.infer<typeof VisualType>;

export const Motion = z.enum(["zoom_in", "zoom_out", "pan_right", "pan_left", "static"]);
export type Motion = z.infer<typeof Motion>;

export const Scene = z.object({
  visual_type: VisualType,
  visual_prompt: z.string().min(1),
  motion: Motion,
  text_overlay: z.string().nullable(),
  script_line: z.string().min(1),
});
export type Scene = z.infer<typeof Scene>;

export const DirectorScore = z
  .object({
    emotional_arc: z.string().min(1),
    archetype: z.string().min(1),
    music_mood: z.string().min(1),
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
  )
  .refine(
    (score) => {
      // text_card scenes must have text_overlay
      return score.scenes.every(
        (s) => s.visual_type !== "text_card" || s.text_overlay !== null,
      );
    },
    { message: "text_card scenes must have a text_overlay" },
  );
export type DirectorScore = z.infer<typeof DirectorScore>;
