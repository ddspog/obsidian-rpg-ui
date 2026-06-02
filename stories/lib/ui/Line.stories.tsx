import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Line } from "../../../lib/ui/Line/Line";
import { Pill } from "../../../lib/ui/primitives/Pill";

const meta: Meta = {
  title: "UI / Line",
};
export default meta;

type Story = StoryObj;

export const PillsRow: Story = {
  render: () => (
    <div style={{ padding: "1rem" }}>
      <Line.Pills>
        <Pill.Link>Poisoned</Pill.Link>
        <Pill.Link>Blinded</Pill.Link>
        <Pill.Link>Frightened</Pill.Link>
      </Line.Pills>
    </div>
  ),
};

export const ButtonsRow: Story = {
  render: () => (
    <div style={{ padding: "1rem" }}>
      <Line.Buttons>
        <button type="button" style={{ color: "#e3dcce" }}>
          Short Rest
        </button>
        <button type="button" style={{ color: "#e3dcce" }}>
          Long Rest
        </button>
      </Line.Buttons>
    </div>
  ),
};

export const ControlRow: Story = {
  render: () => (
    <div style={{ padding: "1rem" }}>
      <Line.Control>
        <span style={{ color: "#e3dcce" }}>Current HP</span>
        <input type="number" defaultValue={32} />
      </Line.Control>
    </div>
  ),
};

export const StatsRow: Story = {
  render: () => (
    <div style={{ padding: "1rem" }}>
      <Line.Stats>
        <span style={{ color: "#e3dcce" }}>STR: 18</span>
        <span style={{ color: "#e3dcce" }}>DEX: 14</span>
        <span style={{ color: "#e3dcce" }}>CON: 16</span>
      </Line.Stats>
    </div>
  ),
};
