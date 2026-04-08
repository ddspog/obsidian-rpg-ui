import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Header } from "../../../lib/ui/Header/Header";

const meta: Meta = {
  title: "UI / Header",
};
export default meta;

type Story = StoryObj;

export const Banner: Story = {
  render: () => (
    <Header.Banner label="Character" background="#1a1816" distribution="2 1">
      <div style={{ padding: "1rem", color: "#e3dcce" }}>
        <strong>Thalindra Swiftarrow</strong>
        <br />
        <small>Wood Elf Fighter 5</small>
      </div>
      <div style={{ padding: "1rem", color: "#e3dcce", textAlign: "right" }}>
        <small>XP 1200</small>
      </div>
    </Header.Banner>
  ),
};

export const BannerColored: Story = {
  render: () => (
    <Header.Banner label="Monster" background="#3a1818" distribution="1 1">
      <div style={{ padding: "1rem", color: "#e3dcce" }}>
        <strong>Ancient Dragon</strong>
      </div>
      <div style={{ padding: "1rem", color: "#e3dcce" }}>
        <small>CR 24</small>
      </div>
    </Header.Banner>
  ),
};
