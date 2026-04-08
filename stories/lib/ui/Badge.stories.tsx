import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Badge } from "../../../lib/ui/Badge/Badge";

const meta: Meta = {
  title: "UI / Badge",
};
export default meta;

type Story = StoryObj;

export const ShieldAC: Story = {
  render: () => (
    <div style={{ padding: "2rem" }}>
      <Badge.Shield value={16} />
    </div>
  ),
};

export const ShieldHighAC: Story = {
  render: () => (
    <div style={{ padding: "2rem" }}>
      <Badge.Shield value={22} />
    </div>
  ),
};
