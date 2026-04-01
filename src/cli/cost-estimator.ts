import type { DirectorScore } from "../schema/director-score.js";
import type {
  ImageProviderKey,
  LLMProviderKey,
  LLMUsage,
  TTSProviderKey,
} from "../schema/providers.js";

export interface CostBreakdown {
  llmCost: number;
  ttsCost: number;
  imageCost: number;
  totalCost: number;
  details: {
    llmCalls: number;
    ttsCharacters: number;
    aiImages: number;
  };
}

export interface ActualCostBreakdown {
  llmCost: number;
  ttsCost: number;
  imageCost: number;
  totalCost: number;
  details: {
    totalInputTokens: number;
    totalOutputTokens: number;
    ttsCharacters: number;
    aiImages: number;
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
  elevenLabsPerChar: 0.00018, // $0.18 per 1K chars (avg of Creator $0.20 and Pro $0.17, Multilingual v2)
  inworldPerChar: 0.00001, // $0.01 per 1K chars (Inworld TTS-1.5 Max: $10/1M chars)
  // Gemini 3.1 Flash Image Preview: $60/M output tokens
  // 1080x1920 (>1024px, <=2048px) = 1680 tokens = $0.101/image
  // Plus input tokens at $0.50/M for the prompt text (~200 tokens avg = ~$0.0001)
  geminiPerImage: 0.101, // $0.101 per image at 2K resolution (1080x1920)
  // GPT Image 1.5 (high quality, 1024x1536): $0.167/image
  // Source: platform.openai.com/docs/pricing — high quality portrait
  openaiPerImage: 0.167,
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
): CostBreakdown {
  const aiImages = score.scenes.filter((s) => s.visual_type === "ai_image").length;
  const ttsCharacters = score.scenes.reduce((sum, s) => sum + s.script_line.length, 0);
  const llmCalls = 3 + aiImages; // research + CD + critic + 1 per ai_image

  const p = PRICING.anthropic; // conservative estimate
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
  const totalCost = llmCost + ttsCost + imageCost;

  return { llmCost, ttsCost, imageCost, totalCost, details: { llmCalls, ttsCharacters, aiImages } };
}

export function formatCostEstimate(
  breakdown: CostBreakdown,
  imageProvider: ImageProviderKey = "gemini",
): string {
  const perImage = imageProvider === "openai" ? PRICING.openaiPerImage : PRICING.geminiPerImage;
  return [
    `Estimated cost: $${breakdown.totalCost.toFixed(3)}`,
    `  LLM:    $${breakdown.llmCost.toFixed(4)} (${breakdown.details.llmCalls} calls)`,
    `  TTS:    $${breakdown.ttsCost.toFixed(4)} (${breakdown.details.ttsCharacters} chars)`,
    `  Images: $${breakdown.imageCost.toFixed(4)} (${breakdown.details.aiImages} AI images @ $${perImage.toFixed(3)}/ea)`,
    `  Stock:  free`,
  ].join("\n");
}

/**
 * Compute actual cost from real token usage collected during the pipeline run.
 */
export function computeActualLLMCost(
  usages: LLMUsage[],
  nonLlm: { aiImages: number; ttsCharacters: number },
  provider: LLMProviderKey = "anthropic",
  imageProvider: ImageProviderKey = "gemini",
  ttsProvider: TTSProviderKey = "elevenlabs",
): ActualCostBreakdown {
  const p = PRICING[provider];
  const totalInputTokens = usages.reduce((sum, u) => sum + u.inputTokens, 0);
  const totalOutputTokens = usages.reduce((sum, u) => sum + u.outputTokens, 0);

  const llmCost = totalInputTokens * p.perInputToken + totalOutputTokens * p.perOutputToken;
  const ttsPerChar = ttsProvider === "inworld" ? PRICING.inworldPerChar : PRICING.elevenLabsPerChar;
  const ttsCost = nonLlm.ttsCharacters * ttsPerChar;
  const perImage = imageProvider === "openai" ? PRICING.openaiPerImage : PRICING.geminiPerImage;
  const imageCost = nonLlm.aiImages * perImage;
  const totalCost = llmCost + ttsCost + imageCost;

  return {
    llmCost,
    ttsCost,
    imageCost,
    totalCost,
    details: {
      totalInputTokens,
      totalOutputTokens,
      ttsCharacters: nonLlm.ttsCharacters,
      aiImages: nonLlm.aiImages,
    },
  };
}

export function formatActualCost(breakdown: ActualCostBreakdown): string {
  return [
    `Actual cost: $${breakdown.totalCost.toFixed(4)}`,
    `  LLM:    $${breakdown.llmCost.toFixed(4)} (${breakdown.details.totalInputTokens.toLocaleString()} in / ${breakdown.details.totalOutputTokens.toLocaleString()} out tokens)`,
    `  TTS:    $${breakdown.ttsCost.toFixed(4)} (${breakdown.details.ttsCharacters} chars)`,
    `  Images: $${breakdown.imageCost.toFixed(4)} (${breakdown.details.aiImages} AI images)`,
  ].join("\n");
}
