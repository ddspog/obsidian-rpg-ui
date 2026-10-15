/**
 * GM feature body.
 *
 * Renders a `feature.gm` block's `body` — authored as `rpg log` content (prose
 * narration + lonelog mechanics) — exactly like a live `rpg log`: narrated prose
 * with a toggleable "Log" panel in the page margin (via the shared
 * `ProseLogLayout`).
 *
 * INTERACTIVE scratch copy: the body is a worked example, but the reader can
 * still test it — the lonelog string is held as component state (a temp
 * "shadow", seeded from the resolved body and reset when the source changes).
 * Typing a die value re-resolves the whole body through the feature's
 * generators/steps (`applyDieEdit` + `resolveGmBody`), and picking a dropdown
 * option inserts its line (`applyChoicePick`); neither touches the source
 * markdown. Dial ops (`[<abbr>±n]`) compute running values from `decls`.
 */

import * as React from "react";
import type { GMFeature } from "lib/domains/features/types";
import {
  applyDieEdit,
  expandStepBlockGens,
  gmStepLines,
  resolveGmBody,
  type GMStepContext,
} from "lib/domains/gm/example";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { resolveDialOps, resourceDefaults, type DialDecl } from "lib/domains/lonelog/dial-ops";
import { resolveListOps } from "lib/domains/lonelog/list-ops";
import { groupIntoProse } from "lib/domains/session-log/prose-grouper";
import { assembleProse, buildSidebarItems } from "lib/domains/session-log/prose-model";
import { applyChoicePick } from "lib/domains/session-log/choice";
import { ProseLogLayout } from "./prose-log-layout";

export function GMFeatureBody({
  feature,
  sourcePath,
  stepCtx,
  decls,
}: {
  feature: GMFeature;
  sourcePath?: string;
  /** Cross-file step blocks / generators the body's branches resolve to (loaded
   *  by the view) — drives re-resolution, dropdowns, and `calls:` children. */
  stepCtx?: GMStepContext;
  /** Resource registry (session by abbr, PC by name) so `[<abbr>±n]` /
   *  `[<PC>/<name>±n]` ops in the body compute a running value. */
  decls?: Record<string, DialDecl>;
}) {
  const sp = sourcePath ?? "";

  // The resolved body is the seed; the scratch copy accumulates the reader's
  // rolls. Reset whenever the source body / loaded context changes.
  const initial = React.useMemo(
    () => resolveGmBody(expandStepBlockGens(feature.body ?? "", [feature], stepCtx), [feature], stepCtx),
    [feature, stepCtx]
  );
  const [log, setLog] = React.useState(initial);
  React.useEffect(() => setLog(initial), [initial]);

  const followLines = React.useMemo(() => gmStepLines(feature, stepCtx), [feature, stepCtx]);
  const entries = React.useMemo(() => parseLonelog(log), [log]);
  const segments = React.useMemo(() => groupIntoProse(entries), [entries]);
  const dialOps = React.useMemo(() => resolveDialOps(entries, decls ?? {}), [entries, decls]);
  const listOps = React.useMemo(() => resolveListOps(entries, stepCtx?.lists ?? {}), [entries, stepCtx]);
  const items = React.useMemo(
    () => buildSidebarItems(segments, dialOps, listOps, resourceDefaults(decls ?? {})),
    [segments, dialOps, listOps, decls]
  );
  const scenes = React.useMemo(() => assembleProse(segments), [segments]);

  if (items.length === 0 && scenes.length === 0) return null;

  return (
    <ProseLogLayout
      scenes={scenes}
      sidebarItems={items}
      sourcePath={sp}
      dieEdits={{}}
      onDieChange={(source, raw, _slot, value) =>
        setLog((l) => resolveGmBody(applyDieEdit(l, source, raw, value, feature, stepCtx), [feature], stepCtx))
      }
      onChoice={(selected) =>
        setLog((l) => resolveGmBody(applyChoicePick(l, selected, followLines), [feature], stepCtx))
      }
      onTokenChange={(source, from, to, nth) =>
        setLog((l) => {
          // Match by occurrence: identical lines are common in a demo log, so
          // rewriting every text match would move all their dice in lockstep.
          let seen = 0;
          return l
            .split("\n")
            .map((line) => (line.trim() === source && seen++ === nth ? line.replace(from, to) : line))
            .join("\n");
        })
      }
    />
  );
}
