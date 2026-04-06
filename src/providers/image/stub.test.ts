import { describe, expect, it } from "vitest";
import { StubImageProvider } from "./stub.js";

describe("StubImageProvider", () => {
  it("throws with a clear error message", async () => {
    const stub = new StubImageProvider();
    await expect(stub.generate("a beautiful sunset")).rejects.toThrow(
      /AI image generation requires a cloud API key/,
    );
  });

  it("mentions available visual types in error", async () => {
    const stub = new StubImageProvider();
    await expect(stub.generate("test", "oil painting")).rejects.toThrow(
      /stock_image.*stock_video.*text_card/,
    );
  });
});
