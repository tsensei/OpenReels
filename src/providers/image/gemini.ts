import { GoogleGenAI } from "@google/genai";
import type { ImageProvider } from "../../schema/providers.js";

export class GeminiImage implements ImageProvider {
  private client: GoogleGenAI;
  private model: string;

  constructor(model: string = "gemini-3.1-flash-image-preview") {
    const key = process.env["GOOGLE_API_KEY"];
    if (!key) throw new Error("GOOGLE_API_KEY environment variable is required");
    this.client = new GoogleGenAI({ apiKey: key });
    this.model = model;
  }

  async generate(prompt: string, style?: string): Promise<Buffer> {
    const fullPrompt = style
      ? `${prompt}. Style: ${style}. Vertical 9:16 aspect ratio, 1080x1920 pixels. No text, no watermarks.`
      : `${prompt}. Vertical 9:16 aspect ratio, 1080x1920 pixels. No text, no watermarks.`;

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: fullPrompt,
      config: {
        responseModalities: ["image", "text"],
      },
    });

    // Extract image from response
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new Error("Gemini returned no content");
    }

    for (const part of parts) {
      if (part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, "base64");
      }
    }

    throw new Error("Gemini returned no image data");
  }
}
