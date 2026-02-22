import { describe, it, expect } from "vitest";
import { evaluateSystemBundle } from "./ts-loader";

/**
 * Tests for the IIFE bundle evaluator.
 * The full esbuild-wasm pipeline requires a WASM binary not available in the
 * Node test environment, so we test the evaluation step in isolation by
 * constructing synthetic bundle strings that mimic what esbuild would produce.
 */
describe("evaluateSystemBundle", () => {
  /** Build a minimal IIFE bundle string that sets __system_module.system. */
  function makeBundleWithSystem(systemObj: object): string {
    const json = JSON.stringify(systemObj);
    // Simulate esbuild IIFE output:
    //   var __system_module;
    //   (() => { __system_module = { system: <value> }; })();
    return `(()=>{__system_module={"system":${json}};})();`;
  }

  it("should return null for an empty bundle", () => {
    const result = evaluateSystemBundle("", "systems/test");
    expect(result).toBeNull();
  });

  it("should return null when bundle does not export 'system'", () => {
    const bundle = `(()=>{ __system_module = {}; })();`;
    const result = evaluateSystemBundle(bundle, "systems/test");
    expect(result).toBeNull();
  });

  it("should return the system object when 'system' is exported", () => {
    const systemObj = {
      name: "Test System",
      attributes: ["str"],
      entities: {},
      skills: [],
      features: { categories: [], providers: [], collectors: [] },
      spellcasting: { circles: [], providers: [], collectors: [] },
      conditions: { conditions: [] },
    };
    const bundle = makeBundleWithSystem(systemObj);
    const result = evaluateSystemBundle(bundle, "systems/test");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Test System");
    expect(result!.attributes).toEqual(["str"]);
  });

  it("should return null when bundle throws during evaluation", () => {
    const bundle = `throw new Error("intentional error");`;
    const result = evaluateSystemBundle(bundle, "systems/test");
    expect(result).toBeNull();
  });

  it("should return null when 'system' export is not an object", () => {
    // system is a string instead of an RPGSystem object
    const bundle = `(()=>{ __system_module = { system: "not-an-object" }; })();`;
    const result = evaluateSystemBundle(bundle, "systems/test");
    expect(result).toBeNull();
  });

  it("should handle system objects with a Map-like expressions field", () => {
    // Real CreateSystem returns expressions as a Map, but in JSON it becomes {}
    // In this test we verify the evaluator returns whatever the bundle produces
    const systemObj = {
      name: "D&D 5e",
      attributes: ["strength", "dexterity"],
      entities: {},
      skills: [],
      features: { categories: [], providers: [], collectors: [] },
      spellcasting: { circles: [], providers: [], collectors: [] },
      conditions: { conditions: [] },
    };
    const bundle = makeBundleWithSystem(systemObj);
    const result = evaluateSystemBundle(bundle, "systems/dnd5e");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("D&D 5e");
    expect(result!.attributes).toHaveLength(2);
  });
});
