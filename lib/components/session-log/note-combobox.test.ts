import { describe, it, expect } from "vitest";
import { matchNotes } from "./note-combobox";

const notes = [
  { name: "Rope, silk (50 feet)", folder: "items/gear" },
  { name: "Rope, hempen (50 feet)", folder: "items/gear" },
  { name: "Grappling hook", folder: "items/gear" },
  { name: "Sling", folder: "items/weapons" },
  { name: "Sling bullets", folder: "items/ammunition" },
];

describe("matchNotes", () => {
  it("finds the notes holding every typed word, those starting with it first", () => {
    expect(matchNotes(notes, "sling").map((n) => n.name)).toEqual(["Sling", "Sling bullets"]);
    expect(matchNotes(notes, "rope silk").map((n) => n.name)).toEqual(["Rope, silk (50 feet)"]);
    expect(matchNotes(notes, "")).toEqual([]);
  });
});
