/** One question to the Anthropic-compatible endpoint of the plugin's settings, its text answer back. */

import { requestUrl } from "obsidian";

export interface AnthropicEndpoint {
  anthropicUrl: string;
  anthropicKey: string;
  anthropicModel: string;
}

export const hasAnthropic = (s: AnthropicEndpoint): boolean => !!s.anthropicUrl?.trim() && !!s.anthropicModel?.trim();

export async function anthropicText(
  s: AnthropicEndpoint,
  system: string,
  user: string,
  maxTokens = 4000
): Promise<string> {
  if (!hasAnthropic(s))
    throw new Error("No Anthropic link set: add one in the plugin's settings (Images › Anthropic).");
  const res = await requestUrl({
    url: `${s.anthropicUrl.trim().replace(/\/+$/, "")}/v1/messages`,
    method: "POST",
    contentType: "application/json",
    headers: { "anthropic-version": "2023-06-01", ...(s.anthropicKey ? { "x-api-key": s.anthropicKey } : {}) },
    body: JSON.stringify({
      model: s.anthropicModel,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
    throw: false,
  });
  if (res.status >= 400) throw new Error(`Anthropic answered ${res.status}: ${res.text.slice(0, 300)}`);
  return ((res.json?.content ?? []) as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}
