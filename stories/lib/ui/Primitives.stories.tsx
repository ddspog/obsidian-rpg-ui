import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Pill } from "../../../lib/ui/primitives/Pill";
import { TriggerButton } from "../../../lib/ui/primitives/TriggerButton";
import { Title } from "../../../lib/ui/primitives/Title";

const meta: Meta = {
  title: "UI / Primitives",
};
export default meta;

type Story = StoryObj;

export const PillBasic: Story = {
  name: "Pill",
  render: () => (
    <div style={{ padding: "1rem", display: "flex", gap: "0.5rem" }}>
      <Pill.Link>Poisoned</Pill.Link>
      <Pill.Link>Blinded</Pill.Link>
      <Pill.Link>Frightened</Pill.Link>
    </div>
  ),
};

export const TriggerBtn: Story = {
  name: "TriggerButton",
  render: () => (
    <div style={{ padding: "1rem" }}>
      <TriggerButton onClick={() => alert("triggered!")}>Roll Initiative</TriggerButton>
    </div>
  ),
};

export const TitleHeading: Story = {
  name: "Title",
  render: () => (
    <div style={{ padding: "1rem" }}>
      <Title>Character Sheet</Title>
    </div>
  ),
};
