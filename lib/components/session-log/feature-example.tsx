/**
 * Feature example simulator.
 *
 * Renders a feature's example the way the session log shows entries — the
 * mechanical lines via the SAME `SidebarEntry` renderer the Log sidebar uses
 * (identical icons, dice glyphs, datelines), with the narrated prose beneath.
 *
 * The lonelog string IS the editable state, so the whole excerpt plays around
 * correctly: typing a die value re-resolves that line's result through the
 * feature's interpret/follow (`applyDieEdit`), and picking a follow strategy
 * inserts its generated line (`applyChoicePick`). Both mutate the log in place
 * and persist — the same model the live session log uses. Scenes stay read-only.
 */

import * as React from "react";
import type { GMFeature } from "lib/domains/features/types";
import { buildGMExampleLog, gmStepLines, applyDieEdit, type GMStepContext } from "lib/domains/gm/example";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "lib/domains/session-log/prose-grouper";
import { assembleProse, buildSidebarItems } from "lib/domains/session-log/prose-model";
import { applyChoicePick } from "lib/domains/session-log/choice";
import { InlineMarkdown } from "./inline-markdown";
import { SidebarEntry, type SidebarEditContext } from "./sidebar-entry";

export function FeatureExample({
  feature,
  sourcePath,
  stepCtx,
}: {
  feature: GMFeature;
  sourcePath?: string;
  /** Cross-file step blocks the feature's branch links resolve to (loaded by
   *  the view). Drives the dropdown options and the pick-to-insert lines. */
  stepCtx?: GMStepContext;
}) {
  const sp = sourcePath ?? "";
  const followLines = React.useMemo(() => gmStepLines(feature, stepCtx), [feature, stepCtx]);
  const initial = React.useMemo(() => buildGMExampleLog(feature, stepCtx) ?? "", [feature, stepCtx]);

  // The lonelog string is the mutable state; edits accumulate in it.
  const [log, setLog] = React.useState(initial);
  React.useEffect(() => setLog(initial), [initial]);

  const segments = React.useMemo(() => groupIntoProse(parseLonelog(log)), [log]);
  const items = React.useMemo(() => buildSidebarItems(segments), [segments]);
  const scenes = React.useMemo(() => assembleProse(segments), [segments]);

  // Editable dice (typing re-resolves the result); scenes read-only (no
  // onSceneChange); the dropdown writes through onChoice (not onResultChange).
  const edit: SidebarEditContext = {
    dieEdits: {},
    onDieChange: (source, raw, _slot, value) => setLog((l) => applyDieEdit(l, source, raw, value, feature, stepCtx)),
    onResultChange: () => {},
  };

  // Narrated prose: scene-head contexts + paragraph / narration / dialogue nodes.
  const proseLines: string[] = [];
  for (const scene of scenes) {
    if (scene.head?.context) proseLines.push(scene.head.context);
    for (const node of scene.nodes) {
      if (node.kind === "paragraph") proseLines.push(node.fragments.map((f) => f.text).join(" "));
      else if (node.kind === "narration") proseLines.push(node.text);
      else if (node.kind === "dialogue") proseLines.push(`**${node.speaker}:** ${node.text}`);
    }
  }

  if (items.length === 0 && proseLines.length === 0) return null;

  return (
    <section className="lonelog-feature-example" aria-label="Example">
      <span className="lonelog-feature-example-label">Example</span>
      <div className="lonelog-entries">
        {items.map((item) => (
          <SidebarEntry
            key={item.id}
            item={item}
            sourcePath={sp}
            edit={edit}
            onChoice={(selected) => setLog((l) => applyChoicePick(l, selected, followLines))}
          />
        ))}
      </div>
      {proseLines.length > 0 && (
        <div className="lonelog-feature-example-prose">
          {proseLines.map((line, i) => (
            <p key={i}>
              <InlineMarkdown source={line} sourcePath={sp} />
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
