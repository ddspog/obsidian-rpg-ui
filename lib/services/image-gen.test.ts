import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({ requestUrl: vi.fn() }));

import { isGeminiImageModel } from "./image-gen";

describe("isGeminiImageModel", () => {
  it("keeps the models that make images by generateContent", () => {
    for (const name of [
      "gemini-3.1-flash-image",
      "gemini-3-pro-image",
      "gemini-nano-banana-2.1",
      "gemini-2.5-flash-image",
    ])
      expect(isGeminiImageModel(name)).toBe(true);
  });

  it("drops text, speech, embedding, video and Imagen models", () => {
    for (const name of [
      "gemini-3.8-flash",
      "gemini-2.5-pro-tts",
      "gemini-embedding-001",
      "veo-3.1-generate-001",
      "imagen-4.0-generate-001",
    ])
      expect(isGeminiImageModel(name)).toBe(false);
  });
});
