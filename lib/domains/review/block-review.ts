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

const ORDER: Record<BlockReviewSeverity, number> = { fix: 0, check: 1, note: 2 };
const LABEL: Record<BlockReviewSeverity, string> = { fix: "To fix", check: "To check", note: "Note" };
const FUNCTION: Record<string, string> = { roll: "Rolling is off" };

/** The review's banner: worst first, each item with what it turns off. */
export function renderBlockReview(doc: Document, reviews: BlockReview[]): HTMLElement {
  const sorted = [...reviews].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  const box = doc.createElement("div");
  box.classList.add("rpg-block-review", `rpg-block-review--${sorted[0].severity}`);
  box.setAttribute("role", "note");
  box.setAttribute("aria-label", "Review of this block");
  for (const review of sorted) {
    const item = doc.createElement("div");
    item.classList.add("rpg-block-review__item", `rpg-block-review__item--${review.severity}`);
    const tag = doc.createElement("span");
    tag.classList.add("rpg-block-review__tag");
    tag.textContent = LABEL[review.severity];
    item.appendChild(tag);
    const text = doc.createElement("span");
    text.classList.add("rpg-block-review__text");
    text.textContent = review.message;
    item.appendChild(text);
    for (const fn of review.off) {
      const off = doc.createElement("span");
      off.classList.add("rpg-block-review__off");
      off.textContent = FUNCTION[fn] ?? `${fn} is off`;
      item.appendChild(off);
    }
    box.appendChild(item);
  }
  return box;
}

/**
 * Keeps the banner at the top of a block's element, whatever the block's own renderer does to it
 * (most empty their element and fill it, some later and more than once). Returns the function that
 * stops watching.
 */
export function keepBlockReview(el: HTMLElement, reviews: BlockReview[]): () => void {
  const banner = renderBlockReview(el.ownerDocument, reviews);
  el.classList.add(
    "rpg-block-reviewed",
    `rpg-block-reviewed--${banner.classList[1].replace("rpg-block-review--", "")}`
  );
  const place = () => {
    if (el.firstChild !== banner) el.insertBefore(banner, el.firstChild);
  };
  place();
  const View = el.ownerDocument.defaultView;
  if (!View || !("MutationObserver" in View)) return () => undefined;
  const watch = new (View as unknown as { MutationObserver: typeof MutationObserver }).MutationObserver(place);
  watch.observe(el, { childList: true });
  return () => watch.disconnect();
}
