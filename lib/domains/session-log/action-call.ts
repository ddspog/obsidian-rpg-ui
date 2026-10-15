/**
 * An action, written as a call on the page of the creature that takes it:
 *
 *   @(Kobold, Elite) @[[Kobold, Elite]].action("Mining Pick") → Kowyn
 *   @(Talon) @[[Talon Pallton|Talon]].action("Dash")
 *
 * The page is the actor's own — a statblock, a character sheet — so any action
 * can be named this way, whether or not a note of its own describes it. The Log
 * shows it as the actor (once, as a link) and the action, whose description —
 * as that creature has it, its own numbers filled in — shows on hover.
 */

/** `@[[Page|Label]].action("Name")` — the page, an optional label, the action. */
export const ACTION_CALL_RE = /@\[\[([^\]\n]+)\]\]\.action\(\s*(?:"([^"\n]*)"|'([^'\n]*)'|([^)"'\n]*?))\s*\)/g;

export interface ActionCall {
  /** The actor's page, as linked (`Talon Pallton`, `Kobold, Elite`). */
  page: string;
  /** What the actor is shown as (`Talon`) — the link's alias, else the page. */
  label: string;
  /** The action's name (`Mining Pick`). */
  name: string;
  /** Where it sits in the text. */
  start: number;
  end: number;
}

/** Every action call in a text, in order. */
export function findActionCalls(text: string): ActionCall[] {
  const out: ActionCall[] = [];
  for (const m of text.matchAll(new RegExp(ACTION_CALL_RE.source, "g"))) {
    const [target, alias] = m[1].split("|");
    const page = target.split("#")[0].trim();
    out.push({
      page,
      label: (alias ?? page).trim(),
      name: (m[2] ?? m[3] ?? m[4] ?? "").trim(),
      start: m.index!,
      end: m.index! + m[0].length,
    });
  }
  return out;
}

/** The action call a text opens with, if it opens with one. */
export function leadingActionCall(text: string): ActionCall | undefined {
  const first = findActionCalls(text)[0];
  return first && text.slice(0, first.start).trim() === "" ? first : undefined;
}

/**
 * Write an action as a call on its actor's page — labelled with the name the
 * log knows the actor by, when the page is called something else.
 */
export function actionCall(page: string, name: string, label?: string): string {
  const alias = label && label !== page ? `|${label}` : "";
  const quoted = name.includes('"') ? `'${name}'` : `"${name}"`;
  return `@[[${page}${alias}]].action(${quoted})`;
}

/**
 * The target an action line names — after its `→`, and before any `with …`
 * a rider adds (`Shortbow → Fat Kobold, A with @[[…]].action("Mystic Mark")`).
 */
export function actionTarget(text: string): string | undefined {
  const after = text.match(/→\s*(.+?)\s*$/)?.[1];
  return after?.replace(/\s+with\s+.*$/, "").trim() || undefined;
}
