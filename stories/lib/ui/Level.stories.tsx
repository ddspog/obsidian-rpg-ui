import type { Meta, StoryObj } from "@storybook/react";
import React, { useState } from "react";
import { Level } from "../../../lib/ui/Level/Level";

const meta: Meta = {
  title: "UI / Level",
};
export default meta;

type Story = StoryObj;

function InteractiveInspirational() {
  const [inspiration, setInspiration] = useState(2);
  return (
    <div style={{ padding: "2rem" }}>
      <Level.Inspirational
        level={5}
        inspiration={inspiration}
        maxPoints={5}
        onUpdateInspiration={setInspiration}
      />
      <p style={{ color: "#e3dcce", marginTop: "1rem", fontSize: "0.75rem" }}>
        Inspiration: {inspiration} / 5
      </p>
    </div>
  );
}

export const Inspirational: Story = {
  render: () => <InteractiveInspirational />,
};

export const InspirationalFull: Story = {
  render: () => (
    <div style={{ padding: "2rem" }}>
      <Level.Inspirational level={10} inspiration={5} maxPoints={5} onUpdateInspiration={() => {}} />
    </div>
  ),
};

export const InspirationalEmpty: Story = {
  render: () => (
    <div style={{ padding: "2rem" }}>
      <Level.Inspirational level={1} inspiration={0} maxPoints={5} onUpdateInspiration={() => {}} />
    </div>
  ),
};
