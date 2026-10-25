/**
 * Card frames drawn in CSS: the plain frame's look (the default here, or a
 * kind's own edit of it) and CSS the model writes from a kind's style prompt
 * (the same one an image frame is painted from). Both are written for four
 * short selectors and rewritten here to that kind's frame alone; anything else
 * is dropped. The layout they sit on is in card-frame.css.
 */

import { requestUrl } from "obsidian";
import type { ImageStudioSettings } from "settings";
import { FRAME_KINDS, type CardFrameSettings, type FrameKind, type FrameKindInfo } from "lib/services/card-frame-config";

/** The plain frame's look: gold filigree on deep violet, a name plaque. Each kind can edit its own. */
export const DEFAULT_FRAME_CSS = `.frame {
  --frame-gold-light: #f6dd92;
  --frame-gold: #a67c1d;
  --frame-gold-dark: #6f4f12;
  --frame-violet: #3b1650;
  --frame-plaque: #14183a;
  padding: 0.16rem;
  border-radius: 0.45rem;
  background: linear-gradient(135deg, var(--frame-gold-light), var(--frame-gold) 35%, var(--frame-gold-light) 55%, var(--frame-gold-dark));
  box-shadow: 0 0.2rem 0.7rem rgba(0, 0, 0, 0.4);
}

.frame .inner {
  padding: 0.1rem;
  border-radius: 0.3rem;
  background: var(--frame-violet);
  box-shadow: inset 0 0 0 1px rgba(246, 221, 146, 0.45);
}

.frame .art {
  border-radius: 0.22rem;
}

.frame .plaque {
  bottom: 0.45rem;
  padding: 0 0.6rem;
  border: 1px solid var(--frame-gold);
  border-radius: 999px;
  background: var(--frame-plaque);
  box-shadow: 0 0 0.3rem rgba(0, 0, 0, 0.6);
  font-family: var(--font-text);
  font-size: 0.7em;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--frame-gold-light);
}`;

/** The selectors the model writes for, and what each one is in the frame. */
const PARTS: [string, string][] = [
  [".frame", "figure.rpg-card-frame"],
  [".inner", ".rpg-card-frame-inner"],
  [".art", ".rpg-card-frame-art"],
  [".plaque", "figcaption.rpg-card-frame-plaque"],
];

/** The class a kind's frame wears when its generated CSS is chosen. */
export const generatedClass = (kind: FrameKind) => `is-gen-${kind}`;

/** Which frame CSS is for: the plain one (any of the kind's frames not wearing the generated class), or the generated one. */
export type FrameCssScope = "plain" | "generated";

/**
 * The kind's frame, as a selector. The plain look carries no weight (`:where`),
 * so the layout's own cases (the slim roster frame, the image frame's plaque) win.
 */
function frameRoot(kind: FrameKind, scope: FrameCssScope): string {
  return scope === "generated"
    ? `figure.rpg-card-frame.${generatedClass(kind)}`
    : `:where(figure.rpg-card-frame.is-${kind}:not(.${generatedClass(kind)}))`;
}

/** One selector, rewritten to the kind's frame; undefined when it isn't the frame's. */
function scopeSelector(sel: string, kind: FrameKind, scope: FrameCssScope): string | undefined {
  const s = sel.trim();
  if (!/^\.frame(?![\w-])/.test(s)) return undefined;
  let out = s.slice(".frame".length);
  for (const [short, real] of PARTS.slice(1)) out = out.replace(new RegExp(`\\${short}(?![\\w-])`, "g"), real);
  return frameRoot(kind, scope) + out;
}

/** A rule's declarations, split on the semicolons outside quotes and brackets (a data: URL has its own). */
function declarations(body: string): string[] {
  const out: string[] = [];
  let depth = 0,
    quote = "",
    from = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      if (c === quote && body[i - 1] !== "\\") quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === ";" && depth === 0) {
      out.push(body.slice(from, i));
      from = i + 1;
    }
  }
  out.push(body.slice(from));
  return out;
}

/**
 * What the layout places, per part (not their ::before / ::after): CSS for the
 * frame's look can't move them, so the plaque stays centred and the art sized.
 */
type LayoutRule = (prop: string, value: string) => boolean;
const props = (re: RegExp): LayoutRule => (prop) => re.test(prop);
const LAYOUT: Record<string, LayoutRule> = {
  ".frame": props(/^(position|display|(min-|max-)?(width|height)|margin(-\w+)?|aspect-ratio|float|overflow(-[xy])?)$/),
  // `position: relative` stays, to anchor the inner ornaments.
  ".inner": (prop, value) =>
    /^(display|width|height|overflow(-[xy])?)$/.test(prop) || (prop === "position" && value !== "relative"),
  ".art": props(/^(position|display|width|height|overflow(-[xy])?|aspect-ratio|transform|filter|opacity)$/),
  ".plaque": props(
    /^(position|left|right|inset(-\w+)?|(min-|max-)?width|transform|translate|margin(-\w+)?|overflow|white-space|text-overflow)$/
  ),
};

/** The layout rule that holds for a selector: that of the part it styles, when it's the part itself. */
function layoutFor(sel: string): LayoutRule | undefined {
  const last = sel.trim().split(/\s+/).pop() ?? "";
  if (last.includes("::") || last.includes(":before") || last.includes(":after")) return undefined;
  const part = PARTS.map(([short]) => short).find((short) => last.startsWith(short));
  return part ? LAYOUT[part] : undefined;
}

/** A rule's declarations, without anything that loads from outside, breaks out of the style, or moves the layout. */
function cleanBody(body: string, layout: LayoutRule[] = []): string {
  return declarations(body)
    .map((d) => d.trim())
    .filter((d) => d && !/url\(\s*(?!["']?data:image\/)/i.test(d) && !/expression\(|javascript:|<\/style/i.test(d))
    .filter((d) => {
      const i = d.indexOf(":");
      const prop = d.slice(0, i).trim().toLowerCase();
      const value = d.slice(i + 1).trim().toLowerCase();
      return !layout.some((l) => l(prop, value));
    })
    .map((d) => `  ${d};`)
    .join("\n");
}

/**
 * The model's CSS, kept to one kind's frame: each rule whose selectors are the
 * frame's (`.frame`, `.frame .inner`, `.frame::before`…) rewritten to it, and
 * at-rules, comments and other selectors dropped.
 */
export function scopeFrameCss(css: string, kind: FrameKind, scope: FrameCssScope = "generated"): string {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: string[] = [];
  const rule = /([^{}@]+)\{([^{}]*)\}/g;
  // At-rules (with or without a block) go first, whole.
  const flat = src.replace(/@[^{};]+;/g, "").replace(/@[^{}]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  for (const m of flat.matchAll(rule)) {
    const selectors = m[1]
      .split(",")
      .map((s) => scopeSelector(s, kind, scope))
      .filter((s): s is string => !!s);
    const layout = m[1]
      .split(",")
      .map(layoutFor)
      .filter((l): l is LayoutRule => !!l);
    const body = cleanBody(m[2], layout);
    if (selectors.length && body) rules.push(`${selectors.join(",\n")} {\n${body}\n}`);
  }
  return rules.join("\n\n");
}

/**
 * Every kind's frame CSS, scoped, as one stylesheet: its plain look (its own
 * edit, or the default) and its generated CSS. The generated CSS is there
 * whether chosen or not: a frame only wears its class when it is (or a preview shows it).
 */
export function frameStylesheet(frames: Partial<Record<FrameKind, CardFrameSettings>> | undefined): string {
  return Object.keys(FRAME_KINDS)
    .flatMap((k) => {
      const kind = k as FrameKind;
      const f = frames?.[kind];
      return [
        scopeFrameCss(f?.plainCss ?? DEFAULT_FRAME_CSS, kind, "plain"),
        f?.css ? scopeFrameCss(f.css, kind, "generated") : "",
      ];
    })
    .filter(Boolean)
    .join("\n\n");
}

const STYLE_ID = "rpg-card-frame-css";

/** Put the frames' CSS on the page (again, after an edit). */
export function applyFrameCss(frames: Partial<Record<FrameKind, CardFrameSettings>> | undefined): void {
  const el =
    (document.getElementById(STYLE_ID) as HTMLStyleElement | null) ??
    document.head.createEl("style", { attr: { id: STYLE_ID } });
  el.textContent = frameStylesheet(frames);
}

/** Take the page's frame CSS away (the plugin unloading). */
export function removeFrameCss(): void {
  document.getElementById(STYLE_ID)?.remove();
}

/** What the model is told: the frame's markup, what it may write, and the plain frame to start from. */
function systemPrompt(info: FrameKindInfo, plain: string): string {
  return [
    "You write the CSS for a decorative picture frame in an Obsidian plugin for tabletop RPGs.",
    "The markup, which you cannot change:",
    "<figure class=\"frame\"><div class=\"inner\"><div class=\"art\"><img></div></div><figcaption class=\"plaque\">Name</figcaption></figure>",
    "",
    "The layout, already applied, which you cannot change (declarations for these properties are dropped):",
    ".frame { position: relative; display: block; margin: 0 }  /* its width is the container's; its height follows the art */",
    ".frame .art { overflow: hidden; line-height: 0 }  /* the picture, sized by the block */",
    ".frame .plaque { position: absolute; left: 50%; transform: translateX(-50%); max-width: 85%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }",
    "",
    "Rules:",
    "- Use only selectors that start with .frame: .frame, .frame .inner, .frame .art, .frame .plaque, and ::before / ::after on any of them.",
    "- Style the look only: padding, border, border-radius, background, box-shadow, outline, colour and font. For .plaque you may set bottom, padding and the look; it's centred for you.",
    "- The art is the picture: never cover it, tint it or change its size. Ornaments may overlap the art's edge by at most 0.3rem.",
    "- The frame is drawn from 3rem wide (a roster face) to 28rem (a spell card); keep borders thin (under 0.4rem) and corner ornaments small (under 1.2rem).",
    "- Ornaments (::before / ::after, position: absolute) must stay inside the frame's box: place them with top/right/bottom/left of 0 or more; never negative offsets. Flip or rotate them with transform-origin: center, never an edge.",
    "- Draw with gradients, borders, box-shadows, outlines and pseudo-elements; inline SVG as url(\"data:image/svg+xml,...\") for fine ornament. No other url(), no @import, no @font-face, no animations, no !important.",
    "- Use Obsidian's font variables (var(--font-text), var(--font-interface)) for text.",
    `- The frame is for: ${info.label} (${info.aspect}).`,
    "",
    "The plain frame it replaces, for reference:",
    plain,
    "",
    "Answer with the CSS only, in one ```css block, no explanation.",
  ].join("\n");
}

/** CSS for a kind's frame, written by the model from its style prompt — or its current CSS, changed as asked. */
export async function draftFrameCss(
  s: ImageStudioSettings,
  info: FrameKindInfo,
  style: string,
  plain: string = DEFAULT_FRAME_CSS,
  /** CSS to change, and what to change in it: a revision rather than a new frame. */
  revise?: { css: string; change: string }
): Promise<string> {
  if (!s.anthropicUrl.trim()) throw new Error("No Anthropic link set — add one in the image studio settings.");
  const res = await requestUrl({
    url: `${s.anthropicUrl.trim().replace(/\/+$/, "")}/v1/messages`,
    method: "POST",
    contentType: "application/json",
    headers: { "anthropic-version": "2023-06-01", ...(s.anthropicKey ? { "x-api-key": s.anthropicKey } : {}) },
    body: JSON.stringify({
      model: s.anthropicModel,
      max_tokens: 4000,
      system: systemPrompt(info, plain),
      messages: [
        {
          role: "user",
          content: revise
            ? `The frame should look like: ${style}\n\nIts CSS now:\n\`\`\`css\n${revise.css}\n\`\`\`\n\nChange it: ${revise.change}\nAnswer with the whole CSS, changed.`
            : `The frame should look like: ${style}`,
        },
      ],
    }),
    throw: false,
  });
  if (res.status >= 400) throw new Error(`Anthropic answered ${res.status}: ${res.text.slice(0, 300)}`);
  const text =
    ((res.json?.content ?? []) as Array<{ type: string; text?: string }>).find((b) => b.type === "text")?.text ?? "";
  const css = (text.match(/```(?:css)?\s*\n([\s\S]*?)```/)?.[1] ?? text).trim();
  if (!scopeFrameCss(css, info.id)) throw new Error("The answer had no CSS for the frame. Try again.");
  return css;
}
