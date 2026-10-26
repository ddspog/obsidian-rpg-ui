import { describe, expect, it } from "vitest";
import { parseSquareMap } from "./square-map";
import { freeSquare, writeTokens } from "./edit-tokens";

const block = `grid: square
title: Kowyn Encounter
image: "[[clean.png]]"
cell: 33
tokens:
  Talon: J14
  "[[Kobold, Elite]]": N5
legend:
  ".": { terrain: grass }
---
. . .
. . .`;

describe("writeTokens", () => {
  it("replaces the tokens entry and leaves the rest alone", () => {
    const out = writeTokens(block, [
      { name: "Talon", at: { col: 0, row: 1 } },
      { name: "[[Kobold, Elite]]", at: { col: 2, row: 0 } },
      { name: "Fat [[Kobold, A]]", at: { col: 1, row: 1 } },
    ]);
    expect(out).toContain('tokens:\n  Talon: A2\n  "[[Kobold, Elite]]": C1\n  "Fat [[Kobold, A]]": B2\nlegend:');
    expect(out.startsWith("grid: square\ntitle: Kowyn Encounter")).toBe(true);
    expect(out.endsWith("---\n. . .\n. . .")).toBe(true);
  });

  it("round-trips through the parser", () => {
    const out = writeTokens(block, [{ name: "Kowyn", at: { col: 11, row: 10 } }]);
    expect(parseSquareMap(out).tokens).toEqual({ Kowyn: { col: 11, row: 10 } });
  });

  it("adds an entry before the --- when there is none", () => {
    const out = writeTokens("grid: square\n---\n. .", [{ name: "Talon", at: { col: 0, row: 0 } }]);
    expect(out).toBe("grid: square\ntokens:\n  Talon: A1\n---\n. .");
  });

  it("removes the entry when no tokens are left", () => {
    const out = writeTokens(block, []);
    expect(out).not.toContain("tokens:");
    expect(out).toContain("legend:");
    expect(out).toContain("cell: 33\nlegend:");
  });

  it("reads a one-line flow entry too", () => {
    const out = writeTokens("grid: square\ntokens: { Talon: A1 }\n---\n. .", [
      { name: "Talon", at: { col: 1, row: 0 } },
    ]);
    expect(out).toBe("grid: square\ntokens:\n  Talon: B1\n---\n. .");
  });

  it("quotes names YAML would misread", () => {
    const out = writeTokens("grid: square\n---\n. .", [
      { name: "Yes", at: { col: 0, row: 0 } },
      { name: "Kobold: Elite", at: { col: 1, row: 0 } },
    ]);
    expect(out).toContain('"Yes": A1');
    expect(out).toContain('"Kobold: Elite": B1');
  });
});

describe("freeSquare", () => {
  it("is the start when it is free", () => {
    expect(freeSquare({ col: 2, row: 2 }, [], 5, 5)).toEqual({ col: 2, row: 2 });
  });
  it("searches outward when it is taken", () => {
    const got = freeSquare({ col: 2, row: 2 }, [{ col: 2, row: 2 }], 5, 5);
    expect(got).not.toEqual({ col: 2, row: 2 });
    expect(Math.max(Math.abs(got.col - 2), Math.abs(got.row - 2))).toBe(1);
  });
});
