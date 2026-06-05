import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { CardStack } from "../../lib/components/session-log/card-stack";
import type { CardStack as CardStackData } from "../../lib/domains/session-log/card-types";
import type { SessionConsumableState } from "../../lib/domains/session-log/consumable-state";
import { fn } from "storybook/test";

import "../../lib/styles/index.css";

const meta: Meta<typeof CardStack> = {
  title: "Session Log/Card Stack",
  component: CardStack,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof CardStack>;

const mockConsumableState: SessionConsumableState = {
  spent: { "Cleric:Channel Divinity:action": 1 },
  initialSpent: {},
};

const actionStack: CardStackData = {
  actor: "Elara",
  actorType: "pc",
  bucket: "action",
  label: "Action",
  cards: [
    {
      id: "Cleric:Channel Divinity:action",
      name: "Channel Divinity",
      bucket: "action",
      logTemplate: "@ {{actor}} channels divinity: {{name}} on {{target}}",
      text: "Heal allies within 30 feet",
      maxUses: 2,
      recovery: "short rest",
      source: "Cleric",
      actor: "Elara",
    },
    {
      id: "Cleric:Sacred Flame:action",
      name: "Sacred Flame",
      bucket: "action",
      logTemplate: "@ {{actor}} casts Sacred Flame on {{target}}",
      text: "Dex save or 2d8 radiant",
      source: "Cleric",
      actor: "Elara",
    },
    {
      id: "Cleric:Guiding Bolt:action",
      name: "Guiding Bolt",
      bucket: "action",
      logTemplate: "@ {{actor}} casts Guiding Bolt on {{target}}",
      text: "4d6 radiant, next attack has advantage",
      maxUses: 3,
      recovery: "long rest",
      source: "Cleric",
      actor: "Elara",
    },
  ],
};

const bonusStack: CardStackData = {
  actor: "Elara",
  actorType: "pc",
  bucket: "bonus",
  label: "Bonus Action",
  cards: [
    {
      id: "Cleric:Healing Word:bonus",
      name: "Healing Word",
      bucket: "bonus",
      logTemplate: "@ {{actor}} casts Healing Word on {{target}}",
      text: "Heal 1d4 + Wis at range",
      maxUses: 4,
      recovery: "long rest",
      source: "Cleric",
      actor: "Elara",
    },
    {
      id: "Cleric:Spiritual Weapon:bonus",
      name: "Spiritual Weapon",
      bucket: "bonus",
      logTemplate: "@ {{actor}} summons Spiritual Weapon",
      text: "Spectral weapon attacks as bonus",
      source: "Cleric",
      actor: "Elara",
    },
  ],
};

export const SingleStack: Story = {
  args: {
    stack: actionStack,
    consumableState: mockConsumableState,
    onCardClick: fn(),
  },
};

export const BonusStack: Story = {
  args: {
    stack: bonusStack,
    consumableState: { spent: {}, initialSpent: {} },
    onCardClick: fn(),
  },
};

export const DepletedCards: Story = {
  args: {
    stack: actionStack,
    consumableState: {
      spent: {
        "Cleric:Channel Divinity:action": 2,
        "Cleric:Guiding Bolt:action": 3,
      },
      initialSpent: {},
    },
    onCardClick: fn(),
  },
};

export const MultipleStacks: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: "2rem", padding: "2rem" }}>
      <CardStack
        stack={actionStack}
        consumableState={mockConsumableState}
        onCardClick={args.onCardClick}
      />
      <CardStack
        stack={bonusStack}
        consumableState={{ spent: {}, initialSpent: {} }}
        onCardClick={args.onCardClick}
      />
    </div>
  ),
  args: {
    stack: actionStack,
    consumableState: mockConsumableState,
    onCardClick: fn(),
  },
};
