import { describe, it, expect } from "vitest";
import { generateFolderLinkCss } from "./css-generator";
import type { FolderLinkStyle } from "settings";

describe("generateFolderLinkCss", () => {
  it("returns empty string for an empty input", () => {
    expect(generateFolderLinkCss([])).toBe("");
  });

  it("skips entries with no visual declarations", () => {
    const out = generateFolderLinkCss([{ id: "people", folderPaths: ["People"] }]);
    expect(out).toBe("");
  });

  it("emits text color without !important", () => {
    const styles: FolderLinkStyle[] = [{ id: "people", folderPaths: ["People"], color: "#6a5acd" }];
    const out = generateFolderLinkCss(styles);
    expect(out).toContain("a.rpg-folder-link.rpg-folder-link--people");
    expect(out).toContain("color: #6a5acd");
    expect(out).not.toContain("!important");
  });

  it("emits bold and italic declarations", () => {
    const styles: FolderLinkStyle[] = [
      { id: "spells", folderPaths: ["Spells"], bold: true, italic: true },
    ];
    const out = generateFolderLinkCss(styles);
    expect(out).toContain("font-weight: bold");
    expect(out).toContain("font-style: italic");
  });

  it("omits bold/italic declarations when flags are unset", () => {
    const styles: FolderLinkStyle[] = [
      { id: "plain", folderPaths: ["Plain"], color: "#111" },
    ];
    const out = generateFolderLinkCss(styles);
    expect(out).not.toContain("font-weight");
    expect(out).not.toContain("font-style");
  });

  it("adds pill declarations when background is set", () => {
    const styles: FolderLinkStyle[] = [{ id: "items", folderPaths: ["Items"], background: "#222" }];
    const out = generateFolderLinkCss(styles);
    expect(out).toContain("background-color: #222");
    expect(out).toContain("padding: 0 0.35em");
    expect(out).toContain("border-radius: 0.4em");
  });

  it("renders underline borderStyle as text-decoration", () => {
    const styles: FolderLinkStyle[] = [
      {
        id: "spells",
        folderPaths: ["Spells"],
        borderStyle: "underline",
        borderColor: "red",
      },
    ];
    const out = generateFolderLinkCss(styles);
    expect(out).toContain("text-decoration: underline red");
    expect(out).not.toContain("border-bottom: 1px");
  });

  it("renders dashed/solid/dotted as border-bottom and kills default underline", () => {
    const styles: FolderLinkStyle[] = [
      {
        id: "npcs",
        folderPaths: ["NPCs"],
        borderStyle: "dashed",
        borderColor: "green",
      },
    ];
    const out = generateFolderLinkCss(styles);
    expect(out).toContain("border-bottom: 1px dashed green");
    expect(out).toContain("text-decoration: none");
  });

  it("borderStyle 'none' removes the default internal-link underline", () => {
    const styles: FolderLinkStyle[] = [
      { id: "plain", folderPaths: ["Plain"], color: "#111", borderStyle: "none" },
    ];
    const out = generateFolderLinkCss(styles);
    expect(out).toContain("text-decoration: none");
    expect(out).toContain("border-bottom: none");
  });

  it("never emits !important", () => {
    const styles: FolderLinkStyle[] = [
      {
        id: "kitchen-sink",
        folderPaths: ["Everything"],
        color: "#111",
        background: "#eee",
        borderStyle: "dashed",
        borderColor: "red",
        bold: true,
        italic: true,
        iconPrefix: "📘",
      },
    ];
    const out = generateFolderLinkCss(styles);
    expect(out).not.toContain("!important");
  });

  it("emits a ::before rule with an escaped icon prefix", () => {
    const styles: FolderLinkStyle[] = [{ id: "people", folderPaths: ["People"], iconPrefix: "👤" }];
    const out = generateFolderLinkCss(styles);
    expect(out).toContain("a.rpg-folder-link.rpg-folder-link--people::before");
    expect(out).toContain('content: "👤 "');
  });

  it("escapes special characters in iconPrefix", () => {
    const styles: FolderLinkStyle[] = [{ id: "weird", folderPaths: ["Weird"], iconPrefix: 'say "hi"' }];
    const out = generateFolderLinkCss(styles);
    expect(out).toContain('content: "say \\"hi\\" "');
  });

  it("skips entries with invalid ids", () => {
    const styles: FolderLinkStyle[] = [{ id: "!!!", folderPaths: ["Junk"], color: "red" }];
    expect(generateFolderLinkCss(styles)).toBe("");
  });
});
