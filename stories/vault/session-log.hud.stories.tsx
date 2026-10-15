import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { SessionActionsPanel } from "../../lib/components/session-log/session-actions-panel";
import type { CardStack, SessionFeatureCard } from "../../lib/domains/session-log/card-types";
import type { HudInfo } from "../../lib/domains/session-log/hud";
import type { HotbarResource } from "../../lib/domains/session-log/hotbar-model";
import { fn } from "storybook/test";

import "../../lib/styles/index.css";

const meta: Meta<typeof SessionActionsPanel> = {
  title: "Session Log/HUD",
  component: SessionActionsPanel,
  parameters: { layout: "fullscreen" },
  // A text column like Obsidian's, with a margin to its left for the roster.
  decorators: [
    (Story) => (
      <div style={{ padding: "1rem 1rem 1rem 6rem" }}>
        <div style={{ maxWidth: "36rem", color: "#ddd" }}>
          <Story />
        </div>
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof SessionActionsPanel>;

const face = (bg: string, glyph: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='${bg}'/><circle cx='50' cy='38' r='18' fill='#e8c9a0'/><path d='M18 100 Q50 52 82 100' fill='#2c2c34'/><text x='50' y='95' font-size='14' text-anchor='middle' fill='white'>${glyph}</text></svg>`
  )}`;

const card = (actor: string, c: Partial<SessionFeatureCard> & { name: string; bucket: SessionFeatureCard["bucket"] }): SessionFeatureCard =>
  ({ id: `${actor}:${c.bucket}:${c.name}`, logTemplate: `@({{actor}}) ${c.name}`, source: "Druid", actor, ...c }) as SessionFeatureCard;

const stackOf = (actor: string, bucket: string, label: string, cards: SessionFeatureCard[]): CardStack => ({ actor, actorType: "pc", bucket, label, cards });

const kowyn = "Kowyn";
const kowynStacks: CardStack[] = [
  stackOf(kowyn, "attack", "Attack", [
    card(kowyn, { name: "Quarterstaff", bucket: "attack", origin: "weapon", attackForm: "melee", source: "pc:Kowyn", summary: "Quarterstaff: attack at +1, 1d6-1 bludgeoning damage, 5 ft." }),
    card(kowyn, { name: "Magnetobolt º", bucket: "attack", origin: "spell", attackForm: "spell", sourceKind: "spell", cast: { circle: 1, damage: {} } }),
    card(kowyn, { name: "Icicle Javelin º", bucket: "attack", origin: "spell", attackForm: "spell", sourceKind: "spell", cast: { circle: 1, damage: {} } }),
    card(kowyn, { name: "Thunderwave", bucket: "attack", origin: "spell", sourceKind: "spell", cast: { circle: 1, damage: {} } }),
  ]),
  stackOf(kowyn, "action", "Action", [
    ...["Improvise", "Search", "Study", "Hide", "Dodge", "Dash", "Influence", "Use an Object", "Ready", "Help", "Disengage"].map((n) =>
      card(kowyn, { name: n, bucket: "action", origin: "basic", source: "basic", summary: `Take the ${n} action.` })
    ),
    card(kowyn, { name: "Druidic", bucket: "action", sourceKind: "class", summary: "Leave hidden messages with natural elements." }),
  ]),
  stackOf(kowyn, "bonus", "Bonus Action", [
    card(kowyn, { name: "Nature's Gift", bucket: "bonus", sourceKind: "class" }),
    card(kowyn, { name: "Pack", bucket: "bonus", sourceKind: "lineage", source: "Kobold" }),
  ]),
  stackOf(kowyn, "reaction", "Reaction", [card(kowyn, { name: "Opportunity Attack", bucket: "reaction", origin: "basic", source: "basic" })]),
  stackOf(kowyn, "active", "Active", [
    card(kowyn, { name: "Rage", bucket: "active", toggle: true, sourceKind: "class", modifies: [{ on: "melee attack", damage: "+2" }], summary: "Fury: +2 damage on melee attacks." }),
  ]),
  stackOf(kowyn, "passive", "Passive", [
    card(kowyn, { name: "Tinker's Fascination", bucket: "passive", sourceKind: "lineage", source: "Kobold" }),
    card(kowyn, { name: "Guardian Bubble", bucket: "passive", sourceKind: "heritage", source: "Twisted Minion" }),
    card(kowyn, { name: "Ritualist", bucket: "passive", sourceKind: "background", source: "Acolyte" }),
  ]),
];

const talonStacks: CardStack[] = [
  stackOf("Talon", "attack", "Attack", [card("Talon", { name: "Longbow", bucket: "attack", origin: "weapon", attackForm: "ranged", source: "pc:Talon" })]),
  stackOf("Talon", "action", "Action", ["Dodge", "Dash", "Hide"].map((n) => card("Talon", { name: n, bucket: "action", origin: "basic", source: "basic" }))),
];

const info = (name: string, bg: string, loadouts: HudInfo["loadouts"], hands: HudInfo["hands"]): HudInfo => ({
  portrait: face(bg, name[0]),
  sheetPath: `${name}.md`,
  hands,
  loadouts,
});

const hud: Record<string, HudInfo> = {
  Kowyn: info("Kowyn", "#3d6b3d", [
    { name: "Staff & Shield", glyph: "Shield", summary: "Quarterstaff + Shield", held: true },
    { name: "Staff & Totem", glyph: "Sparkles", summary: "Quarterstaff + Druidic Focus", held: false },
    { name: "Staff", glyph: "Sword", summary: "Quarterstaff", held: false },
  ], { main: { name: "Quarterstaff" }, off: { name: "Shield" } }),
  "Talon Pallton": info("Talon", "#6b4b2d", [
    { name: "Bow", glyph: "Crosshair", summary: "Longbow", held: true },
    { name: "Blades", glyph: "Swords", summary: "Shortsword + Shortsword", held: false },
  ], { main: { name: "Longbow" }, light: { name: "Torch" } }),
  Lilith: info("Lilith", "#7a2d4a", [], {}),
};

const resources: HotbarResource[] = [
  { kind: "slot", label: "1st-circle slots", max: 2, left: 1, circle: 1 },
  { kind: "use", label: "Nature's Gift", max: 2, left: 1, glyph: "HeartPulse" },
];

const base = {
  pcStacks: new Map<string, CardStack[]>([
    ["Kowyn", kowynStacks],
    ["Talon Pallton", talonStacks],
    ["Lilith", [stackOf("Lilith", "attack", "Attack", [card("Lilith", { name: "Glaive", bucket: "attack", origin: "weapon", attackForm: "melee", source: "pc:Lilith" })])]],
  ]),
  gmStacks: [
    {
      actor: "Game Master",
      actorType: "gm" as const,
      bucket: "combat",
      label: "Combat",
      cards: [{ id: "gm:next-round", name: "Next Round", bucket: "action" as const, kind: "next-round" as const, logTemplate: "R({{round}})", actor: "Game Master", source: "gm" }],
    },
  ],
  consumableState: { spent: {}, initialSpent: {} },
  entities: ["Kowyn", "Talon Pallton", "Lilith"],
  onAppendText: fn(),
  onSpend: fn(),
  resourcesFor: (actor: string) => (actor === "Kowyn" ? resources : []),
  hudOf: (n: string) => hud[n],
  onOpenSheet: fn(),
  onToggle: fn(),
  onEquip: fn(),
  loadoutsFor: (a: string) => (a === "Kowyn" ? [{ name: "Staff & Shield", hands: { main_hand: "[[Quarterstaff]]", shield: "[[Shield]]" } }] : []),
  defense: { ac: () => 12, health: (n: string) => ({ current: n === "Kowyn" ? 7 : 12, max: 12 }) },
};

export const OutOfCombat: Story = { args: base as never };

export const InCombat: Story = {
  args: {
    ...base,
    combat: {
      squareOf: () => undefined,
      clock: { round: 2, next: ["Talon", "Lilith", "Kowyn"] },
      provokedFor: (a: string) => (a === "Kowyn" ? "Kobold, Elite" : undefined),
    },
  } as never,
};
