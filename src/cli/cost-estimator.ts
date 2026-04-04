import type { DirectorScore } from "../schema/director-score.js";
import type {
  ImageProviderKey,
  LLMProviderKey,
  LLMUsage,
  TTSProviderKey,
  VideoProviderKey,
} from "../schema/providers.js";

export interface CostBreakdown {
  llmCost: number;
  ttsCost: number;
  imageCost: number;
  videoCost: number;
  totalCost: number;
  details: {
    llmCalls: number;
    ttsCharacters: number;
    aiImages: number;
    aiVideos: number;
  };
  perScene?: { type: string; cost: number }[];
}

export interface ActualCostBreakdown {
  llmCost: number;
  ttsCost: number;
  imageCost: number;
  videoCost: number;
  totalCost: number;
  details: {
    totalInputTokens: number;
    totalOutputTokens: number;
    ttsCharacters: number;
    aiImages: number;
    aiVideos: number;
  };
}

// Latest pricing (USD per million tokens) — March 2026
// Sources:
//   Anthropic Claude Sonnet 4.6: $3/M input, $15/M output (docs.anthropic.com/en/docs/about-claude/pricing)
//   OpenAI GPT-4.1: $2/M input, $8/M output (openai.com/api/pricing)
//   ElevenLabs: ~$0.30 per 10k chars on Creator tier (elevenlabs.io/pricing/api)
//   Gemini 3.1 Flash Image: $0.04/image at 1024px (ai.google.dev/gemini-api/docs/pricing)
const PRICING = {
  // Using Anthropic as default (higher of the two, conservative estimate)
  anthropic: {
    perInputToken: 3 / 1_000_000, // $3 per 1M input tokens
    perOutputToken: 15 / 1_000_000, // $15 per 1M output tokens
  },
  openai: {
    perInputToken: 2 / 1_000_000, // $2 per 1M input tokens
    perOutputToken: 8 / 1_000_000, // $8 per 1M output tokens
  },
  gemini: {
    perInputToken: 0.10 / 1_000_000, // $0.10 per 1M input tokens (Gemini 2.5 Flash)
    perOutputToken: 0.40 / 1_000_000, // $0.40 per 1M output tokens (Gemini 2.5 Flash)
  },
  elevenLabsPerChar: 0.00018, // $0.18 per 1K chars (avg of Creator $0.20 and Pro $0.17, Multilingual v2)
  inworldPerChar: 0.00001, // $0.01 per 1K chars (Inworld TTS-1.5 Max: $10/1M chars)
  // Gemini 3.1 Flash Image Preview: $60/M output tokens
  // 1080x1920 (>1024px, <=2048px) = 1680 tokens = $0.101/image
  // Plus input tokens at $0.50/M for the prompt text (~200 tokens avg = ~$0.0001)
  geminiPerImage: 0.101, // $0.101 per image at 2K resolution (1080x1920)
  // GPT Image 1.5 (high quality, 1024x1536): $0.167/image
  // Source: platform.openai.com/docs/pricing — high quality portrait
  openaiPerImage: 0.167,
  // Video generation pricing (per second of generated video)
  veoLitePerSecond: 0.05, // Veo 3.1 Lite ($0.30 for 6s clip)
  falKlingPerSecond: 0.07, // Kling v2.1 via fal.ai ($0.35 for 5s clip)
};

// Per-call-type token estimates for pre-run cost prediction
const TOKEN_ESTIMATES = {
  research: { input: 2000, output: 1000 },
  creativeDirector: { input: 5000, output: 2000 },
  critic: { input: 3000, output: 500 },
  imagePrompter: { input: 800, output: 200 },
};

export function estimateCost(
  score: DirectorScore,
  imageProvider: ImageProviderKey = "gemini",
  ttsProvider: TTSProviderKey = "elevenlabs",
  videoProvider?: VideoProviderKey,
  llmProvider: LLMProviderKey = "anthropic",
): CostBreakdown {
  const aiImageScenes = score.scenes.filter((s) => s.visual_type === "ai_image").length;
  const aiVideoScenes = score.scenes.filter((s) => s.visual_type === "ai_video").length;
  // ai_video scenes also generate a Phase 1 AI image
  const aiImages = aiImageScenes + aiVideoScenes;
  const ttsCharacters = score.scenes.reduce((sum, s) => sum + s.script_line.length, 0);
  // research + CD + critic + 1 per ai_image + 2 per ai_video (image prompt + motion prompt)
  const llmCalls = 3 + aiImageScenes + aiVideoScenes * 2;

  const p = PRICING[llmProvider];
  const callCost = (est: { input: number; output: number }) =>
    est.input * p.perInputToken + est.output * p.perOutputToken;

  const llmCost =
    callCost(TOKEN_ESTIMATES.research) +
    callCost(TOKEN_ESTIMATES.creativeDirector) +
    callCost(TOKEN_ESTIMATES.critic) +
    aiImages * callCost(TOKEN_ESTIMATES.imagePrompter);
  const ttsPerChar = ttsProvider === "inworld" ? PRICING.inworldPerChar : PRICING.elevenLabsPerChar;
  const ttsCost = ttsCharacters * ttsPerChar;
  const perImage = imageProvider === "openai" ? PRICING.openaiPerImage : PRICING.geminiPerImage;
  const imageCost = aiImages * perImage;

  // Video generation cost: ~6 seconds per clip at provider rate
  const videoPerSecond = videoProvider === "fal" ? PRICING.falKlingPerSecond : PRICING.veoLitePerSecond;
  const videoCost = aiVideoScenes * 6 * videoPerSecond;

  const totalCost = llmCost + ttsCost + imageCost + videoCost;

  // Per-scene cost breakdown
  const perScene = score.scenes.map((s) => {
    let cost = 0;
    switch (s.visual_type) {
      case "ai_image":
        cost = perImage + callCost(TOKEN_ESTIMATES.imagePrompter);
        break;
      case "ai_video":
        // Phase 1 image + image prompt + motion prompt + video gen
        cost = perImage + callCost(TOKEN_ESTIMATES.imagePrompter) * 2 + 6 * videoPerSecond;
        break;
      case "stock_image":
      case "stock_video":
        cost = 0; // free (Pexels/Pixabay)
        break;
      case "text_card":
        cost = 0;
        break;
    }
    return { type: s.visual_type, cost };
  });

  return {
    llmCost, ttsCost, imageCost, videoCost, totalCost,
    details: { llmCalls, ttsCharacters, aiImages, aiVideos: aiVideoScenes },
    perScene,
  };
}

export function formatCostEstimate(
  breakdown: CostBreakdown,
  imageProvider: ImageProviderKey = "gemini",
  stockSceneCount?: number,
): string {
  const perImage = imageProvider === "openai" ? PRICING.openaiPerImage : PRICING.geminiPerImage;
  const lines = [
    `Estimated cost: $${breakdown.totalCost.toFixed(3)}`,
    `  LLM:    $${breakdown.llmCost.toFixed(4)} (${breakdown.details.llmCalls} calls)`,
    `  TTS:    $${breakdown.ttsCost.toFixed(4)} (${breakdown.details.ttsCharacters} chars)`,
    `  Images: $${breakdown.imageCost.toFixed(4)} (${breakdown.details.aiImages} AI images @ $${perImage.toFixed(3)}/ea)`,
  ];
  if (breakdown.details.aiVideos > 0) {
    lines.push(`  Video:  $${breakdown.videoCost.toFixed(4)} (${breakdown.details.aiVideos} AI videos)`);
  }
  lines.push(`  Stock:  free`);
  if (stockSceneCount && stockSceneCount > 0) {
    const maxAdditional = stockSceneCount * perImage;
    lines.push(`  Max additional if stock falls back: +$${maxAdditional.toFixed(3)} (${stockSceneCount} stock scenes × $${perImage.toFixed(3)}/ea)`);
  }
  // Per-scene breakdown
  if (breakdown.perScene && breakdown.perScene.length > 0) {
    lines.push(`  Per-scene:`);
    for (let i = 0; i < breakdown.perScene.length; i++) {
      const s = breakdown.perScene[i]!;
      const costStr = s.cost > 0 ? `$${s.cost.toFixed(3)}` : "free";
      lines.push(`    Scene ${i + 1} (${s.type}): ${costStr}`);
    }
  }
  return lines.join("\n");
}

/**
 * Compute actual cost from real token usage collected during the pipeline run.
 */
export function computeActualLLMCost(
  usages: LLMUsage[],
  nonLlm: { aiImages: number; ttsCharacters: number; aiVideos?: number },
  provider: LLMProviderKey = "anthropic",
  imageProvider: ImageProviderKey = "gemini",
  ttsProvider: TTSProviderKey = "elevenlabs",
  videoProvider?: VideoProviderKey,
): ActualCostBreakdown {
  const p = PRICING[provider];
  const totalInputTokens = usages.reduce((sum, u) => sum + u.inputTokens, 0);
  const totalOutputTokens = usages.reduce((sum, u) => sum + u.outputTokens, 0);

  const llmCost = totalInputTokens * p.perInputToken + totalOutputTokens * p.perOutputToken;
  const ttsPerChar = ttsProvider === "inworld" ? PRICING.inworldPerChar : PRICING.elevenLabsPerChar;
  const ttsCost = nonLlm.ttsCharacters * ttsPerChar;
  const perImage = imageProvider === "openai" ? PRICING.openaiPerImage : PRICING.geminiPerImage;
  const imageCost = nonLlm.aiImages * perImage;
  const videoPerSecond = videoProvider === "fal" ? PRICING.falKlingPerSecond : PRICING.veoLitePerSecond;
  const aiVideos = nonLlm.aiVideos ?? 0;
  const videoCost = aiVideos * 6 * videoPerSecond;
  const totalCost = llmCost + ttsCost + imageCost + videoCost;

  return {
    llmCost,
    ttsCost,
    imageCost,
    videoCost,
    totalCost,
    details: {
      totalInputTokens,
      totalOutputTokens,
      ttsCharacters: nonLlm.ttsCharacters,
      aiImages: nonLlm.aiImages,
      aiVideos,
    },
  };
}

export function formatActualCost(breakdown: ActualCostBreakdown): string {
  const lines = [
    `Actual cost: $${breakdown.totalCost.toFixed(4)}`,
    `  LLM:    $${breakdown.llmCost.toFixed(4)} (${breakdown.details.totalInputTokens.toLocaleString()} in / ${breakdown.details.totalOutputTokens.toLocaleString()} out tokens)`,
    `  TTS:    $${breakdown.ttsCost.toFixed(4)} (${breakdown.details.ttsCharacters} chars)`,
    `  Images: $${breakdown.imageCost.toFixed(4)} (${breakdown.details.aiImages} AI images)`,
  ];
  if (breakdown.details.aiVideos > 0) {
    lines.push(`  Video:  $${breakdown.videoCost.toFixed(4)} (${breakdown.details.aiVideos} AI videos)`);
  }
  return lines.join("\n");
}
