/**
 * RpgBlock — Storybook wrapper for entity block components
 *
 * Replicates the EntityBlockWrapper from main.ts without any
 * Obsidian vault dependencies. Use this in vault system stories to render a
 * block component with a YAML fixture and optional frontmatter.
 */

import React from "react";
import { parse as parseYaml } from "yaml";
import type { RPGSystem } from "../../lib/systems/types";

export interface RpgBlockProps {
  /** Fully resolved RPGSystem — use `await` on the Promise<RPGSystem> in a loader */
  system: RPGSystem;
  /** Entity type key, e.g. "character" */
  entity: string;
  /** Block name, e.g. "header" | "health" */
  block: string;
  /** YAML string for the code block content (the block's own props) */
  yaml: string;
  /** Optional extra frontmatter fields merged into self */
  frontmatter?: Record<string, unknown>;
  /** Optional sibling block YAML fixtures keyed by block name */
  blocks?: Record<string, string>;
  /**
   * Controlled-state escape hatch for the composite sheet story. When set,
   * the wrapper uses this map (keyed by block name) as the live sibling
   * state, and calls `onBlockSelfChange` whenever the current block's own
   * `self` updates via a setter. Lets the sheet story share one state
   * container across every block so a pick made in the features block
   * flows into the proficiencies / skills / etc. blocks on the same
   * render cycle.
   */
  sharedBlocks?: Record<string, Record<string, unknown>>;
  /**
   * Fires whenever this block's own `self` updates. The sheet story uses
   * it to keep its `sharedBlocks` map in sync with the block's internal
   * state.
   */
  onBlockSelfChange?: (blockName: string, next: Record<string, unknown>) => void;
  /**
   * Mock file path injected into app.workspace.getActiveFile().path.
   * Defaults to "stories/sample-character.md".
   */
  filePath?: string;
  /**
   * Mock file basename injected into app.workspace.getActiveFile().basename.
   * Defaults to the stem of filePath (e.g. "Aldric the Bold").
   */
  filename?: string;
}

export function RpgBlock({
  system,
  entity,
  block,
  yaml,
  frontmatter = {},
  blocks: blockFixtures = {},
  sharedBlocks,
  onBlockSelfChange,
  filePath,
  filename,
}: RpgBlockProps) {
  // Synchronously update the mock before any child renders so Title and
  // Pill.Link always read the correct file context for this story.
  // (useEffect fires after render — too late for components that read
  //  globalThis.app.workspace.getActiveFile() during their first render.)
  const resolvedPath = filePath ?? "stories/sample-character.md";
  const resolvedBasename =
    filename ??
    (filePath ? (filePath.split("/").pop()?.replace(/\.md$/, "") ?? "Sample Character") : "Sample Character");
  const app = (globalThis as any).app;
  if (app?.workspace) {
    app.workspace.getActiveFile = () => ({ path: resolvedPath, basename: resolvedBasename });
  }

  const entityDef = (system.entities as Record<string, any>)?.[entity];
  const Comp: React.ComponentType<any> | undefined = entityDef?.blocks?.[block];

  if (!Comp) {
    return (
      <div style={{ color: "red", padding: "1rem", fontFamily: "monospace" }}>
        Block{" "}
        <strong>
          {entity}.{block}
        </strong>{" "}
        not found in system.
        <br />
        Available: {Object.keys(entityDef?.blocks ?? {}).join(", ") || "(none)"}
      </div>
    );
  }

  // Parse the code block YAML into the initial self object
  let initialSelf: Record<string, unknown> = {};
  try {
    const parsed = parseYaml(yaml);
    if (parsed && typeof parsed === "object") {
      initialSelf = { ...parsed, ...frontmatter };
    } else {
      initialSelf = { ...frontmatter };
    }
  } catch {
    initialSelf = { ...frontmatter };
  }

  // Parse sibling block YAML fixtures — but when the parent story supplies
  // `sharedBlocks`, prefer those objects so sibling state stays live (a
  // pick in the features block flows into proficiencies on re-render).
  const blocksObj: Record<string, unknown> = {};
  const blockNames: string[] = entityDef ? Object.keys(entityDef.blocks ?? {}) : [];
  for (const bn of blockNames) {
    if (sharedBlocks && bn in sharedBlocks) {
      blocksObj[bn] = sharedBlocks[bn];
      continue;
    }
    const raw = blockFixtures[bn];
    if (raw) {
      try {
        blocksObj[bn] = parseYaml(raw) ?? {};
      } catch {
        blocksObj[bn] = {};
      }
    } else {
      blocksObj[bn] = {};
    }
  }
  // Always populate the current block with its own parsed data so cross-block
  // expressions (e.g. CharacterLevel reading blocks.header.classes) work when
  // rendering any block that references itself.
  blocksObj[block] = initialSelf;

  const lookupObj: Record<string, unknown> = (entityDef?.lookup as Record<string, unknown>) ?? {};

  return (
    <EntityBlockWrapper
      Comp={Comp}
      block={block}
      initialSelf={initialSelf}
      lookupObj={lookupObj}
      blocksObj={blocksObj}
      frontmatter={frontmatter}
      system={system}
      onBlockSelfChange={onBlockSelfChange}
    />
  );
}

// ─── Internal stateful wrapper ────────────────────────────────────────────────

interface WrapperProps {
  Comp: React.ComponentType<any>;
  block: string;
  initialSelf: Record<string, unknown>;
  lookupObj: Record<string, unknown>;
  blocksObj: Record<string, unknown>;
  frontmatter: Record<string, unknown>;
  system: RPGSystem;
  onBlockSelfChange?: (blockName: string, next: Record<string, unknown>) => void;
}

function EntityBlockWrapper({
  Comp,
  block,
  initialSelf,
  lookupObj,
  blocksObj,
  frontmatter,
  system,
  onBlockSelfChange,
}: WrapperProps) {
  const [self, setSelf] = React.useState<Record<string, unknown>>(initialSelf);

  // Bubble state changes up so the parent sheet story (or any composite
  // wrapper) can mirror them into its `sharedBlocks` map and re-render
  // sibling blocks with the fresh values.
  React.useEffect(() => {
    onBlockSelfChange?.(block, self);
  }, [self, block, onBlockSelfChange]);

  const selfWithSetters = React.useMemo(() => {
    const setters: Record<string, unknown> = {};
    for (const key of Object.keys(self)) {
      const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      setters[setterName] = (valueOrUpdater: unknown) => {
        setSelf((prev) => {
          const newValue =
            typeof valueOrUpdater === "function"
              ? (valueOrUpdater as (p: unknown) => unknown)(prev[key])
              : valueOrUpdater;
          return { ...prev, [key]: newValue };
        });
      };
    }
    return { ...self, ...setters };
  }, [self]);

  // Build expressions proxy from system.expressions Map (same as EntityBlockWrapper)
  const expressionsProxy = React.useMemo<Record<string, (...args: any[]) => unknown>>(() => {
    const proxy: Record<string, (...args: any[]) => unknown> = {};
    const exprMap: Map<string, any> = (system as any).expressions ?? new Map();
    for (const [name, exprDef] of exprMap.entries()) {
      proxy[name] = (...callArgs: any[]) => {
        try {
          const argsArr = callArgs.length === 1 && Array.isArray(callArgs[0]) ? callArgs[0] : callArgs;
          return exprDef.evaluate({
            args: argsArr,
            lookup: lookupObj,
            frontmatter,
            blocks: blocksObj,
            expressions: proxy,
            system,
          });
        } catch (err) {
          console.error("RPG UI: expression evaluate failed:", err);
          return undefined;
        }
      };
    }
    return proxy;
  }, [system, lookupObj, blocksObj, frontmatter]);

  const props: Record<string, unknown> = {
    self: selfWithSetters,
    lookup: lookupObj,
    frontmatter,
    blocks: blocksObj,
    expressions: expressionsProxy,
    system,
    trigger: () => {},
  };

  return React.createElement(Comp, props);
}
