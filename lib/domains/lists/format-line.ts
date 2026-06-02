/**
 * Format one list line by interpolating `${field}` expressions in an entry's
 * `format` template against a resolved record's fields.
 *
 * Reuses the shared `interpolateParams` helper (dot-path resolution, missing
 * fields → empty string). The returned string is markdown — it may contain
 * `[[wikilinks]]` and inline markup, rendered later via `<Markdown>`.
 */

import { interpolateParams } from "lib/domains/references/interpolate-params";

export function formatLine(format: string, fields: Record<string, unknown>): string {
  const out = interpolateParams({ __line: format }, fields);
  return typeof out.__line === "string" ? out.__line : String(out.__line ?? "");
}
