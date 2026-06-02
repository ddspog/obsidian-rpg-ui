import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Figure } from "../../../lib/ui/Figure/Figure";

const meta: Meta = {
  title: "UI / Figure",
};
export default meta;

type Story = StoryObj;

export const Column: Story = {
  render: () => (
    <Figure.Column label="Controls" style={{ padding: "1rem" }}>
      <p style={{ color: "#e3dcce" }}>Figure column — for visual controls.</p>
    </Figure.Column>
  ),
};
