/**
 * Public API surface for the rule-value resolver. System config code
 * imports these from `"rpg-ui-toolkit"`:
 *
 *   import { getRuleValue } from "rpg-ui-toolkit";
 *
 *   attributes: {
 *     luck: { max: () => getRuleValue<number>("luck", "max", { fallback: 5 }) },
 *   }
 *
 * Internally these delegate to a module-level "active resolver" set by
 * the plugin at load time. Decouples the system bundle (which can't
 * easily hold a long-lived plugin reference) from the resolver instance.
 */

import { ValueResolver, type GetValueOpts } from "./value-resolver";
export { ValueResolver, type GetValueOpts, type FileSource } from "./value-resolver";

let active: ValueResolver | null = null;

/** Called by the plugin at load. System code should not call this. */
export function setActiveValueResolver(resolver: ValueResolver | null): void {
  active = resolver;
}

/**
 * Sync lookup of a value declared in a `rpg rule.content` block's
 * frontmatter `values:` map. Returns `opts.fallback` (or `undefined`)
 * before the resolver's warmup has finished, or when the id / path
 * doesn't exist.
 */
export function getRuleValue<T = unknown>(id: string, path: string, opts?: GetValueOpts<T>): T | undefined {
  return active ? active.getValue<T>(id, path, opts) : opts?.fallback;
}

/** All values for a single id, or undefined when not indexed. */
export function getRuleValuesById(id: string): Record<string, unknown> | undefined {
  return active?.getValuesById(id);
}

/** Snapshot of every indexed id → values pair. For debugging. */
export function listRuleValues(): Map<string, Record<string, unknown>> {
  return active?.list() ?? new Map();
}
