/**
 * feature.gm view — in-place render for `rpg feature.gm` blocks.
 *
 * GM Screen / gm-tool files declare GM features as `rpg feature.gm` fences.
 * Those blocks are primarily DATA (parsed by the session log into GM cards,
 * where their aspects define the appended log snippet), but when the file is
 * opened directly each fence renders like a `feature.details` compendium card.
 *
 * For an ENTRY feature whose `generator.interpret` results are `@[[link]]`
 * branch refs to STEP blocks on other pages, this view also loads those step
 * blocks (cross-file) so the in-card example can offer their choices as a
 * dropdown. The initial render shows the card immediately; the step blocks are
 * read asynchronously and the card re-renders with them once available.
 */

import { App, MarkdownPostProcessorContext, TFile } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { BaseView } from "./BaseView";
import { ReactMarkdown } from "./ReactMarkdown";
import { parseGMFeatureBlock, parseSourceDoc } from "lib/domains/features/parse-source-doc";
import { GMFeatureCard } from "lib/components/session-log/gm-feature-card";
import type { GMFeature, GMStep } from "lib/domains/features/types";
import type { TableDef } from "lib/domains/tables/types";
import type { GMStepContext } from "lib/domains/gm/example";
import { parseBranchRef, selectStepBlock, stepUseLinks, spliceStepUses } from "lib/domains/gm/steps";
import { generatorSteps, genStepLine } from "lib/domains/gm/emit";
import { selectGenerator } from "lib/domains/gm/card-refs";
import { expandCalledGenerator } from "lib/domains/gm/expand-gen";
import { collectResources } from "lib/domains/lonelog/dial-ops";
import { collectLists, type ListDecl } from "lib/domains/lonelog/list-ops";

/**
 * Renders one `rpg feature.gm` fence as a GM card, loading its cross-file step
 * context (tables, ramify maps, lists, composed generator lines) so the body's
 * lonelog is fully interactive. Exported so an IMPORTED fence — a GM tool page
 * pulled into another note via `@[[file]].bare()` — renders identically to the
 * tool page itself (see plugin/process-rpg-fences).
 */
export class FeatureGMRenderChild extends ReactMarkdown {
  constructor(
    el: HTMLElement,
    private app: App,
    private source: string,
    private sourcePath: string
  ) {
    super(el);
  }

  onload(): void {
    const feature = parseGMFeatureBlock(this.source);
    if (!feature) {
      this.containerEl.innerHTML = '<div class="notice">Invalid feature.gm block</div>';
      return;
    }
    this.reactRoot = ReactDOM.createRoot(this.containerEl);
    this.reactRoot.render(<GMFeatureCard feature={feature} sourcePath={this.sourcePath} />);

    // Load any step blocks this feature's interpret branch links point at, then
    // re-render the card with them so the example dropdowns are populated.
    void this.loadStepCtx(feature).then((stepCtx) => {
      const hasCtx =
        Object.keys(stepCtx.steps ?? {}).length > 0 ||
        Object.keys(stepCtx.dials ?? {}).length > 0 ||
        Object.keys(stepCtx.resources ?? {}).length > 0 ||
        Object.keys(stepCtx.lists ?? {}).length > 0 ||
        Object.keys(stepCtx.stepTables ?? {}).length > 0 ||
        Object.keys(stepCtx.genLines ?? {}).length > 0 ||
        Object.keys(stepCtx.calls ?? {}).length > 0;
      if (this.reactRoot && hasCtx) {
        this.reactRoot.render(<GMFeatureCard feature={feature} sourcePath={this.sourcePath} stepCtx={stepCtx} />);
      }
    });
  }

  /** Resolve the feature's `generator.interpret` branch links to step blocks,
   *  plus any tables those steps roll against (for auto-fill on roll) and any
   *  dials it `reads:` (for the CF `default` fallback in the example). */
  private async loadStepCtx(feature: GMFeature): Promise<GMStepContext> {
    const steps: Record<string, GMFeature> = {};
    const tables: Record<string, TableDef> = {};
    const calls: Record<string, string[]> = {};
    const stepTables: Record<string, string> = {};
    const stepFollows: Record<string, import("lib/domains/features/types").GMInterpret> = {};
    const lists: Record<string, ListDecl> = {};
    const genLines: Record<string, string[]> = {};
    const dials: NonNullable<GMStepContext["dials"]> = {};
    const resFeatures: GMFeature[] = [feature];
    for (const ref of feature.reads ?? []) {
      const file = this.app.metadataCache.getFirstLinkpathDest(
        ref.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].split("#")[0].trim(),
        this.sourcePath
      );
      if (!(file instanceof TFile)) continue;
      try {
        const doc = parseSourceDoc({ $name: file.basename, $contents: await this.app.vault.read(file) }, "class");
        resFeatures.push(...(doc.gmFeatures ?? []));
        for (const f of doc.gmFeatures ?? []) {
          if (f.dial?.abbr && !dials[f.dial.abbr]) dials[f.dial.abbr] = { ...f.dial, name: f.name };
        }
      } catch {
        /* unreadable dial — skip; the example falls back to its legacy CF path */
      }
    }
    for (const gen of [feature.generator, ...(feature.generators ?? [])]) {
      for (const genStep of gen ? generatorSteps(gen) : []) {
        for (const value of Object.values(genStep.interpret ?? {})) {
          const ref = parseBranchRef(value);
          if (!ref) continue;
          const file = this.app.metadataCache.getFirstLinkpathDest(ref.target, this.sourcePath);
          if (!(file instanceof TFile)) continue;
          try {
            const content = await this.app.vault.read(file);
            const doc = parseSourceDoc({ $name: file.basename, $contents: content }, "class");
            const step = selectStepBlock(doc.gmFeatures ?? [], ref.block);
            if (step) {
              const expanded = await this.expandStepUses(step);
              steps[ref.target] = expanded;
              await this.loadStepTables(expanded, tables);
              await this.loadStepCalls(expanded, calls, tables, stepTables, stepFollows, lists, steps);
            }
          } catch {
            /* unreadable / unparseable target — skip; the branch just has no dropdown */
          }
        }
      }
    }
    // The feature's OWN steps may `calls:` a generator too (a step block tested
    // in place via `gen: <self>` — the body expands those steps + children).
    await this.loadStepCalls(feature, calls, tables, stepTables, stepFollows, lists, steps);
    // The feature's OWN generators may compose sub-gens via `emits:` (Random
    // Event = Event Focus + Event Meaning) — load their tables / ramify maps /
    // lists / pick-map step blocks so a `gen: <name>` body block re-resolves.
    await this.loadGeneratorEmits(feature, tables, stepTables, stepFollows, lists, steps, genLines);
    // The feature's OWN steps may be a pick map whose choices roll tables (a page
    // declaring both a `choices` generator and what each pick spawns, e.g. Event
    // Meaning) — load those so a picked line auto-fills when rolled.
    await this.loadStepTables(feature, tables);
    // Lists the feature ITSELF `reads:` (its own declared imports).
    await this.loadReadsLists([feature], lists);
    // Lists declared on features we already loaded (own + `reads:`), merged over
    // any imported-list declarations fetched above.
    Object.assign(lists, { ...collectLists(resFeatures), ...lists });
    return {
      steps,
      tables,
      dials,
      calls,
      stepTables,
      stepFollows,
      lists,
      genLines,
      resources: collectResources(resFeatures),
    };
  }

  /** Splice a step-block's `use: @[[…]]` steps with the imported block's steps
   *  (composition), so a shared step-set is defined once and reused. */
  private async expandStepUses(step: GMFeature): Promise<GMFeature> {
    const links = stepUseLinks(step.steps ?? []);
    if (links.length === 0) return step;
    const resolved: Record<string, GMStep[]> = {};
    for (const link of links) {
      const tref = parseBranchRef(link);
      const file = this.app.metadataCache.getFirstLinkpathDest(tref?.target ?? link, this.sourcePath);
      if (!(file instanceof TFile)) continue;
      try {
        const doc = parseSourceDoc({ $name: file.basename, $contents: await this.app.vault.read(file) }, "class");
        const target = selectStepBlock(doc.gmFeatures ?? [], tref?.block);
        if (target?.steps) resolved[link] = target.steps;
      } catch {
        /* unresolved use: → that splice step drops out */
      }
    }
    return { ...step, steps: spliceStepUses(step.steps ?? [], resolved) };
  }

  /** Load each `table`-backed step's linked `rpg table.*` so its roll can
   *  auto-fill the matched row. Keyed by the step's raw `table` ref; the block
   *  id (`@[[file]]#id`) selects the specific table when a page has several. */
  private async loadStepTables(step: GMFeature, into: Record<string, TableDef>): Promise<void> {
    for (const s of step.steps ?? []) {
      const refs = [...(s.table ? [s.table] : []), ...(s.tables ?? [])];
      for (const rawRef of refs) {
        if (into[rawRef]) continue;
        const ref = parseBranchRef(rawRef);
        const file = this.app.metadataCache.getFirstLinkpathDest(ref?.target ?? rawRef, this.sourcePath);
        if (!(file instanceof TFile)) continue;
        try {
          const content = await this.app.vault.read(file);
          const doc = parseSourceDoc({ $name: file.basename, $contents: content }, "class");
          const table = (ref?.block && doc.tables.find((t) => t.name === ref.block)) || doc.tables[0];
          if (table) into[rawRef] = table;
        } catch {
          /* skip an unreadable table — the step just won't auto-fill */
        }
      }
    }
  }

  /** Resolve each step's `calls:` ref to the child lines (its generator's steps)
   *  laid out as `+ ` children, and load any TABLE each of those generator steps
   *  rolls (so the children auto-fill on roll). A table-backed step whose result
   *  is `interpret`ed records its follow-up map, and any LIST that map consults
   *  (`[Characters?]`) is loaded so the consult resolves to its default. A called
   *  generator that composes sub-generators via `emits:` (Random Event = Event
   *  Focus + Event Meaning) has them expanded here, and any step block a `choices`
   *  step needs for its pick map is registered into `steps`. */
  private async loadStepCalls(
    step: GMFeature,
    into: Record<string, string[]>,
    tables: Record<string, TableDef>,
    stepTables: Record<string, string>,
    stepFollows: Record<string, import("lib/domains/features/types").GMInterpret>,
    lists: Record<string, ListDecl>,
    steps: Record<string, GMFeature>
  ): Promise<void> {
    for (const s of step.steps ?? []) {
      if (!s.calls || into[s.calls.trim()]) continue;
      const ref = parseBranchRef(s.calls);
      const features = await this.readGMFeatures(ref?.target ?? s.calls);
      if (!features) continue;
      const gen = selectGenerator(features, ref?.block);
      if (!gen) continue;
      // Lists the called file (and any sub-generator file) explicitly `reads:`
      // travel with the call; step blocks a `choices` step needs feed the pick map.
      await this.loadReadsLists(features, lists);
      const expanded = await expandCalledGenerator(gen, (t) => this.readGMFeatures(t));
      await this.loadReadsLists(expanded.readsFeatures, lists);
      for (const sb of expanded.stepBlocks) {
        if (sb.name && !steps[sb.name]) steps[sb.name] = sb;
        await this.loadStepTables(sb, tables); // a `choices` pick's word-pair tables
      }
      into[s.calls.trim()] = expanded.steps.map((gs) => genStepLine(gs)).filter((l): l is string => !!l);
      await this.loadGenStepTables(expanded.steps, tables, stepTables, stepFollows);
    }
  }

  /** Load the composition context for a feature's OWN generators that compose
   *  sub-gens via `emits:` (Random Event = Event Focus + Event Meaning), so a
   *  `gen: <name>` block in the feature's body re-resolves the composed working
   *  lines on the page: their tables (auto-fill), `interpret` (ramify) maps, the
   *  lists they `reads:`, and any `choices` step's pick-map step block. */
  private async loadGeneratorEmits(
    feature: GMFeature,
    tables: Record<string, TableDef>,
    stepTables: Record<string, string>,
    stepFollows: Record<string, import("lib/domains/features/types").GMInterpret>,
    lists: Record<string, ListDecl>,
    steps: Record<string, GMFeature>,
    genLines: Record<string, string[]>
  ): Promise<void> {
    for (const gen of [feature.generator, ...(feature.generators ?? [])]) {
      if (!gen) continue;
      // `emits:` composes sub-generators from other files; a plain `steps:`
      // generator expands to just its own steps. Both cases yield the working
      // lines a `gen: <name>` body block is populated from.
      const expanded = await expandCalledGenerator(gen, (t) => this.readGMFeatures(t));
      await this.loadReadsLists(expanded.readsFeatures, lists);
      for (const sb of expanded.stepBlocks) {
        if (sb.name && !steps[sb.name]) steps[sb.name] = sb;
        await this.loadStepTables(sb, tables); // a `choices` pick's word-pair tables
      }
      await this.loadGenStepTables(expanded.steps, tables, stepTables, stepFollows);
      // The composed working lines, so an empty `gen: <name>` block in the body
      // is populated from them (the generator equivalent of a step block's steps).
      genLines[gen.name] = expanded.steps.map((gs) => genStepLine(gs)).filter((l): l is string => !!l);
    }
  }

  /** For each generator step that rolls a table, load the `TableDef` + map its
   *  work-label → table ref (auto-fill), and record a table-backed step's
   *  `interpret` as its result→follow-up map. */
  private async loadGenStepTables(
    gsteps: import("lib/domains/features/types").GMGenStep[],
    tables: Record<string, TableDef>,
    stepTables: Record<string, string>,
    stepFollows: Record<string, import("lib/domains/features/types").GMInterpret>
  ): Promise<void> {
    for (const gs of gsteps) {
      if (gs.work && gs.interpret) stepFollows[gs.work] = gs.interpret;
      if (!gs.table || !gs.work || tables[gs.table]) continue;
      stepTables[gs.work] = gs.table;
      const tref = parseBranchRef(gs.table);
      const tf = this.app.metadataCache.getFirstLinkpathDest(tref?.target ?? gs.table, this.sourcePath);
      if (!(tf instanceof TFile)) continue;
      try {
        const tdoc = parseSourceDoc({ $name: tf.basename, $contents: await this.app.vault.read(tf) }, "class");
        const table = (tref?.block && tdoc.tables.find((t) => t.name === tref.block)) || tdoc.tables[0];
        if (table) tables[gs.table] = table;
      } catch {
        /* skip an unreadable table — the step just won't auto-fill */
      }
    }
  }

  /** Read a linked file's GM features by wikilink target, or null when
   *  unresolved / unparseable. */
  private async readGMFeatures(target: string): Promise<GMFeature[] | null> {
    const f = this.app.metadataCache.getFirstLinkpathDest(target, this.sourcePath);
    if (!(f instanceof TFile)) return null;
    try {
      return parseSourceDoc({ $name: f.basename, $contents: await this.app.vault.read(f) }, "class").gmFeatures ?? null;
    } catch {
      return null;
    }
  }

  /** Load the `list:` feature each of `features`' `reads:` links points at into
   *  the registry, so a consult (`[Characters?]`) resolves to its default. Only
   *  EXPLICITLY imported lists load — a bare consult token never triggers a
   *  load, so lists don't leak onto features that didn't ask for them. */
  private async loadReadsLists(features: GMFeature[], lists: Record<string, ListDecl>): Promise<void> {
    for (const feature of features) {
      for (const ref of feature.reads ?? []) {
        const target = parseBranchRef(ref)?.target ?? ref;
        const file = this.app.metadataCache.getFirstLinkpathDest(target, this.sourcePath);
        if (!(file instanceof TFile)) continue;
        try {
          const doc = parseSourceDoc({ $name: file.basename, $contents: await this.app.vault.read(file) }, "class");
          Object.assign(lists, collectLists(doc.gmFeatures ?? []));
        } catch {
          /* unreadable list — the consult falls back to the raw `[Name?]` ref */
        }
      }
    }
  }
}

export class FeatureGMView extends BaseView {
  public codeblock = "feature.gm";

  // Mount React directly rather than the BaseView string path (the card body
  // needs Obsidian's async MarkdownRenderer, like feature.details).
  public register(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    ctx.addChild(new FeatureGMRenderChild(el, this.app, source, ctx.sourcePath));
  }

  // Unused — `register` handles mounting. Declared to satisfy BaseView.
  public render(): void {}
}
