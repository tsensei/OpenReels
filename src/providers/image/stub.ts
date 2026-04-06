import type { ImageProvider } from "../../schema/providers.js";

/**
 * Stub image provider for --local mode.
 * Throws a clear error if the pipeline attempts AI image generation
 * without a cloud image provider configured.
 */
export class StubImageProvider implements ImageProvider {
  async generate(_prompt: string, _style?: string): Promise<Buffer> {
    throw new Error(
      "AI image generation requires a cloud API key (Gemini or OpenAI). " +
        "In local mode, only stock_image, stock_video, and text_card visual types are available. " +
        "Set --image-provider gemini or --image-provider openai with the appropriate API key.",
    );
  }
}
