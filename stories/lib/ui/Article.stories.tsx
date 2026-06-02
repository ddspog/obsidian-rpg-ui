import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Article } from "../../../lib/ui/Article/Article";

const meta: Meta = {
  title: "UI / Article",
};
export default meta;

type Story = StoryObj;

export const Column: Story = {
  render: () => (
    <Article.Column label="Health Content" style={{ maxWidth: 400, padding: "1rem" }}>
      <p style={{ color: "#e3dcce" }}>Health content goes here.</p>
      <p style={{ color: "#e3dcce" }}>This is an article column layout wrapper.</p>
    </Article.Column>
  ),
};

export const ColumnNested: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "1rem" }}>
      <Article.Column label="Left Content" style={{ padding: "1rem" }}>
        <p style={{ color: "#e3dcce" }}>Left column</p>
      </Article.Column>
      <Article.Column label="Right Content" style={{ padding: "1rem" }}>
        <p style={{ color: "#e3dcce" }}>Right column</p>
      </Article.Column>
    </div>
  ),
};
