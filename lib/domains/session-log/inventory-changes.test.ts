import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import { collectInventoryChanges, isGain } from "./inventory-changes";

const changes = (body: string) => collectInventoryChanges(groupIntoProse(parseLonelog(body)));

describe("collectInventoryChanges — who got what", () => {
  it("gives the item to the actor whose action the line resolves", () => {
    const body = [
      "@(Talon) Received [[Kowyn's Bag]] from Kobold.",
      "=> I began to think of what we might gain. [Inv:[[Kowyn's Bag]]+1]",
    ].join("\n");
    expect(changes(body)).toEqual([
      { owner: "Talon", name: "Kowyn's Bag", link: true, delta: 1, depleted: false, sources: [0] },
    ]);
  });

  it("lets an Owner/ prefix win over the actor", () => {
    const body = ["@(Talon) I hand Lilith the rope", "=> She ties it off. [Inv:Lilith/Rope+1]"].join("\n");
    expect(changes(body)[0]).toMatchObject({ owner: "Lilith", name: "Rope" });
  });

  it("files a standalone tag, or a group action's, under the party", () => {
    expect(changes("[Inv:Torch|3]")[0]).toMatchObject({ owner: undefined, quantity: 3 });
    expect(changes("@(Talon+Lilith) We loot the cart\n=> Rations. [Inv:Rations+4]")[0].owner).toBeUndefined();
  });

  it("nets repeated mentions of one item into one change", () => {
    const body = ["@(Talon) Light a torch", "=> [Inv:Torch+2]", "@(Talon) Drop one", "=> [Inv:Torch-1]"].join("\n");
    const [torch] = changes(body);
    expect(torch.delta).toBe(1);
    expect(torch.sources).toHaveLength(2);
    expect(isGain(torch)).toBe(true);
  });

  it("treats a net loss or a depleted item as gone", () => {
    expect(isGain(changes("@(Talon) Eat\n=> [Inv:Ration-1]")[0])).toBe(false);
    expect(isGain(changes("[Inv:Rope|depleted]")[0])).toBe(false);
  });
});
