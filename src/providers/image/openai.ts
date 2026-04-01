import OpenAI from "openai";
import type { ImageProvider } from "../../schema/providers.js";

export class OpenAIImage implements ImageProvider {
  private client: OpenAI;
  private model: string;

  constructor(model: string = "gpt-image-1.5", apiKey?: string) {
    const key = apiKey ?? process.env["OPENAI_API_KEY"];
    if (!key) throw new Error("OPENAI_API_KEY environment variable is required");
    this.client = new OpenAI({ apiKey: key });
    this.model = model;
  }

  async generate(prompt: string, style?: string): Promise<Buffer> {
    const fullPrompt = style
      ? `${prompt}. Style: ${style}. Vertical portrait orientation, 2:3 aspect ratio. No text, no watermarks.`
      : `${prompt}. Vertical portrait orientation, 2:3 aspect ratio. No text, no watermarks.`;

    const response = await this.client.images.generate({
      model: this.model,
      prompt: fullPrompt,
      n: 1,
      size: "1024x1536",
      quality: "high",
      output_format: "png",
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("OpenAI returned no image data");
    }

    return Buffer.from(b64, "base64");
  }
}
