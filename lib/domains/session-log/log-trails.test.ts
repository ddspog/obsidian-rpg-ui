import { describe, expect, it } from "vitest";
import { headTrailKey, logTrails, nodeTrailKey, TRAIL_START } from "./log-trails";
import type { ProseScene, SidebarItem } from "./prose-model";

const item = (id: number): SidebarItem => ({ id, kind: "action", rows: [] });
const para = (...ids: number[]) => ({
  kind: "paragraph" as const,
  fragments: ids.map((sourceId) => ({ text: `t${sourceId}`, sourceId })),
});
const ids = (m: Map<string, SidebarItem[]>, key: string) => (m.get(key) ?? []).map((i) => i.id);

describe("logTrails", () => {
  it("puts each entry under the passage it led to, and the ones after it up to the next passage", () => {
    const scenes: ProseScene[] = [{ nodes: [para(2), para(5)] } as ProseScene];
    const m = logTrails(scenes, [1, 2, 3, 4, 5, 6].map(item));
    expect(ids(m, TRAIL_START)).toEqual([1]);
    expect(ids(m, nodeTrailKey(0, 0))).toEqual([2, 3, 4]);
    expect(ids(m, nodeTrailKey(0, 1))).toEqual([5, 6]);
  });

  it("starts a scene's run after its heading when the heading came from an entry", () => {
    const scenes: ProseScene[] = [
      { nodes: [para(1)] } as ProseScene,
      { head: { number: "S2", context: "Next", sourceId: 3, fromConsequence: true }, nodes: [para(5)] } as ProseScene,
    ];
    const m = logTrails(scenes, [1, 2, 3, 4, 5].map(item));
    expect(ids(m, nodeTrailKey(0, 0))).toEqual([1, 2]);
    expect(ids(m, headTrailKey(1))).toEqual([3, 4]);
    expect(ids(m, nodeTrailKey(1, 0))).toEqual([5]);
  });

  it("counts every line a fight tells as the fight's", () => {
    const scenes: ProseScene[] = [
      {
        nodes: [
          para(1),
          {
            kind: "combat",
            sourceId: 3,
            nodes: [{ kind: "beat", actor: "Talon", fragments: [{ text: "hits", sourceId: 4 }] }],
          },
          para(8),
        ],
      } as ProseScene,
    ];
    const m = logTrails(scenes, [1, 2, 3, 4, 6, 8].map(item));
    expect(ids(m, nodeTrailKey(0, 0))).toEqual([1, 2]);
    expect(ids(m, nodeTrailKey(0, 1))).toEqual([3, 4, 6]);
    expect(ids(m, nodeTrailKey(0, 2))).toEqual([8]);
  });

  it("keeps reading order when a later passage tells an earlier roll", () => {
    const scenes: ProseScene[] = [{ nodes: [para(4), para(2)] } as ProseScene];
    const m = logTrails(scenes, [2, 4, 5].map(item));
    expect(ids(m, TRAIL_START)).toEqual([2]);
    expect(ids(m, nodeTrailKey(0, 1))).toEqual([4, 5]);
  });

  it("puts everything at the top when there is no prose", () => {
    const m = logTrails([], [1, 2].map(item));
    expect(ids(m, TRAIL_START)).toEqual([1, 2]);
  });
});
