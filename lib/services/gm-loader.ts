/**
 * A GM Screen and the tools it links, loaded into GM features and the step
 * context their generators roll against (tables, step blocks, dials, lists,
 * called sub-generators). Shared by the session log, the draft block and the
 * headless CLI: notes are reached through a `NoteReader`, so it needs no
 * Obsidian API itself.
 */

import { parseSourceDoc } from "lib/domains/features/parse-source-doc";
import type { GMFeature, GMGeneratorAspect, GMInterpret, GMStep } from "lib/domains/features/types";
import { cardXFileRefs, inlineCardXFileRefs, selectGenerator } from "lib/domains/gm/card-refs";
import { generatorSteps, genStepLine } from "lib/domains/gm/emit";
import type { GMStepContext } from "lib/domains/gm/example";
import { expandCalledGenerator } from "lib/domains/gm/expand-gen";
import { parseBranchRef, selectStepBlock, spliceStepUses, stepUseLinks } from "lib/domains/gm/steps";
import { collectResources } from "lib/domains/lonelog/dial-ops";
import { collectLists, type ListDecl } from "lib/domains/lonelog/list-ops";
import type { TableDef } from "lib/domains/tables/types";

/** A note as the loader sees it: found by link, read whole, its frontmatter. */
export interface NoteRef {
  /** Its name, without extension (what `parseSourceDoc` calls `$name`). */
  name: string;
}

export interface NoteReader<N extends NoteRef = NoteRef> {
  /** A `[[wikilink]]` (or bare name) resolved from the note doing the loading, or null. */
  resolve(ref: string): N | null;
  read(note: N): Promise<string>;
  frontmatter(note: N): Record<string, unknown> | undefined;
}

export class GMLoader<N extends NoteRef = NoteRef> {
  constructor(private reader: NoteReader<N>) {}

  /** Parse a file's `rpg feature.gm` blocks into GMFeatures. */
  async loadGMFeatures(file: N): Promise<GMFeature[]> {
    const content = await this.reader.read(file);
    return parseSourceDoc({ $name: file.name, $contents: content }, "class").gmFeatures ?? [];
  }

  /**
   * Load a linked GM Screen: its own `rpg feature.gm` blocks plus every tool it
   * assigns via the `gm-tools:` frontmatter (each a `[[wikilink]]` to a tool page
   * under gm-tools/<type>/). All become GM card stacks. The wikilink is resolved
   * relative to this note via Obsidian's metadata cache.
   */
  async loadGMScreen(ref: string): Promise<GMFeature[]> {
    try {
      const file = this.reader.resolve(ref);
      if (!file) {
        console.warn(`rpg log: GM screen "${ref}" not found`);
        return [];
      }
      const features = await this.loadGMFeatures(file);

      const fm = this.reader.frontmatter(file);
      const assigned = fm?.["gm-tools"];
      const refs = Array.isArray(assigned) ? assigned : assigned != null ? [assigned] : [];
      for (const toolRef of refs) {
        const toolFile = this.reader.resolve(String(toolRef));
        if (toolFile) features.push(...(await this.loadGMFeatures(toolFile)));
      }
      // Resolve each feature's cross-file card `@ref`s (`@[[File]]#id`) into
      // inlined `generators:` entries so the emitter sees them as local refs.
      const resolved: GMFeature[] = [];
      for (const f of features) resolved.push(await this.resolveCardRefs(f));
      return resolved;
    } catch (error) {
      console.error("Error loading GM screen:", error);
      return [];
    }
  }

  /**
   * Resolve a feature's cross-file card refs (`@[[File]]#id`) by reading each
   * target page, selecting the addressed generator (a `generators:` entry or a
   * feature.gm whose `id:` matches), and inlining it — after which `emitCard`
   * treats the ref as a local `@id`. Unresolved refs are left for the emitter
   * to drop.
   */
  async resolveCardRefs(feature: GMFeature): Promise<GMFeature> {
    const refs = cardXFileRefs(feature);
    if (refs.length === 0) return feature;
    const resolved: Record<string, GMGeneratorAspect> = {};
    for (const ref of refs) {
      const bref = parseBranchRef(ref);
      if (!bref) continue;
      const file = this.reader.resolve(bref.target);
      if (!file) continue;
      try {
        const doc = parseSourceDoc({ $name: file.name, $contents: await this.reader.read(file) }, "class");
        const gen = selectGenerator(doc.gmFeatures ?? [], bref.block);
        if (gen) resolved[ref] = gen;
      } catch {
        /* unreadable target — leave unresolved; emitCard drops the ref */
      }
    }
    return inlineCardXFileRefs(feature, resolved);
  }

  /**
   * Resolve the GM features' `interpret` branch links to step blocks (and any
   * tables those steps roll against), plus the dials they `reads:`, so the live
   * sidebar can surface the branch dropdown, auto-fill table/fate results, and
   * fall back to a dial's `default` when the log omits its `[<abbr>:n]` token.
   * Mirrors FeatureGMView.
   */
  async loadStepCtx(features: GMFeature[]): Promise<GMStepContext> {
    const steps: Record<string, GMFeature> = {};
    const tables: Record<string, TableDef> = {};
    const calls: Record<string, string[]> = {};
    const stepTables: Record<string, string> = {};
    const stepFollows: Record<string, GMInterpret> = {};
    const lists: Record<string, ListDecl> = {};
    const dials: NonNullable<GMStepContext["dials"]> = {};
    const resFeatures: GMFeature[] = [...features];
    for (const feature of features) {
      // A dial declaration imported onto the GM Screen (via `gm-tools:`) is
      // itself a loaded feature — register its dial so the whole log can read
      // its current value / `default` (the session-wide path).
      if (feature.dial?.abbr && !dials[feature.dial.abbr])
        dials[feature.dial.abbr] = { ...feature.dial, name: feature.name };
      // A feature may also DECLARE a dial dependency via `reads:` (e.g. used
      // standalone, off-screen) — resolve those links too.
      for (const ref of feature.reads ?? []) {
        const file = this.reader.resolve(ref);
        if (!file) continue;
        try {
          const loaded = await this.loadGMFeatures(file);
          resFeatures.push(...loaded);
          for (const f of loaded) {
            if (f.dial?.abbr && !dials[f.dial.abbr]) dials[f.dial.abbr] = { ...f.dial, name: f.name };
          }
        } catch {
          /* unreadable dial — skip; CF resolution falls back to its legacy path */
        }
      }
      for (const gen of [feature.generator, ...(feature.generators ?? [])]) {
        for (const genStep of gen ? generatorSteps(gen) : []) {
          for (const value of Object.values(genStep.interpret ?? {})) {
            const ref = parseBranchRef(value);
            if (!ref || steps[ref.target]) continue;
            const file = this.reader.resolve(ref.target);
            if (!file) continue;
            try {
              const doc = parseSourceDoc({ $name: file.name, $contents: await this.reader.read(file) }, "class");
              const step = selectStepBlock(doc.gmFeatures ?? [], ref.block);
              if (!step) continue;
              const expanded = await this.expandStepUses(step);
              steps[ref.target] = expanded;
              for (const s of expanded.steps ?? []) {
                const refs = [...(s.table ? [s.table] : []), ...(s.tables ?? [])];
                for (const rawRef of refs) {
                  if (tables[rawRef]) continue;
                  const tref = parseBranchRef(rawRef);
                  const tf = this.reader.resolve(tref?.target ?? rawRef);
                  if (!tf) continue;
                  const tdoc = parseSourceDoc({ $name: tf.name, $contents: await this.reader.read(tf) }, "class");
                  const table = (tref?.block && tdoc.tables.find((t) => t.name === tref.block)) || tdoc.tables[0];
                  if (table) tables[rawRef] = table;
                }
                // A step that `calls:` a sub-procedure → resolve its generator's
                // steps into the child lines laid out as `+ ` children (expanding
                // any cross-file `emits:` sub-generators), and load any TABLE
                // those steps roll (so children auto-fill).
                if (s.calls && !calls[s.calls.trim()]) {
                  const cref = parseBranchRef(s.calls);
                  const cfile = this.reader.resolve(cref?.target ?? s.calls);
                  if (cfile) {
                    const cdoc = parseSourceDoc(
                      { $name: cfile.name, $contents: await this.reader.read(cfile) },
                      "class"
                    );
                    const gen = selectGenerator(cdoc.gmFeatures ?? [], cref?.block);
                    if (gen) {
                      // Lists the called file (and sub-generator files) `reads:`
                      // travel with the call; step blocks a `choices` step needs
                      // feed the pick map.
                      await this.loadReadsLists(cdoc.gmFeatures ?? [], lists);
                      const expanded = await expandCalledGenerator(gen, (t) => this.readGMFeatures(t));
                      await this.loadReadsLists(expanded.readsFeatures, lists);
                      for (const sb of expanded.stepBlocks) {
                        if (sb.name && !steps[sb.name]) steps[sb.name] = sb;
                        // A `choices` pick's word-pair tables (Actions/Descriptions).
                        for (const bs of sb.steps ?? []) {
                          for (const rawRef of [...(bs.table ? [bs.table] : []), ...(bs.tables ?? [])]) {
                            if (tables[rawRef]) continue;
                            const btref = parseBranchRef(rawRef);
                            const btf = this.reader.resolve(btref?.target ?? rawRef);
                            if (!btf) continue;
                            const btdoc = parseSourceDoc(
                              { $name: btf.name, $contents: await this.reader.read(btf) },
                              "class"
                            );
                            const bt =
                              (btref?.block && btdoc.tables.find((t) => t.name === btref.block)) || btdoc.tables[0];
                            if (bt) tables[rawRef] = bt;
                          }
                        }
                      }
                      const gsteps = expanded.steps;
                      calls[s.calls.trim()] = gsteps.map((gs) => genStepLine(gs)).filter((l): l is string => !!l);
                      for (const gs of gsteps) {
                        if (gs.work && gs.interpret) stepFollows[gs.work] = gs.interpret;
                        if (!gs.table || !gs.work) continue;
                        stepTables[gs.work] = gs.table;
                        if (tables[gs.table]) continue;
                        const gtref = parseBranchRef(gs.table);
                        const gtf = this.reader.resolve(gtref?.target ?? gs.table);
                        if (!gtf) continue;
                        const gtdoc = parseSourceDoc(
                          { $name: gtf.name, $contents: await this.reader.read(gtf) },
                          "class"
                        );
                        const gtable =
                          (gtref?.block && gtdoc.tables.find((t) => t.name === gtref.block)) || gtdoc.tables[0];
                        if (gtable) tables[gs.table] = gtable;
                      }
                    }
                  }
                }
              }
            } catch {
              /* unreadable target — skip; that branch just has no dropdown/auto-fill */
            }
          }
        }
      }
    }
    // Lists the GM-screen features THEMSELVES `reads:` (their declared imports).
    await this.loadReadsLists(features, lists);
    // A GM feature's OWN steps may be a pick map whose choices roll tables (a
    // feature declaring both a `choices` generator and what each pick spawns) —
    // load those so a picked line auto-fills when rolled.
    for (const feature of features) {
      for (const s of feature.steps ?? []) {
        for (const rawRef of [...(s.table ? [s.table] : []), ...(s.tables ?? [])]) {
          if (tables[rawRef]) continue;
          const oref = parseBranchRef(rawRef);
          const of = this.reader.resolve(oref?.target ?? rawRef);
          if (!of) continue;
          try {
            const odoc = parseSourceDoc({ $name: of.name, $contents: await this.reader.read(of) }, "class");
            const ot = (oref?.block && odoc.tables.find((t) => t.name === oref.block)) || odoc.tables[0];
            if (ot) tables[rawRef] = ot;
          } catch {
            /* skip an unreadable table — that pick just won't auto-fill */
          }
        }
      }
    }
    // A GM feature's own generator → its working lines (its own `steps:`, plus
    // any cross-file `emits:` sub-gens composed in), so a log's empty
    // `gen: <name>` block is populated from them.
    const genLines: Record<string, string[]> = {};
    for (const feature of features) {
      for (const gen of [feature.generator, ...(feature.generators ?? [])]) {
        if (!gen || genLines[gen.name]) continue;
        const expanded = await expandCalledGenerator(gen, (t) => this.readGMFeatures(t));
        await this.loadReadsLists(expanded.readsFeatures, lists);
        for (const sb of expanded.stepBlocks) if (sb.name && !steps[sb.name]) steps[sb.name] = sb;
        for (const gs of expanded.steps) {
          if (gs.work && gs.interpret) stepFollows[gs.work] = gs.interpret;
          if (!gs.table || !gs.work) continue;
          stepTables[gs.work] = gs.table;
          if (tables[gs.table]) continue;
          const gtref = parseBranchRef(gs.table);
          const gtf = this.reader.resolve(gtref?.target ?? gs.table);
          if (!gtf) continue;
          const gtdoc = parseSourceDoc({ $name: gtf.name, $contents: await this.reader.read(gtf) }, "class");
          const gtable = (gtref?.block && gtdoc.tables.find((t) => t.name === gtref.block)) || gtdoc.tables[0];
          if (gtable) tables[gs.table] = gtable;
        }
        genLines[gen.name] = expanded.steps.map((gs) => genStepLine(gs)).filter((l): l is string => !!l);
      }
    }
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

  /** Read a linked file's GM features by wikilink target (for the composition
   *  expander), or null when unresolved / unparseable. */
  async readGMFeatures(target: string): Promise<GMFeature[] | null> {
    const file = this.reader.resolve(target);
    if (!file) return null;
    try {
      return parseSourceDoc({ $name: file.name, $contents: await this.reader.read(file) }, "class").gmFeatures ?? null;
    } catch {
      return null;
    }
  }

  /** Load the `list:` feature each of `features`' `reads:` links points at into
   *  the registry, so a consult (`[Characters?]`) resolves to its default. Only
   *  EXPLICITLY imported lists load — a bare consult token never triggers a
   *  load, so lists don't leak onto features that didn't ask for them. */
  async loadReadsLists(features: GMFeature[], lists: Record<string, ListDecl>): Promise<void> {
    for (const feature of features) {
      for (const ref of feature.reads ?? []) {
        const file = this.reader.resolve(parseBranchRef(ref)?.target ?? ref);
        if (!file) continue;
        try {
          const doc = parseSourceDoc({ $name: file.name, $contents: await this.reader.read(file) }, "class");
          Object.assign(lists, collectLists(doc.gmFeatures ?? []));
        } catch {
          /* unreadable list — the consult falls back to the raw `[Name?]` ref */
        }
      }
    }
  }

  /** Splice a step-block's `use: @[[…]]` steps with the imported block's steps
   *  (composition), so a shared step-set is defined once and reused. */
  async expandStepUses(step: GMFeature): Promise<GMFeature> {
    const links = stepUseLinks(step.steps ?? []);
    if (links.length === 0) return step;
    const resolved: Record<string, GMStep[]> = {};
    for (const link of links) {
      const tref = parseBranchRef(link);
      const file = this.reader.resolve(tref?.target ?? link);
      if (!file) continue;
      try {
        const doc = parseSourceDoc({ $name: file.name, $contents: await this.reader.read(file) }, "class");
        const target = selectStepBlock(doc.gmFeatures ?? [], tref?.block);
        if (target?.steps) resolved[link] = target.steps;
      } catch {
        /* unresolved use: → that splice step drops out */
      }
    }
    return { ...step, steps: spliceStepUses(step.steps ?? [], resolved) };
  }
}
