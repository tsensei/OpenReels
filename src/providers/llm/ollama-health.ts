/**
 * Ollama startup health check.
 * Verifies the Ollama server is reachable and the requested model is available.
 * Throws on failure instead of calling process.exit, so it's safe in non-CLI contexts.
 */
export async function checkOllamaHealth(
  baseUrl: string = "http://127.0.0.1:11434",
  model: string = "gemma4:e4b",
): Promise<void> {
  // 1. Check if Ollama server is reachable
  try {
    const resp = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) {
      throw new Error(`Ollama returned HTTP ${resp.status}`);
    }
    const data = (await resp.json()) as { models?: { name: string }[] };
    const models = data.models ?? [];

    // 2. Check if the requested model is available
    const modelNames = models.map((m) => m.name);
    // Ollama model names can include :latest suffix; normalize for matching
    const normalizedModel = model.includes(":") ? model : `${model}:latest`;
    const found = modelNames.some(
      (name) => name === model || name === normalizedModel || name.startsWith(`${model}:`),
    );

    if (!found) {
      const available = modelNames.length > 0 ? `\nAvailable models: ${modelNames.join(", ")}` : "";
      throw new Error(
        `Ollama model "${model}" not found. Pull it first:\n\n  ollama pull ${model}\n${available}`,
      );
    }

    console.log(`[ollama] Connected to ${baseUrl}, model "${model}" ready`);
  } catch (err) {
    if (err instanceof Error && (err.message.includes("fetch failed") || err.message.includes("ECONNREFUSED"))) {
      throw new Error(
        `Ollama server not reachable at ${baseUrl}.\n\n` +
          "Make sure Ollama is installed and running:\n\n" +
          "  1. Install: https://ollama.com/download\n" +
          "  2. Start:   ollama serve\n" +
          `  3. Pull:    ollama pull ${model}`,
      );
    }
    throw err;
  }
}
