/**
 * The image studio's calls out: an image from a prompt (a Gemini-compatible
 * endpoint, or an Ollama server's image model), and a prompt's subject drafted
 * from a note (an Anthropic-compatible endpoint). Every link is the user's —
 * a local proxy, or the provider itself — set in the plugin's settings.
 */

import { requestUrl } from "obsidian";
import type { ImageStudioSettings } from "settings";

export interface GeneratedImage {
  /** The image's bytes, and what kind it is (`image/png`). */
  data: ArrayBuffer;
  mime: string;
}

const trim = (url: string) => url.trim().replace(/\/+$/, "");

function fromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** The aspect ratios an image can be asked for. */
export const ASPECTS = ["1:1", "3:4", "4:3", "9:16", "16:9"] as const;
export type Aspect = (typeof ASPECTS)[number];

/** An image from a prompt, by the provider the settings pick. */
export async function generateImage(
  settings: ImageStudioSettings,
  prompt: string,
  aspect: Aspect = "1:1"
): Promise<GeneratedImage> {
  if (settings.imageProvider === "ollama") return ollamaImage(settings, prompt);
  return geminiImage(settings, prompt, aspect);
}

async function geminiImage(s: ImageStudioSettings, prompt: string, aspect: Aspect): Promise<GeneratedImage> {
  if (!s.geminiUrl.trim()) throw new Error("No Gemini link set — add one in the plugin's settings.");
  const res = await requestUrl({
    url: `${trim(s.geminiUrl)}/v1beta/models/${encodeURIComponent(s.geminiImageModel)}:generateContent`,
    method: "POST",
    contentType: "application/json",
    headers: s.geminiKey ? { "x-goog-api-key": s.geminiKey } : {},
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageConfig: { aspectRatio: aspect } },
    }),
    throw: false,
  });
  if (res.status >= 400) throw new Error(`Gemini answered ${res.status}: ${res.text.slice(0, 300)}`);
  const parts = (res.json?.candidates?.[0]?.content?.parts ?? []) as Array<{
    inlineData?: { mimeType?: string; data?: string };
    text?: string;
  }>;
  const image = parts.find((p) => p.inlineData?.data);
  if (!image?.inlineData?.data) {
    const said = parts
      .map((p) => p.text)
      .filter(Boolean)
      .join(" ");
    throw new Error(`No image came back${said ? `: ${said.slice(0, 300)}` : "."}`);
  }
  return { data: fromBase64(image.inlineData.data), mime: image.inlineData.mimeType ?? "image/png" };
}

async function ollamaImage(s: ImageStudioSettings, prompt: string): Promise<GeneratedImage> {
  if (!s.ollamaUrl.trim()) throw new Error("No Ollama link set — add one in the plugin's settings.");
  if (!s.ollamaImageModel.trim()) throw new Error("No Ollama image model set — name one in the plugin's settings.");
  const res = await requestUrl({
    url: `${trim(s.ollamaUrl)}/api/generate`,
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({ model: s.ollamaImageModel, prompt, stream: false }),
    throw: false,
  });
  if (res.status >= 400) throw new Error(`Ollama answered ${res.status}: ${res.text.slice(0, 300)}`);
  // Its image models answer with the picture in `image` (or `images`), base64.
  const b64 = (res.json?.image ?? res.json?.images?.[0]) as string | undefined;
  if (!b64) throw new Error("No image came back — is the model an image model?");
  return { data: fromBase64(b64), mime: "image/png" };
}

/** A one-sentence visual subject for an image of `what`, drafted from the note's text. */
export async function draftSubject(s: ImageStudioSettings, what: string, context: string): Promise<string> {
  if (!s.anthropicUrl.trim()) throw new Error("No Anthropic link set — add one in the plugin's settings.");
  const res = await requestUrl({
    url: `${trim(s.anthropicUrl)}/v1/messages`,
    method: "POST",
    contentType: "application/json",
    headers: { "anthropic-version": "2023-06-01", ...(s.anthropicKey ? { "x-api-key": s.anthropicKey } : {}) },
    body: JSON.stringify({
      model: s.anthropicModel,
      max_tokens: 200,
      system:
        "You write the subject line of a prompt for a fantasy RPG icon or illustration. Answer with ONE short visual " +
        "description (under 30 words) of a single central subject — concrete objects, materials, light, colour. " +
        "No style words, no camera words, no text in the image, no preamble.",
      messages: [{ role: "user", content: `Subject: ${what}\n\nWhat it is:\n${context.slice(0, 4000)}` }],
    }),
    throw: false,
  });
  if (res.status >= 400) throw new Error(`Anthropic answered ${res.status}: ${res.text.slice(0, 300)}`);
  const text =
    ((res.json?.content ?? []) as Array<{ type: string; text?: string }>).find((b) => b.type === "text")?.text ?? "";
  return text
    .trim()
    .replace(/^subject:\s*/i, "")
    .replace(/^["']|["']$/g, "");
}
