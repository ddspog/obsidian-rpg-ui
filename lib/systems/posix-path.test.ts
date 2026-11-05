import { posix } from "path";
import { describe, expect, it } from "vitest";
import { dirname, join, normalize } from "./posix-path";

const paths = [
  "",
  ".",
  "./a",
  "a/./b",
  "a//b",
  "a/b/../c",
  "../a",
  "a/../../b",
  "/a/../b",
  "a/b/",
  "/",
  "systems/dnd/index.ts",
];

describe("posix-path", () => {
  it.each(paths)("normalize(%j) matches Node", (p) => expect(normalize(p)).toBe(posix.normalize(p)));
  it.each(paths)("dirname(%j) matches Node", (p) => expect(dirname(p)).toBe(posix.dirname(p)));
  it.each([
    ["systems/dnd", "./rules/abilities"],
    ["systems/dnd/rules", "../shared"],
    [".", "a"],
    ["a", ""],
    ["", ""],
  ])("join(%j, %j) matches Node", (a, b) => expect(join(a, b)).toBe(posix.join(a, b)));
});
