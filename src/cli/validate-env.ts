import type { ImageProviderKey, LLMProviderKey, TTSProviderKey } from "../schema/providers.js";

interface EnvRequirement {
  key: string;
  provider: string;
  signupUrl: string;
  required: boolean;
}

export function validateEnv(opts: {
  provider: LLMProviderKey;
  ttsProvider: TTSProviderKey;
  imageProvider: ImageProviderKey;
}): void {
  const requirements: EnvRequirement[] = [
    {
      key: "ANTHROPIC_API_KEY",
      provider: "Anthropic (LLM)",
      signupUrl: "https://console.anthropic.com/",
      required: opts.provider === "anthropic",
    },
    {
      key: "OPENAI_API_KEY",
      provider: "OpenAI (LLM/Image)",
      signupUrl: "https://platform.openai.com/api-keys",
      required: opts.provider === "openai" || opts.imageProvider === "openai",
    },
    {
      key: "GOOGLE_API_KEY",
      provider: "Google Gemini (Image)",
      signupUrl: "https://aistudio.google.com/apikey",
      required: opts.imageProvider === "gemini",
    },
    {
      key: "ELEVENLABS_API_KEY",
      provider: "ElevenLabs (TTS)",
      signupUrl: "https://elevenlabs.io/",
      required: opts.ttsProvider === "elevenlabs",
    },
    {
      key: "INWORLD_TTS_API_KEY",
      provider: "Inworld (TTS)",
      signupUrl: "https://inworld.ai/",
      required: opts.ttsProvider === "inworld",
    },
  ];

  const missing = requirements.filter((r) => r.required && !process.env[r.key]);

  // Stock keys are optional — the pipeline degrades gracefully (black frames) — but
  // warn upfront so users aren't surprised by missing visuals on stock_image/stock_video scenes.
  const hasStockKey = process.env["PEXELS_API_KEY"] || process.env["PIXABAY_API_KEY"];
  if (!hasStockKey) {
    console.warn(
      "\nWarning: No stock media API key found (PEXELS_API_KEY or PIXABAY_API_KEY).\n" +
        "Scenes using stock_image or stock_video will render as blank frames.\n" +
        "Get a free key: https://www.pexels.com/api/ or https://pixabay.com/api/docs/\n",
    );
  }

  if (missing.length === 0) return;

  console.error("\nMissing required API keys:\n");
  console.error("  Key                     Status    Get it at");
  console.error("  " + "-".repeat(70));
  for (const r of missing) {
    const key = r.key.padEnd(24);
    console.error(`  ${key}MISSING   ${r.signupUrl}`);
  }
  console.error(
    "\nSet these in your .env file (or pass with `docker run --env-file .env` when using Docker).\n",
  );
  process.exit(1);
}
