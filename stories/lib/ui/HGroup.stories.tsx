import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { HGroup } from "../../../lib/ui/HGroup/HGroup";

const meta: Meta = {
  title: "UI / HGroup",
};
export default meta;

type Story = StoryObj;

export const Row: Story = {
  render: () => (
    <HGroup.Row label="Vitals" style={{ padding: "1rem" } as any}>
      <div style={{ color: "#e3dcce" }}>Current HP: 32</div>
      <div style={{ color: "#e3dcce" }}>Temp HP: 5</div>
      <div style={{ color: "#e3dcce" }}>Max HP: 58</div>
    </HGroup.Row>
  ),
};
