import type { ImageProvider } from "../../schema/providers.js";

const DEFAULT_MODEL = "x/flux2-klein:4b";
const DEFAULT_HOST = "http://localhost:11434";

export class OllamaImage implements ImageProvider {
  private model: string;
  private host: string;

  constructor(model: string = DEFAULT_MODEL, host: string = DEFAULT_HOST) {
    if (process.platform !== "darwin") {
      throw new Error(
        `Ollama image generation is currently macOS-only.\n` +
        `  → Use --image-provider gemini or --image-provider openai on Linux/Windows.\n` +
        `  → See: https://ollama.com/blog/image-generation`,
      );
    }
    this.model = model;
    this.host = host.replace(/\/$/, "");
  }

  async generate(prompt: string, style?: string): Promise<Buffer> {
    const fullPrompt = style
      ? `${prompt}. Style: ${style}. Vertical 9:16 aspect ratio, portrait orientation. No text, no watermarks.`
      : `${prompt}. Vertical 9:16 aspect ratio, portrait orientation. No text, no watermarks.`;

    const response = await fetch(`${this.host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: fullPrompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Ollama image generation failed (${response.status}): ${body}\n` +
        `  → Ensure Ollama is running: ollama serve\n` +
        `  → Ensure the model is pulled: ollama pull ${this.model}`,
      );
    }

    const data = (await response.json()) as OllamaGenerateResponse;

    // Ollama image models return the image as base64 in data.image (singular)
    const imageData = data.image;
    if (!imageData) {
      throw new Error(
        `Ollama returned no image data. ` +
        `Ensure you are using an image-capable model (e.g. x/flux2-klein:4b or x/z-image-turbo:latest).`,
      );
    }

    return Buffer.from(imageData, "base64");
  }
}

interface OllamaGenerateResponse {
  image?: string;
  response: string;
}
