/**
 * Session Log View
 * Renders Lonelog session logs with interactive action cards and delta tracking
 */

import { BaseView } from "./BaseView";
import { App, MarkdownPostProcessorContext, TFile } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { KeyValueStore } from "lib/services/kv/kv";
import { ReactMarkdown } from "./ReactMarkdown";
import { parseSessionLogBlock, processSessionLog } from "lib/domains/session-log";
import type { SessionLogData } from "lib/domains/session-log";
import { EntityResolver } from "lib/services/entity-resolver";
import type { EntityData } from "lib/services/entity-resolver";
import { ProseView } from "lib/components/session-log/prose-view";
import { LogSidebar } from "lib/components/session-log/log-sidebar";
import type { SceneEditValue } from "lib/components/session-log/log-sidebar";
import { groupIntoProse } from "lib/domains/session-log/prose-grouper";
import { resolveDialOps, collectResources, foldResources, type DialDecl } from "lib/domains/lonelog/dial-ops";
import { collectLists, resolveListOps, type ListDecl } from "lib/domains/lonelog/list-ops";
import {
  assembleProse,
  buildSidebarItems,
  reconstructScene,
  applySceneEdits,
  applyTokenEdits,
  dieEditKey,
  resultEditKey,
} from "lib/domains/session-log/prose-model";
import {
  parseFormula,
  editableTerms,
  setTermRaw,
  termSlots,
  termSlotInitial,
  combineTermValue,
  resultReplacement,
} from "lib/domains/session-log/formula";
import type { EditableTerm } from "lib/domains/session-log/formula";
import { ChangeOverview } from "lib/components/session-log/change-overview";
import { BottomDrawer } from "lib/components/session-log/bottom-drawer";
import { SessionActionsPanel } from "lib/components/session-log/session-actions-panel";
import {
  extractCardsFromEntity,
  extractResourcesFromEntity,
  getEntitySpentState,
} from "lib/services/session-feature-loader";
import { buildGMStacks, buildGMStacksFromFeatures } from "lib/domains/session-log/gm-cards";
import { buildCardStacks } from "lib/domains/session-log/extract-cards";
import { parseSourceDoc } from "lib/domains/features/parse-source-doc";
import type { GMFeature, GMStep, GMGeneratorAspect } from "lib/domains/features/types";
import type { TableDef } from "lib/domains/tables/types";
import { applyChoicePick } from "lib/domains/session-log/choice";
import { gmStepLines, resolveGmBody, type GMStepContext } from "lib/domains/gm/example";
import { generatorSteps, genStepLine } from "lib/domains/gm/emit";
import { parseBranchRef, selectStepBlock, stepUseLinks, spliceStepUses } from "lib/domains/gm/steps";
import { cardXFileRefs, inlineCardXFileRefs, selectGenerator } from "lib/domains/gm/card-refs";
import { expandCalledGenerator } from "lib/domains/gm/expand-gen";
import type { CardStack, SessionFeatureCard } from "lib/domains/session-log/card-types";
import { initSessionConsumables, spendUse } from "lib/domains/session-log/consumable-state";
import type { SessionConsumableState } from "lib/domains/session-log/consumable-state";

export class SessionLogView extends BaseView {
  public codeblock = "log";
  private kv: KeyValueStore;
  private entityResolver: EntityResolver;

  constructor(app: App, kv: KeyValueStore) {
    super(app);
    this.kv = kv;
    this.entityResolver = new EntityResolver(app);
  }

  public render(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    const sessionLogMarkdown = new SessionLogMarkdown(
      el,
      source,
      this.kv,
      this.entityResolver,
      ctx.sourcePath,
      ctx,
      this
    );
    ctx.addChild(sessionLogMarkdown);
  }
}

class SessionLogMarkdown extends ReactMarkdown {
  private source: string;
  private kv: KeyValueStore;
  private entityResolver: EntityResolver;
  private filePath: string;
  private ctx: MarkdownPostProcessorContext;
  private baseView: BaseView;
  private logData: SessionLogData | null = null;
  private entities: EntityData[] = [];
  private gmFeatures: GMFeature[] = [];
  private stepCtx: GMStepContext = {};
  private stateKey = "default-log";
  private initialSidebarOpen = false;

  constructor(
    el: HTMLElement,
    source: string,
    kv: KeyValueStore,
    entityResolver: EntityResolver,
    filePath: string,
    ctx: MarkdownPostProcessorContext,
    baseView: BaseView
  ) {
    super(el);
    this.source = source;
    this.kv = kv;
    this.entityResolver = entityResolver;
    this.filePath = filePath;
    this.ctx = ctx;
    this.baseView = baseView;
  }

  async onload() {
    await this.processAndRender();
  }

  private async processAndRender() {
    try {
      const block = parseSessionLogBlock(this.source);
      this.logData = processSessionLog(block);
      this.stateKey = block.state_key;
      this.initialSidebarOpen = (await this.kv.get<boolean>(`${block.state_key}:log-sidebar-open`)) === true;

      if (block.entities && block.entities.length > 0) {
        this.entities = await this.entityResolver.resolveEntities(block.entities);
      }

      if (block.gm) {
        this.gmFeatures = await this.loadGMScreen(block.gm);
        this.stepCtx = await this.loadStepCtx(this.gmFeatures);
      }

      // Fold PC-declared resources (feature.details `resources:` + legacy
      // `type: resource`) into the resource registry, so `[Char/Resource op]`
      // tokens resolve to running values seeded from the sheet. GM resources
      // (already in the registry) win on any name collision (foldResources is
      // first-key-wins).
      if (this.entities.length > 0) {
        const decls = this.entities.flatMap((e) => extractResourcesFromEntity(e));
        if (decls.length > 0) {
          this.stepCtx = {
            ...this.stepCtx,
            resources: foldResources(decls, { ...(this.stepCtx.resources ?? {}) }),
          };
        }
      }

      this.renderSessionLog();
    } catch (error) {
      console.error("Error processing session log:", error);
      this.containerEl.innerHTML = `<div class="notice notice-error">Error processing session log: ${error instanceof Error ? error.message : String(error)}</div>`;
    }
  }

  /** Resolve a `[[wikilink]]` (or bare name) to a vault file, relative to this note. */
  private resolveLink(ref: string): TFile | null {
    const linktext = ref.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].split("#")[0].trim();
    const f = this.baseView.app.metadataCache.getFirstLinkpathDest(linktext, this.filePath);
    return f instanceof TFile ? f : null;
  }

  /** Parse a file's `rpg feature.gm` blocks into GMFeatures. */
  private async loadGMFeatures(file: TFile): Promise<GMFeature[]> {
    const content = await this.baseView.app.vault.read(file);
    return parseSourceDoc({ $name: file.basename, $contents: content }, "class").gmFeatures ?? [];
  }

  /**
   * Load a linked GM Screen: its own `rpg feature.gm` blocks plus every tool it
   * assigns via the `gm-tools:` frontmatter (each a `[[wikilink]]` to a tool page
   * under gm-tools/<type>/). All become GM card stacks. The wikilink is resolved
   * relative to this note via Obsidian's metadata cache.
   */
  private async loadGMScreen(ref: string): Promise<GMFeature[]> {
    try {
      const file = this.resolveLink(ref);
      if (!file) {
        console.warn(`rpg log: GM screen "${ref}" not found`);
        return [];
      }
      const features = await this.loadGMFeatures(file);

      const fm = this.baseView.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
      const assigned = fm?.["gm-tools"];
      const refs = Array.isArray(assigned) ? assigned : assigned != null ? [assigned] : [];
      for (const toolRef of refs) {
        const toolFile = this.resolveLink(String(toolRef));
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
  private async resolveCardRefs(feature: GMFeature): Promise<GMFeature> {
    const refs = cardXFileRefs(feature);
    if (refs.length === 0) return feature;
    const resolved: Record<string, GMGeneratorAspect> = {};
    for (const ref of refs) {
      const bref = parseBranchRef(ref);
      if (!bref) continue;
      const file = this.resolveLink(bref.target);
      if (!file) continue;
      try {
        const doc = parseSourceDoc(
          { $name: file.basename, $contents: await this.baseView.app.vault.read(file) },
          "class"
        );
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
  private async loadStepCtx(features: GMFeature[]): Promise<GMStepContext> {
    const steps: Record<string, GMFeature> = {};
    const tables: Record<string, TableDef> = {};
    const calls: Record<string, string[]> = {};
    const stepTables: Record<string, string> = {};
    const stepFollows: Record<string, import("lib/domains/features/types").GMInterpret> = {};
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
        const file = this.resolveLink(ref);
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
            const file = this.resolveLink(ref.target);
            if (!file) continue;
            try {
              const doc = parseSourceDoc(
                { $name: file.basename, $contents: await this.baseView.app.vault.read(file) },
                "class"
              );
              const step = selectStepBlock(doc.gmFeatures ?? [], ref.block);
              if (!step) continue;
              const expanded = await this.expandStepUses(step);
              steps[ref.target] = expanded;
              for (const s of expanded.steps ?? []) {
                const refs = [...(s.table ? [s.table] : []), ...(s.tables ?? [])];
                for (const rawRef of refs) {
                  if (tables[rawRef]) continue;
                  const tref = parseBranchRef(rawRef);
                  const tf = this.resolveLink(tref?.target ?? rawRef);
                  if (!tf) continue;
                  const tdoc = parseSourceDoc(
                    { $name: tf.basename, $contents: await this.baseView.app.vault.read(tf) },
                    "class"
                  );
                  const table = (tref?.block && tdoc.tables.find((t) => t.name === tref.block)) || tdoc.tables[0];
                  if (table) tables[rawRef] = table;
                }
                // A step that `calls:` a sub-procedure → resolve its generator's
                // steps into the child lines laid out as `+ ` children (expanding
                // any cross-file `emits:` sub-generators), and load any TABLE
                // those steps roll (so children auto-fill).
                if (s.calls && !calls[s.calls.trim()]) {
                  const cref = parseBranchRef(s.calls);
                  const cfile = this.resolveLink(cref?.target ?? s.calls);
                  if (cfile) {
                    const cdoc = parseSourceDoc(
                      { $name: cfile.basename, $contents: await this.baseView.app.vault.read(cfile) },
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
                            const btf = this.resolveLink(btref?.target ?? rawRef);
                            if (!btf) continue;
                            const btdoc = parseSourceDoc(
                              { $name: btf.basename, $contents: await this.baseView.app.vault.read(btf) },
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
                        const gtf = this.resolveLink(gtref?.target ?? gs.table);
                        if (!gtf) continue;
                        const gtdoc = parseSourceDoc(
                          { $name: gtf.basename, $contents: await this.baseView.app.vault.read(gtf) },
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
          const of = this.resolveLink(oref?.target ?? rawRef);
          if (!of) continue;
          try {
            const odoc = parseSourceDoc(
              { $name: of.basename, $contents: await this.baseView.app.vault.read(of) },
              "class"
            );
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
          const gtf = this.resolveLink(gtref?.target ?? gs.table);
          if (!gtf) continue;
          const gtdoc = parseSourceDoc(
            { $name: gtf.basename, $contents: await this.baseView.app.vault.read(gtf) },
            "class"
          );
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
  private async readGMFeatures(target: string): Promise<GMFeature[] | null> {
    const file = this.resolveLink(target);
    if (!file) return null;
    try {
      return (
        parseSourceDoc({ $name: file.basename, $contents: await this.baseView.app.vault.read(file) }, "class")
          .gmFeatures ?? null
      );
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
        const file = this.resolveLink(parseBranchRef(ref)?.target ?? ref);
        if (!file) continue;
        try {
          const doc = parseSourceDoc(
            { $name: file.basename, $contents: await this.baseView.app.vault.read(file) },
            "class"
          );
          Object.assign(lists, collectLists(doc.gmFeatures ?? []));
        } catch {
          /* unreadable list — the consult falls back to the raw `[Name?]` ref */
        }
      }
    }
  }

  /** Splice a step-block's `use: @[[…]]` steps with the imported block's steps
   *  (composition), so a shared step-set is defined once and reused. */
  private async expandStepUses(step: GMFeature): Promise<GMFeature> {
    const links = stepUseLinks(step.steps ?? []);
    if (links.length === 0) return step;
    const resolved: Record<string, GMStep[]> = {};
    for (const link of links) {
      const tref = parseBranchRef(link);
      const file = this.resolveLink(tref?.target ?? link);
      if (!file) continue;
      try {
        const doc = parseSourceDoc(
          { $name: file.basename, $contents: await this.baseView.app.vault.read(file) },
          "class"
        );
        const target = selectStepBlock(doc.gmFeatures ?? [], tref?.block);
        if (target?.steps) resolved[link] = target.steps;
      } catch {
        /* unresolved use: → that splice step drops out */
      }
    }
    return { ...step, steps: spliceStepUses(step.steps ?? [], resolved) };
  }

  /** Rewrite the `rpg log` block body via a transform, then persist. The
   *  generalized form of {@link appendToLogBody} used for GM step picks. */
  private async rewriteLogBody(transform: (body: string) => string) {
    const file = this.baseView.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) return;
    const content = await this.baseView.app.vault.read(file);
    const codeBlockRegex = /(```rpg log\n[\s\S]*?---\n)([\s\S]*?)(```)/;
    const match = content.match(codeBlockRegex);
    if (!match) return;
    const [, header, body, closing] = match;
    const updatedBody = transform(body);
    if (updatedBody === body) return;
    await this.baseView.app.vault.modify(file as any, `${header}${updatedBody}${closing}`);
  }

  /** A GM step dropdown pick: insert the chosen step's `label: calc` line under
   *  the gen: (via applyChoicePick), re-resolve, and persist to the note. */
  private async onChoicePick(selected: string) {
    const stepLines = Object.assign({}, ...this.gmFeatures.map((f) => gmStepLines(f, this.stepCtx)));
    await this.rewriteLogBody((body) =>
      resolveGmBody(applyChoicePick(body, selected, stepLines), this.gmFeatures, this.stepCtx)
    );
  }

  private async appendToLogBody(newText: string) {
    try {
      const file = this.baseView.app.vault.getAbstractFileByPath(this.filePath);
      if (!file || !(file instanceof TFile)) {
        console.error("File not found:", this.filePath);
        return;
      }

      const content = await this.baseView.app.vault.read(file);
      const codeBlockRegex = /(```rpg log\n[\s\S]*?---\n)([\s\S]*?)(```)/;
      const match = content.match(codeBlockRegex);

      if (!match) {
        console.error("Could not find rpg log code block in file");
        return;
      }

      const [, header, body, closing] = match;
      const updatedBody = body + newText;
      const updatedBlock = `${header}${updatedBody}${closing}`;
      const updatedContent = content.replace(codeBlockRegex, updatedBlock);

      await this.baseView.app.vault.modify(file as any, updatedContent);
    } catch (error) {
      console.error("Error appending to log:", error);
    }
  }

  /**
   * Rewrite the code-block body for sidebar edits: scene `=> …` lines (matched
   * by text after `=>`) and inline die values (a token swap on a matched line).
   * Both are applied to one read of the file and written once.
   */
  private async editLogBody(
    sceneReplacements: Array<{ from: string; to: string }>,
    dieReplacements: Array<{ line: string; from: string; to: string }>
  ) {
    if (sceneReplacements.length === 0 && dieReplacements.length === 0) return;
    try {
      const file = this.baseView.app.vault.getAbstractFileByPath(this.filePath);
      if (!file || !(file instanceof TFile)) {
        console.error("File not found:", this.filePath);
        return;
      }

      const content = await this.baseView.app.vault.read(file);
      let updatedContent = applySceneEdits(content, sceneReplacements);
      updatedContent = applyTokenEdits(updatedContent, dieReplacements);
      // Re-resolve GM-feature lines from their now-edited dice so a rolled
      // branch surfaces its label + step dropdown (and step lines auto-fill).
      if (this.gmFeatures.length > 0) {
        updatedContent = updatedContent.replace(
          /(```rpg log\n[\s\S]*?---\n)([\s\S]*?)(```)/,
          (_m, h, b, c) => `${h}${resolveGmBody(b, this.gmFeatures, this.stepCtx)}${c}`
        );
      }
      if (updatedContent === content) {
        console.warn("rpg log: no edited lines matched; nothing saved");
        return;
      }
      await this.baseView.app.vault.modify(file as any, updatedContent);
    } catch (error) {
      console.error("Error editing log:", error);
    }
  }

  private buildActionCards(): {
    pcStacks: Map<string, CardStack[]>;
    gmStacks: CardStack[];
    allCards: SessionFeatureCard[];
    sheetSpent: Record<string, number>;
  } {
    const pcStacks = new Map<string, CardStack[]>();
    let allCards: SessionFeatureCard[] = [];
    let sheetSpent: Record<string, number> = {};

    for (const entity of this.entities) {
      const cards = extractCardsFromEntity(entity);
      if (cards.length > 0) {
        const stacks = buildCardStacks(cards, entity.name);
        pcStacks.set(entity.name, stacks);
        allCards = allCards.concat(cards);
        const entitySpent = getEntitySpentState(entity);
        sheetSpent = { ...sheetSpent, ...entitySpent };
      }
    }

    const gmStacks = this.gmFeatures.length > 0 ? buildGMStacksFromFeatures(this.gmFeatures) : buildGMStacks();
    // Authored GM cards can carry `uses`; fold them into the consumable set so
    // their counters render and spend in-session.
    for (const stack of gmStacks) {
      for (const card of stack.cards) {
        if (card.maxUses != null) allCards.push(card);
      }
    }
    return { pcStacks, gmStacks, allCards, sheetSpent };
  }

  private renderSessionLog() {
    if (!this.logData) {
      this.containerEl.innerHTML = '<div class="notice">No log data available</div>';
      return;
    }

    // Reuse the instance's React root so it is unmounted on unload (see
    // ReactMarkdown.onunload) and never double-created on re-render.
    if (this.reactRoot) this.reactRoot.unmount();
    this.reactRoot = ReactDOM.createRoot(this.containerEl);
    const { pcStacks, gmStacks, allCards, sheetSpent } = this.buildActionCards();
    const entityNames = this.entities.map((e) => e.name);
    const initialConsumableState = initSessionConsumables(allCards, sheetSpent);

    const handleAppendText = async (text: string) => {
      await this.appendToLogBody(text);
    };

    this.reactRoot.render(
      <SessionLogRoot
        logData={this.logData}
        sourcePath={this.filePath}
        initialSidebarOpen={this.initialSidebarOpen}
        onSidebarToggle={(open) => void this.kv.set(`${this.stateKey}:log-sidebar-open`, open)}
        pcStacks={pcStacks}
        gmStacks={gmStacks}
        entityNames={entityNames}
        initialConsumableState={initialConsumableState}
        onAppendText={handleAppendText}
        onChoice={(selected) => void this.onChoicePick(selected)}
        onSave={(edits) => this.editLogBody(edits.scenes, edits.dice)}
        resources={this.stepCtx.resources ?? {}}
        lists={this.stepCtx.lists ?? {}}
      />
    );
  }
}

interface SessionLogRootProps {
  logData: SessionLogData;
  sourcePath: string;
  initialSidebarOpen: boolean;
  onSidebarToggle: (open: boolean) => void;
  pcStacks: Map<string, CardStack[]>;
  gmStacks: CardStack[];
  entityNames: string[];
  initialConsumableState: SessionConsumableState;
  onAppendText: (text: string) => void;
  /** A GM step dropdown pick — inserts the chosen step line into the note. */
  onChoice: (selected: string) => void;
  onSave: (edits: {
    scenes: Array<{ from: string; to: string }>;
    dice: Array<{ line: string; from: string; to: string }>;
  }) => void | Promise<void>;
  /** Declared resources (session by abbr, PC by name) for resolving
   *  `[<abbr>±n]` / `[<PC>/<name>±n]` ops to running values. */
  resources: Record<string, DialDecl>;
  /** Declared lonelog lists (by name) for folding `[Name+ …]` / `[Name?]` ops
   *  into running entries. */
  lists: Record<string, ListDecl>;
}

function SessionLogRoot({
  logData,
  sourcePath,
  initialSidebarOpen,
  onSidebarToggle,
  pcStacks,
  gmStacks,
  entityNames,
  initialConsumableState,
  onAppendText,
  onChoice,
  onSave,
  resources,
  lists,
}: SessionLogRootProps) {
  const [consumableState, setConsumableState] = React.useState(initialConsumableState);
  const [sidebarOpen, setSidebarOpen] = React.useState(initialSidebarOpen);
  const [sceneEdits, setSceneEdits] = React.useState<Record<string, SceneEditValue>>({});
  const [dieEdits, setDieEdits] = React.useState<Record<string, string>>({});
  /** Pending token swaps (list-consult picks), applied on save like die edits. */
  const [tokenEdits, setTokenEdits] = React.useState<Array<{ line: string; from: string; to: string; nth: number }>>(
    []
  );
  // `n` forces the scroll effect to re-run even when the same id is re-clicked.
  const [selection, setSelection] = React.useState<{ id: number; side: "prose" | "sidebar"; n: number } | null>(null);

  // Persist open/closed so the panel survives the re-render that a save (or any
  // edit to the note) triggers, and so reopening the note restores it.
  React.useEffect(() => {
    onSidebarToggle(sidebarOpen);
  }, [sidebarOpen]);

  const segments = React.useMemo(() => groupIntoProse(logData.entries), [logData.entries]);
  const scenes = React.useMemo(() => assembleProse(segments), [segments]);
  const dialOps = React.useMemo(() => resolveDialOps(logData.entries, resources), [logData.entries, resources]);
  const listOps = React.useMemo(() => resolveListOps(logData.entries, lists), [logData.entries, lists]);
  const sidebarItems = React.useMemo(() => buildSidebarItems(segments, dialOps, listOps), [segments, dialOps, listOps]);

  const proseAnchors = React.useRef(new Map<number, HTMLElement>());
  const sidebarAnchors = React.useRef(new Map<number, HTMLElement>());
  const clickTick = React.useRef(0);
  const layoutRef = React.useRef<HTMLDivElement>(null);

  // The sidebar invades the page margin. Measure how much free margin the
  // surrounding Obsidian column actually has and size the invasion to fit
  // (up to the desired width); when there's too little room, stack the panel
  // below the prose instead of clipping it off the edge.
  const [sidebarPx, setSidebarPx] = React.useState<number | null>(null);
  const [stacked, setStacked] = React.useState(false);

  React.useEffect(() => {
    const layout = layoutRef.current;
    const container = layout?.parentElement;
    if (!layout || !container) return;

    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const desiredPx = 24 * remPx;
    const minSidebarPx = 13 * remPx;
    const view = layout.closest(".markdown-preview-view, .markdown-source-view, .cm-sizer") as HTMLElement | null;

    const measure = () => {
      const c = container.getBoundingClientRect();
      let room: number;
      if (view) {
        const v = view.getBoundingClientRect();
        const vs = getComputedStyle(view);
        const leftRoom = c.left - (v.left + (parseFloat(vs.paddingLeft) || 0));
        const rightRoom = v.right - (parseFloat(vs.paddingRight) || 0) - c.right;
        room = Math.max(0, Math.min(leftRoom, rightRoom));
      } else {
        room = Math.max(0, (window.innerWidth - c.width) / 2 - remPx);
      }
      const fits = Math.min(desiredPx, room * 2); // invasion spends `room` on each side
      if (fits < minSidebarPx) {
        setStacked(true);
        setSidebarPx(null);
      } else {
        setStacked(false);
        setSidebarPx(Math.round(fits));
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    if (view) ro.observe(view);
    return () => ro.disconnect();
  }, []);

  const registerAnchor =
    (map: React.MutableRefObject<Map<number, HTMLElement>>) => (id: number, el: HTMLElement | null) => {
      if (el) map.current.set(id, el);
      else map.current.delete(id);
    };
  const registerProse = React.useMemo(() => registerAnchor(proseAnchors), []);
  const registerSidebar = React.useMemo(() => registerAnchor(sidebarAnchors), []);

  React.useEffect(() => {
    if (!selection) return;
    const map = selection.side === "sidebar" ? sidebarAnchors.current : proseAnchors.current;
    map.get(selection.id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selection]);

  const handleDotClick = (id: number) => {
    setSidebarOpen(true);
    clickTick.current += 1;
    setSelection({ id, side: "sidebar", n: clickTick.current });
  };
  const handleSidebarClick = (id: number) => {
    clickTick.current += 1;
    setSelection({ id, side: "prose", n: clickTick.current });
  };

  const handleSpend = (cardId: string) => {
    setConsumableState((s) => spendUse(s, cardId));
  };

  // Original scene values keyed by their `=>` text, for dirty-checking + save.
  const sceneOriginals = React.useMemo(() => {
    const map: Record<string, { number: string; name: string; hadS: boolean }> = {};
    for (const item of sidebarItems) {
      for (const row of item.rows) {
        if (row.scene)
          map[row.scene.original] = { number: row.scene.number, name: row.scene.name, hadS: row.scene.hadS };
      }
    }
    return map;
  }, [sidebarItems]);

  const pendingScenes = React.useMemo(
    () =>
      Object.entries(sceneEdits).filter(([original, v]) => {
        const o = sceneOriginals[original];
        return o && (v.number !== o.number || v.name !== o.name);
      }),
    [sceneEdits, sceneOriginals]
  );

  // Editable formula terms across the sidebar (dice + CF/DC thresholds), with
  // the source line and original value for dirty-checking + write-back.
  const editTerms = React.useMemo(() => {
    const list: Array<{ source: string; raw: string; term: EditableTerm; original: string }> = [];
    for (const item of sidebarItems) {
      for (const row of item.rows) {
        if (!row.detail || !row.source) continue;
        const formula = parseFormula(row.content);
        if (!formula) continue;
        for (const term of editableTerms(formula)) {
          list.push({
            source: row.source,
            raw: term.raw,
            term,
            original: term.value != null ? String(term.value) : "",
          });
        }
      }
    }
    return list;
  }, [sidebarItems]);

  // Formula results (the text after `->`), with their source line + original, so
  // the result can be edited and written back like the terms.
  const editResults = React.useMemo(() => {
    const list: Array<{ source: string; original: string }> = [];
    for (const item of sidebarItems) {
      for (const row of item.rows) {
        if (!row.detail || !row.source) continue;
        const formula = parseFormula(row.content);
        if (formula?.result != null) list.push({ source: row.source, original: formula.result });
      }
    }
    return list;
  }, [sidebarItems]);

  // Each term whose edited slots combine to a different value than the original
  // becomes a token-swap on its source line. Untouched terms (no pending slot)
  // are skipped, so a pool's blank per-die boxes never clobber its saved total.
  // Edited results add their own arrow-anchored swap on the same line.
  const dieReplacements = React.useMemo(() => {
    const out: Array<{ line: string; from: string; to: string }> = [];
    for (const e of editTerms) {
      const slotCount = termSlots(e.term);
      const keys = Array.from({ length: slotCount }, (_, i) => dieEditKey(e.source, e.raw, i));
      if (!keys.some((k) => k in dieEdits)) continue; // untouched
      const slots = keys.map((k, i) => dieEdits[k] ?? termSlotInitial(e.term, i));
      const next = combineTermValue(e.term, slots);
      if (next !== e.original) out.push({ line: e.source, from: e.raw, to: setTermRaw(e.term, next) });
    }
    for (const r of editResults) {
      const key = resultEditKey(r.source);
      if (!(key in dieEdits)) continue;
      const next = dieEdits[key];
      if (next === r.original) continue;
      const swap = resultReplacement(r.source, next);
      if (swap) out.push({ line: r.source, ...swap });
    }
    return out;
  }, [editTerms, editResults, dieEdits]);

  const isDirty = pendingScenes.length > 0 || dieReplacements.length > 0 || tokenEdits.length > 0;

  const handleSceneChange = (original: string, next: SceneEditValue) => {
    setSceneEdits((prev) => ({ ...prev, [original]: next }));
  };

  const handleDieChange = (source: string, raw: string, slot: number, value: string) => {
    setDieEdits((prev) => ({ ...prev, [dieEditKey(source, raw, slot)]: value }));
  };

  const handleResultChange = (source: string, value: string) => {
    setDieEdits((prev) => ({ ...prev, [resultEditKey(source)]: value }));
  };

  // A list-consult pick (`[Characters?]` → `[Characters?= Bertha]`) is a plain
  // token swap on its source line — batched with the die edits and written on save.
  const handleTokenChange = (source: string, from: string, to: string, nth: number) => {
    setTokenEdits((prev) => {
      const rest = prev.filter((e) => !(e.line === source && e.from === from && e.nth === nth));
      return [...rest, { line: source, from, to, nth }];
    });
  };

  const handleSave = async () => {
    const scenes = pendingScenes.map(([original, v]) => ({
      from: original,
      to: reconstructScene(v.number, v.name, sceneOriginals[original].hadS),
    }));
    await onSave({ scenes, dice: [...dieReplacements, ...tokenEdits] });
    setSceneEdits({});
    setDieEdits({});
    setTokenEdits([]);
  };

  const hasActions = pcStacks.size > 0 || gmStacks.length > 0;
  const selectedId = selection?.id ?? null;

  return (
    <div className="session-log-container">
      <div
        ref={layoutRef}
        className={`lonelog-prose-layout ${sidebarOpen ? "with-sidebar" : ""} ${stacked ? "is-stacked" : ""}`}
        style={sidebarPx != null ? ({ "--log-sidebar-width": `${sidebarPx}px` } as React.CSSProperties) : undefined}
      >
        {sidebarItems.length > 0 && (
          <div className="lonelog-log-controls">
            {isDirty && (
              <button
                type="button"
                className="lonelog-log-save"
                aria-label="Save log edits"
                onClick={() => void handleSave()}
              >
                Save
              </button>
            )}
            <button
              type="button"
              className="lonelog-log-toggle"
              aria-pressed={sidebarOpen}
              aria-label={sidebarOpen ? "Close log" : "Open log"}
              onClick={() => setSidebarOpen((o) => !o)}
            >
              {sidebarOpen ? "✕" : "Log"}
            </button>
          </div>
        )}
        <div className="lonelog-prose-main">
          <ProseView
            scenes={scenes}
            sourcePath={sourcePath}
            selectedId={selectedId}
            onSelectSource={handleDotClick}
            registerAnchor={registerProse}
          />
        </div>
        {sidebarOpen && (
          <LogSidebar
            items={sidebarItems}
            selectedId={selectedId}
            onSelect={handleSidebarClick}
            registerAnchor={registerSidebar}
            sourcePath={sourcePath}
            sceneEdits={sceneEdits}
            onSceneChange={handleSceneChange}
            dieEdits={dieEdits}
            onDieChange={handleDieChange}
            onResultChange={handleResultChange}
            onTokenChange={handleTokenChange}
            onChoice={onChoice}
          />
        )}
      </div>

      {hasActions ? (
        <BottomDrawer
          actionsPanel={
            <SessionActionsPanel
              pcStacks={pcStacks}
              gmStacks={gmStacks}
              consumableState={consumableState}
              entities={entityNames}
              onAppendText={onAppendText}
              onSpend={handleSpend}
            />
          }
          changesPanel={
            <ChangeOverview
              entityDeltas={logData.entityDeltas}
              progressChanges={logData.progressChanges}
              threadChanges={logData.threadChanges}
            />
          }
        />
      ) : (
        <ChangeOverview
          entityDeltas={logData.entityDeltas}
          progressChanges={logData.progressChanges}
          threadChanges={logData.threadChanges}
        />
      )}
    </div>
  );
}
