/**
 * Stories for the InventoryBlock component (new schema, Phase A).
 *
 * These stories feed the pure component with a pre-resolved `ResolvedInventory`
 * payload — the same shape the view produces after wikilink resolution —
 * so they don't require the Obsidian vault or metadata cache.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { InventoryBlock } from "../../../lib/components/inventory/InventoryBlock";
import {
  classifyLoad,
  computeBands,
  type ResolvedInventory,
  type ResolvedItem,
  type SectionId,
} from "../../../lib/domains/inventory";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

type ItemFixture = Partial<ResolvedItem> & { label: string };

function makeItem(idx: string, base: ItemFixture): ResolvedItem {
  return {
    id: idx,
    label: base.label,
    link: base.link ?? null,
    linkTarget: base.linkTarget ?? null,
    meta: base.meta ?? { weight: 0 },
    qty: base.qty ?? 1,
    totalWeight: base.totalWeight ?? (base.meta?.weight ?? 0) * (base.qty ?? 1),
    equipped: base.equipped ?? false,
    slot: base.slot,
    notes: base.notes,
    isContainer: base.isContainer ?? false,
    contents: base.contents ?? [],
  };
}

function linked(name: string): Pick<ResolvedItem, "link" | "linkTarget"> {
  return { link: `[[${name}]]`, linkTarget: name };
}

function buildInventory(
  bySection: Partial<Record<SectionId, ResolvedItem[]>>,
  opts: {
    strength?: number;
    currency?: ResolvedInventory["currency"];
  } = {}
): ResolvedInventory {
  const sections: ResolvedInventory["sections"] = (
    ["weapons", "armor", "visible", "main_containers", "other_containers"] as SectionId[]
  ).map((id) => {
    const items = bySection[id] ?? [];
    return { id, items, totalWeight: items.reduce((a, i) => a + i.totalWeight, 0) };
  });
  const totalWeight = sections.reduce((a, s) => a + s.totalWeight, 0);
  const strength = opts.strength ?? 14;
  const bands = computeBands(strength);
  return {
    sections,
    currency: opts.currency ?? {},
    totalWeight,
    bands,
    load: classifyLoad(totalWeight, bands),
    strength,
  };
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof InventoryBlock> = {
  title: "Components / Inventory / InventoryBlock",
  component: InventoryBlock,
};
export default meta;

type Story = StoryObj<typeof InventoryBlock>;

// ─── Basic ────────────────────────────────────────────────────────────────────

export const Basic: Story = {
  name: "Basic (weapons + armor + visible)",
  render: () => (
    <InventoryBlock
      data={buildInventory(
        {
          weapons: [
            makeItem("0", {
              label: "Quarterstaff",
              ...linked("Quarterstaff"),
              notes: "SC Focus",
              meta: {
                weight: 4,
                type: "Simple Melee Weapons",
                damage: "1d6/1d8 bludgeoning",
              },
            }),
          ],
          armor: [
            makeItem("1", {
              label: "Leather",
              ...linked("Leather"),
              meta: { weight: 10, type: "Light Armor", acFormula: "11 + DEX" },
            }),
            makeItem("2", {
              label: "Shield",
              ...linked("Shield"),
              notes: "Simple Shield",
              meta: { weight: 6, type: "Shield", acFormula: "+2" },
            }),
          ],
          visible: [
            makeItem("3", {
              label: "Clothes, common",
              ...linked("Clothes, common"),
              meta: { weight: 3 },
            }),
            makeItem("4", {
              label: "Druidic Focus",
              ...linked("Druidic Focus"),
              notes: "Totem",
              meta: { weight: 0 },
            }),
            makeItem("5", {
              label: "Waterskin",
              ...linked("Waterskin"),
              meta: { weight: 5 },
            }),
          ],
        },
        { currency: { gp: 10 }, strength: 10 }
      )}
    />
  ),
};

// ─── With Containers ──────────────────────────────────────────────────────────

export const WithContainers: Story = {
  name: "With containers (nested items)",
  render: () => (
    <InventoryBlock
      data={buildInventory(
        {
          weapons: [
            makeItem("0", {
              label: "Quarterstaff",
              ...linked("Quarterstaff"),
              meta: {
                weight: 4,
                type: "Simple Melee Weapons",
                damage: "1d6/1d8 bludgeoning",
              },
            }),
          ],
          armor: [
            makeItem("1", {
              label: "Leather",
              ...linked("Leather"),
              meta: { weight: 10, type: "Light Armor", acFormula: "11 + DEX" },
            }),
          ],
          main_containers: [
            makeItem("2", {
              label: "Pouch",
              ...linked("Pouch"),
              meta: { weight: 1, containerCapacity: 6 },
              isContainer: true,
              totalWeight: 1 + 0 + 1,
              contents: [
                makeItem("2.0", {
                  label: "Incense",
                  ...linked("Incense"),
                  meta: { weight: 0 },
                }),
                makeItem("2.1", {
                  label: "Ceremonial Dagger",
                  ...linked("Ceremonial Dagger"),
                  meta: { weight: 1 },
                }),
              ],
            }),
          ],
        },
        { currency: { gp: 12, sp: 5 }, strength: 12 }
      )}
    />
  ),
};

// ─── HeavyLoad ────────────────────────────────────────────────────────────────

export const HeavyLoad: Story = {
  name: "Heavy load (over carry capacity)",
  render: () => (
    <InventoryBlock
      data={buildInventory(
        {
          weapons: [
            makeItem("0", {
              label: "Greatsword",
              ...linked("Greatsword"),
              meta: { weight: 6, type: "Martial Weapons", damage: "2d6 slashing" },
            }),
          ],
          armor: [
            makeItem("1", {
              label: "Plate",
              ...linked("Plate"),
              meta: { weight: 65, type: "Heavy Armor", acFormula: "18" },
            }),
          ],
          main_containers: [
            makeItem("2", {
              label: "Backpack",
              ...linked("Backpack"),
              isContainer: true,
              meta: { weight: 5 },
              totalWeight: 5 + 10 + 5 * 2,
              contents: [
                makeItem("2.0", {
                  label: "Rope (50 ft.)",
                  ...linked("Rope"),
                  meta: { weight: 10 },
                }),
                makeItem("2.1", {
                  label: "Rations, trail (1 day)",
                  ...linked("Rations"),
                  qty: 5,
                  meta: { weight: 2 },
                  totalWeight: 10,
                }),
              ],
            }),
          ],
        },
        { strength: 8, currency: { gp: 3 } } // carry 120 / heavy 80
      )}
    />
  ),
};

// ─── Empty ────────────────────────────────────────────────────────────────────

export const Empty: Story = {
  name: "Empty inventory",
  render: () => <InventoryBlock data={buildInventory({}, { strength: 10 })} />,
};
