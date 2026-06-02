import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Progress } from "../../../lib/ui/Progress/Progress";

const meta: Meta = {
  title: "UI / Progress",
};
export default meta;

type Story = StoryObj;

export const Bar: Story = {
  render: () => (
    <div style={{ padding: "2rem", maxWidth: 400 }}>
      <Progress.Bar label="HIT POINTS" value={32} max={58} />
    </div>
  ),
};

export const BarEmpty: Story = {
  render: () => (
    <div style={{ padding: "2rem", maxWidth: 400 }}>
      <Progress.Bar label="HIT POINTS" value={0} max={58} />
    </div>
  ),
};

export const BarFull: Story = {
  render: () => (
    <div style={{ padding: "2rem", maxWidth: 400 }}>
      <Progress.Bar label="HIT POINTS" value={58} max={58} />
    </div>
  ),
};

export const Numbered: Story = {
  render: () => (
    <div style={{ padding: "2rem", maxWidth: 400 }}>
      <Progress.Numbered value={3} max={6} />
    </div>
  ),
};

export const NumberedEmpty: Story = {
  render: () => (
    <div style={{ padding: "2rem", maxWidth: 400 }}>
      <Progress.Numbered value={0} max={6} />
    </div>
  ),
};

export const NumberedFull: Story = {
  render: () => (
    <div style={{ padding: "2rem", maxWidth: 400 }}>
      <Progress.Numbered value={6} max={6} />
    </div>
  ),
};
