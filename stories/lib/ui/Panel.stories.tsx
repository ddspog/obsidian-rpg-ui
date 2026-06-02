import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Panel } from "../../../lib/ui/Panel/Panel";

const meta: Meta = {
  title: "UI / Panel",
};
export default meta;

type Story = StoryObj;

export const Status: Story = {
  render: () => (
    <Panel.Status label="Conditions" style={{ padding: "1rem", background: "#2a2724" }}>
      <p style={{ color: "#e3dcce" }}>Condition pills and status info here.</p>
    </Panel.Status>
  ),
};
