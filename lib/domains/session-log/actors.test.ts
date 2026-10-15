import { describe, it, expect } from "vitest";
import { logNames, matchActor } from "./actors";

describe("matchActor — a log's name for a PC", () => {
  const pcs = [{ name: "Talon Pallton" }, { name: "Jacqui Ilitul", aliases: ["Jac"] }, { name: "Kowyn" }];

  it("matches the full note name, case-insensitively", () => {
    expect(matchActor("talon pallton", pcs)).toBe(0);
  });

  it("matches a first name", () => {
    expect(matchActor("Talon", pcs)).toBe(0);
  });

  it("matches an alias", () => {
    expect(matchActor("Jac", pcs)).toBe(1);
  });

  it("matches nobody on an ambiguous first name", () => {
    expect(matchActor("Kai", [{ name: "Kai Ren" }, { name: "Kai Moro" }])).toBe(-1);
  });

  it("prefers an exact name over a first-name clash", () => {
    expect(matchActor("Kowyn", [...pcs, { name: "Kowyn Vale" }])).toBe(2);
  });

  it("returns -1 for an unknown actor", () => {
    expect(matchActor("Marcel", pcs)).toBe(-1);
  });
});

describe("logNames — how a PC is written in the log", () => {
  it("uses the first name when no other PC shares it", () => {
    expect(Object.fromEntries(logNames(["Talon Pallton", "Jacqui Ilitul", "Kowyn"]))).toEqual({
      "Talon Pallton": "Talon",
      "Jacqui Ilitul": "Jacqui",
      Kowyn: "Kowyn",
    });
  });

  it("keeps full names when a first name is shared", () => {
    expect(Object.fromEntries(logNames(["Kai Ren", "Kai Moro"]))).toEqual({
      "Kai Ren": "Kai Ren",
      "Kai Moro": "Kai Moro",
    });
  });
});
