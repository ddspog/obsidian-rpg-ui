import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { StatDiamond } from "../../../lib/ui/Stat/StatDiamond";

const meta: Meta = {
  title: "UI / Stat",
};
export default meta;

type Story = StoryObj;

export const Diamond: StoryObj = {
  render: () => (
    <div style={{ padding: "2rem", display: "flex", gap: "1.5rem", alignItems: "center" }}>
      <StatDiamond label="INITIATIVE" value={3} sign size="sm" />
      <StatDiamond label="WALK" value={30} size="lg" />
      <StatDiamond label="PROFICIENCY" value={3} sign size="sm" />
    </div>
  ),
};

export const DiamondNegative: StoryObj = {
  render: () => (
    <div style={{ padding: "2rem" }}>
      <StatDiamond label="INITIATIVE" value={-2} sign size="sm" />
    </div>
  ),
};
