import type {
  ImageProviderKey,
  LLMProviderKey,
  MusicProviderKey,
  SearchProviderKey,
  TTSProviderKey,
  VideoProviderKey,
} from "../schema/providers.js";

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
  videoProvider?: VideoProviderKey;
  musicProvider?: MusicProviderKey;
  searchProvider?: SearchProviderKey;
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
      required:
        opts.provider === "openai" ||
        opts.imageProvider === "openai" ||
        opts.ttsProvider === "openai-tts",
    },
    {
      key: "GOOGLE_API_KEY",
      provider: "Google Gemini (LLM/Image/Video/TTS)",
      signupUrl: "https://aistudio.google.com/apikey",
      required:
        opts.provider === "gemini" ||
        opts.imageProvider === "gemini" ||
        opts.videoProvider === "gemini" ||
        opts.ttsProvider === "gemini-tts" ||
        opts.musicProvider === "lyria",
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
    {
      key: "OPENROUTER_API_KEY",
      provider: "OpenRouter (LLM)",
      signupUrl: "https://openrouter.ai/",
      required: opts.provider === "openrouter",
    },
    {
      key: "TAVILY_API_KEY",
      provider: "Tavily (Web Search)",
      signupUrl: "https://tavily.com/",
      required: opts.searchProvider === "tavily",
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

  // Warn when openrouter/openai-compatible without explicit search provider and no Tavily key
  const needsSearchWarning =
    (opts.provider === "openrouter" || opts.provider === "openai-compatible") &&
    !opts.searchProvider &&
    !process.env["TAVILY_API_KEY"];
  if (needsSearchWarning) {
    console.warn(
      "\nWarning: TAVILY_API_KEY not set. Web search will be disabled for this provider.\n" +
        "Research agent will use parametric knowledge only.\n" +
        "Get a key: https://tavily.com/ or use --search-provider none to suppress this warning.\n",
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
