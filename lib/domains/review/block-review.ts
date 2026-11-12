/**
 * A block's review: what a person should look at in it before trusting it, written into the block
 * by whatever made it (the PDF import) as lines at the top of its body:
 *
 *   # @review fix roll: No row for 4 of the d6 (the book's page 12).
 *   # @review check: Row 5-8 was widened to 5-9; the book may skip 9, or the row may be lost.
 *
 * Each line is a YAML comment, so a block's YAML reads the same with or without them, and code that
 * reads blocks straight from a note's text is not disturbed. (`@review …` without the `# ` is read too.)
 *
 * The severity is `fix` (wrong as written), `check` (compare with the book) or `note`, and may name
 * the kind of item after a slash (`fix/table-numbers`), for tools that gather the reviews. After it,
 * before the colon, the block's functions that do not work until the item is dealt with (`roll`);
 * the block still shows all it can. Deleting the line once it is dealt with turns them back on.
 */

export type BlockReviewSeverity = "fix" | "check" | "note";

export interface BlockReview {
  severity: BlockReviewSeverity;
  /** What sort of item it is (`table-numbers`), when the line names one. */
  kind?: string;
  /** Functions of the block turned off (`roll`). */
  off: string[];
  message: string;
}

const LINE = /^(?:#\s*)?@review\s+(fix|check|note)(?:\/([a-z][a-z-]*))?\b([^:]*):\s*(.*)$/i;

/** One `@review` line, or null when the line is not one. */
export function parseReviewLine(line: string): BlockReview | null {
  const m = line.trim().match(LINE);
  if (!m) return null;
  const off = m[3]
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return {
    severity: m[1].toLowerCase() as BlockReviewSeverity,
    ...(m[2] ? { kind: m[2].toLowerCase() } : {}),
    off,
    message: m[4].trim(),
  };
}

/** The `@review` lines at the top of a block's body, and the body without them. */
export function takeBlockReview(source: string): { reviews: BlockReview[]; source: string } {
  const lines = source.split("\n");
  const reviews: BlockReview[] = [];
  let i = 0;
  for (; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const review = parseReviewLine(lines[i]);
    if (!review) break;
    reviews.push(review);
  }
  if (!reviews.length) return { reviews, source };
  return { reviews, source: lines.slice(i).join("\n") };
}

/** The line that writes a review into a block. */
export function reviewLine(review: BlockReview): string {
  const off = review.off.length ? ` ${review.off.join(",")}` : "";
  const kind = review.kind ? `/${review.kind}` : "";
  return `# @review ${review.severity}${kind}${off}: ${review.message.replace(/\s*\n\s*/g, " ")}`;
}

/** Why a function of the block is off, or null when it is on. */
export function offReason(reviews: BlockReview[] | undefined, fn: string): string | null {
  const hit = (reviews ?? []).filter((r) => r.off.includes(fn));
  return hit.length ? hit.map((r) => r.message).join(" ") : null;
}

/** A review's message in two: the problem (with its page), and what to do about it, if it says. */
export function splitMessage(message: string): { problem: string; todo?: string } {
  const at = message.search(/\bWhat to do:\s*/i);
  if (at < 0) return { problem: message.trim() };
  const rest = message
    .slice(at)
    .replace(/^What to do:\s*/i, "")
    .trim();
  const todo = rest.charAt(0).toUpperCase() + rest.slice(1);
  return { problem: message.slice(0, at).trim(), ...(todo ? { todo } : {}) };
}

const ORDER: Record<BlockReviewSeverity, number> = { fix: 0, check: 1, note: 2 };
const LABEL: Record<BlockReviewSeverity, string> = { fix: "Fix", check: "Check", note: "Note" };
const COUNT: Record<BlockReviewSeverity, [string, string]> = {
  fix: ["to fix", "to fix"],
  check: ["to check", "to check"],
  note: ["note", "notes"],
};
const ICON: Record<BlockReviewSeverity, string> = { fix: "alert-triangle", check: "help-circle", note: "info" };
const FUNCTION: Record<string, string> = { roll: "Rolling is off" };

/** Draws an icon into an element (Obsidian's `setIcon`); without one, the severity's initial. */
export type IconPainter = (el: HTMLElement, name: string) => void;

let reviewIds = 0;

/**
 * The review of a block, for its foot: an icon and a count that open a card of the items, worst
 * first; each item says what is wrong and on which page, with what to do behind a disclosure.
 */
export function renderBlockReview(doc: Document, reviews: BlockReview[], icon?: IconPainter): HTMLElement {
  const sorted = [...reviews].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  const worst = sorted[0].severity;
  const box = doc.createElement("div");
  box.classList.add("rpg-block-review", `rpg-block-review--${worst}`);

  const counts = (["fix", "check", "note"] as BlockReviewSeverity[])
    .map((sev) => [sev, sorted.filter((r) => r.severity === sev).length] as const)
    .filter(([, n]) => n > 0)
    .map(([sev, n]) => `${n} ${COUNT[sev][n === 1 ? 0 : 1]}`);
  const off = [...new Set(sorted.flatMap((r) => r.off))].map((fn) => FUNCTION[fn] ?? `${fn} is off`);

  const toggle = doc.createElement("button");
  toggle.classList.add("clickable-icon", "rpg-block-review__toggle");
  toggle.type = "button";
  const id = `rpg-block-review-${++reviewIds}`;
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", id);
  const mark = doc.createElement("span");
  mark.classList.add("rpg-block-review__icon");
  mark.setAttribute("aria-hidden", "true");
  if (icon) icon(mark, ICON[worst]);
  else mark.textContent = worst === "fix" ? "!" : worst === "check" ? "?" : "i";
  toggle.appendChild(mark);
  const summary = doc.createElement("span");
  summary.classList.add("rpg-block-review__summary");
  summary.textContent = `Import review: ${[...counts, ...off].join(" · ")}`;
  toggle.appendChild(summary);
  box.appendChild(toggle);

  const card = doc.createElement("div");
  card.classList.add("rpg-block-review__card");
  card.id = id;
  card.hidden = true;
  for (const review of sorted) {
    const { problem, todo } = splitMessage(review.message);
    const item = doc.createElement("div");
    item.classList.add("rpg-block-review__item", `rpg-block-review__item--${review.severity}`);
    const tag = doc.createElement("span");
    tag.classList.add("rpg-block-review__tag");
    tag.textContent = LABEL[review.severity];
    item.appendChild(tag);
    const body = doc.createElement("div");
    body.classList.add("rpg-block-review__body");
    const text = doc.createElement("p");
    text.classList.add("rpg-block-review__text");
    text.textContent = problem;
    body.appendChild(text);
    if (todo) {
      const how = doc.createElement("details");
      how.classList.add("rpg-block-review__todo");
      const label = doc.createElement("summary");
      label.textContent = "What to do";
      how.appendChild(label);
      const steps = doc.createElement("p");
      steps.textContent = todo;
      how.appendChild(steps);
      body.appendChild(how);
    }
    item.appendChild(body);
    card.appendChild(item);
  }
  box.appendChild(card);

  toggle.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const open = card.hidden;
    card.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    box.classList.toggle("is-open", open);
  });
  return box;
}

/** The element of a block's content that floats (a sidebar at the page's edge), if one does. */
function floated(el: HTMLElement, review: HTMLElement): HTMLElement | null {
  const view = el.ownerDocument.defaultView;
  if (!view) return null;
  const stack: Array<{ node: Element; depth: number }> = Array.from(el.children).map((node) => ({ node, depth: 0 }));
  while (stack.length) {
    const { node, depth } = stack.shift() as { node: Element; depth: number };
    if (node === review || !(node instanceof view.HTMLElement)) continue;
    const float = view.getComputedStyle(node).float;
    if (float && float !== "none") return node;
    if (depth < 3) stack.push(...Array.from(node.children).map((child) => ({ node: child, depth: depth + 1 })));
  }
  return null;
}

/**
 * Keeps the review at the foot of a block's element, whatever the block's own renderer does to
 * it (most empty their element and fill it, some later and more than once); inside the block's
 * frame when the block floats beside the text. Returns the function that stops watching.
 */
export function keepBlockReview(el: HTMLElement, reviews: BlockReview[], icon?: IconPainter): () => void {
  const review = renderBlockReview(el.ownerDocument, reviews, icon);
  el.classList.add("rpg-block-reviewed");
  let placing = false;
  const place = () => {
    if (placing) return;
    placing = true;
    const host = floated(el, review) ?? el;
    if (review.parentElement !== host || host.lastElementChild !== review) host.appendChild(review);
    placing = false;
  };
  place();
  const View = el.ownerDocument.defaultView;
  if (!View || !("MutationObserver" in View)) return () => undefined;
  const watch = new (View as unknown as { MutationObserver: typeof MutationObserver }).MutationObserver(place);
  watch.observe(el, { childList: true, subtree: true });
  return () => watch.disconnect();
}
