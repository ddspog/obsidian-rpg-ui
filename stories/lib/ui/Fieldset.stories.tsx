import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Fieldset } from "../../../lib/ui/Fieldset/Fieldset";

const meta: Meta = {
  title: "UI / Fieldset",
};
export default meta;

type Story = StoryObj;

export const Health: Story = {
  render: () => (
    <Fieldset.Health label="Character" style={{ padding: "1rem", maxWidth: 400 } as any}>
      <p style={{ color: "#e3dcce" }}>Health fields grouped here (HP inputs, hit dice, etc.)</p>
    </Fieldset.Health>
  ),
};
