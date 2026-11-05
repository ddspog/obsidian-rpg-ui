/**
 * The Log mixed into the prose: which entries go under which passage.
 *
 * With no margin beside the prose for the Log, its entries are drawn in the prose instead, each
 * run of them under the passage it led to: a passage's own entries (the roll whose `=>` it tells)
 * and those after it, up to the next passage. Entries before the first passage go at the top.
 * Pure: ProseView asks for each place's run by its key.
 */

import type { ProseNode, ProseScene, SidebarItem } from "./prose-model";

/** Where a run of entries goes: before everything, after a scene's heading, or after a passage. */
export const TRAIL_START = "start";
export const headTrailKey = (scene: number) => `head:${scene}`;
export const nodeTrailKey = (scene: number, node: number) => `node:${scene}:${node}`;

/** The source lines a passage tells (a fight: every one in it), lowest first. */
export function nodeSourceIds(node: ProseNode): number[] {
  switch (node.kind) {
    case "paragraph":
    case "beat":
      return node.fragments.map((f) => f.sourceId);
    case "combat":
      return [node.sourceId, ...node.nodes.flatMap(nodeSourceIds)];
    default:
      return "sourceId" in node && typeof node.sourceId === "number" ? [node.sourceId] : [];
  }
}

/**
 * The entries in runs by where they go. Each place starts at the lowest source line it tells, in
 * reading order; an entry goes to the last place that starts at or before it.
 */
export function logTrails(scenes: ProseScene[], items: SidebarItem[]): Map<string, SidebarItem[]> {
  const places: Array<{ key: string; start: number }> = [];
  scenes.forEach((scene, si) => {
    if (scene.head?.sourceId != null) places.push({ key: headTrailKey(si), start: scene.head.sourceId });
    scene.nodes.forEach((node, ni) => {
      const ids = nodeSourceIds(node);
      if (ids.length > 0) places.push({ key: nodeTrailKey(si, ni), start: Math.min(...ids) });
    });
  });
  // a place can't start before the one it follows (a later passage telling an early roll)
  let floor = -Infinity;
  for (const p of places) {
    p.start = Math.max(p.start, floor);
    floor = p.start;
  }
  const out = new Map<string, SidebarItem[]>();
  for (const item of items) {
    let at = TRAIL_START;
    for (const p of places) {
      if (p.start <= item.id) at = p.key;
      else break;
    }
    const run = out.get(at);
    if (run) run.push(item);
    else out.set(at, [item]);
  }
  return out;
}
