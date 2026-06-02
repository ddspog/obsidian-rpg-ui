import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Section } from "../../../lib/ui/Section/Section";

const meta: Meta = {
  title: "UI / Section",
};
export default meta;

type Story = StoryObj;

export const Row: Story = {
  render: () => (
    <Section.Row label="Character Status" distribution="1 2 1" style={{ padding: "1rem" } as any}>
      <div style={{ background: "#2a2724", padding: "1rem", color: "#e3dcce" }}>Col 1</div>
      <div style={{ background: "#2a2724", padding: "1rem", color: "#e3dcce" }}>Col 2 (wider)</div>
      <div style={{ background: "#2a2724", padding: "1rem", color: "#e3dcce" }}>Col 3</div>
    </Section.Row>
  ),
};

export const RowEven: Story = {
  render: () => (
    <Section.Row label="Stats Row" distribution="1 1 1">
      <div style={{ background: "#2a2724", padding: "1rem", color: "#e3dcce" }}>Initiative</div>
      <div style={{ background: "#2a2724", padding: "1rem", color: "#e3dcce" }}>Speed</div>
      <div style={{ background: "#2a2724", padding: "1rem", color: "#e3dcce" }}>Proficiency</div>
    </Section.Row>
  ),
};
