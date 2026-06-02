import type { Meta, StoryObj } from "@storybook/react";
import React, { useState } from "react";
import { DiceTray } from "../../../lib/ui/dice/DiceTray";

const meta: Meta = {
  title: "UI / Dice",
};
export default meta;

type Story = StoryObj;

const sampleDice: Record<string, { max: number; current: number }> = {
  d10: { max: 5, current: 3 },
  d6: { max: 2, current: 2 },
};

function InteractiveDiceTray() {
  const [dice, setDice] = useState<Record<string, { max: number; current: number }>>(sampleDice);
  const handleSpend = (type: string) => {
    setDice((prev) => {
      const d = prev[type];
      if (!d || d.current <= 0) return prev;
      return { ...prev, [type]: { ...d, current: d.current - 1 } };
    });
  };
  return (
    <div style={{ padding: "1rem" }}>
      <DiceTray dice={dice} onSpend={handleSpend} />
    </div>
  );
}

export const Tray: Story = {
  render: () => <InteractiveDiceTray />,
};
