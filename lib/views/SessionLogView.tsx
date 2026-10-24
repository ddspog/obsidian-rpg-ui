/**
 * Session Log View
 * Renders Lonelog session logs with interactive action cards and delta tracking
 */

import { BaseView } from "./BaseView";
import { App, MarkdownPostProcessorContext, Notice, TFile } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import type { IconTone } from "lib/domains/image-studio/kinds";
import { imageLink } from "lib/domains/image-studio/targets";
import { readItemFacts, type HeldThing, type ItemFacts } from "lib/domains/session-log/casting";
import { frameSpec } from "lib/services/card-frame-config";
import { KeyValueStore } from "lib/services/kv/kv";
import { ReactMarkdown } from "./ReactMarkdown";
import { addHeaderMap, parseSessionLogBlock, processSessionLog, type HeaderMap } from "lib/domains/session-log";
import type { SessionLogData } from "lib/domains/session-log";
import { EntityResolver } from "lib/services/entity-resolver";
import type { EntityData } from "lib/services/entity-resolver";
import { buildEntityContext, entityTypeOf } from "lib/services/entity-context";
import { SystemRegistry } from "lib/systems/registry";
import { logNames, matchActor } from "lib/domains/session-log/actors";
import { foesInPlay } from "lib/domains/session-log/foes";
import { foldBattles } from "lib/domains/battlemap/battle";
import { BattlePane } from "lib/components/battlemap/battle-pane";
import { foldFoes, isDown, type FoeAt } from "lib/domains/session-log/foes";
import { combatantKey } from "lib/domains/session-log/initiative";
import { combatClock } from "lib/domains/session-log/turns";
import { conditionsNow, resourcesSpent } from "lib/domains/session-log/conditions";
import { statusCard } from "lib/domains/session-log/spellcasting";
import { foldHealth, withTargetAc, withTargetHealth, type Health } from "lib/domains/session-log/health";
import { brightnessProfiles, gridFromProfiles } from "lib/domains/battlemap/detect-grid";
import type { MapChoice, MapTools } from "lib/domains/battlemap/map-tools";
import { combatOpen, squareNow } from "lib/domains/battlemap/movement";
import { measureMapImage, resolveMapImage } from "lib/domains/battlemap/render-map-block";
import { isHexMapSource } from "lib/domains/hexmap/parse-hex-map";
import {
  parseSquare,
  parseSquareMap,
  squareDistance,
  type Square,
  type SquareMap,
} from "lib/domains/battlemap/square-map";
import { riderNames, sessionActionCards, type SessionAction } from "lib/domains/session-log/session-actions";
import { statActions } from "lib/domains/statblocks/session-actions";
import { resolveStatFeatures } from "lib/domains/statblocks/resolve-features";
import type { StatFeatureRef } from "lib/domains/statblocks/types";
import { splitFenceBody } from "lib/utils/fence-split";
import { parse as parseYaml } from "yaml";
import { ProseView } from "lib/components/session-log/prose-view";
import { LogSidebar } from "lib/components/session-log/log-sidebar";
import type { SceneEditValue } from "lib/components/session-log/log-sidebar";
import { groupIntoProse } from "lib/domains/session-log/prose-grouper";
import {
  resolveDialOps,
  collectResources,
  foldResources,
  resourceDefaults,
  type DialDecl,
} from "lib/domains/lonelog/dial-ops";
import { collectLists, resolveListOps, type ListDecl } from "lib/domains/lonelog/list-ops";
import {
  assembleProse,
  buildSidebarItems,
  withActorRefs,
  withActorPages,
  withCombatantRolls,
  withCheckResults,
  reconstructScene,
  applySceneEdits,
  applyTokenEdits,
  dieEditKey,
  resultEditKey,
} from "lib/domains/session-log/prose-model";
import { parseFormula, resultReplacement } from "lib/domains/session-log/formula";
import { ChangeOverview } from "lib/components/session-log/change-overview";
import { pendingTermSwaps } from "lib/domains/session-log/die-edits";
import { SessionBookkeeping } from "lib/components/session-log/bookkeeping";
import type { CreatureInfo } from "lib/components/session-log/start-combat-popover";
import { collectInventoryChanges } from "lib/domains/session-log/inventory-changes";
import { BottomDrawer } from "lib/components/session-log/bottom-drawer";
import { SessionActionsPanel } from "lib/components/session-log/session-actions-panel";
import { extractCardsFromEntity, extractResourcesFromEntity } from "lib/services/session-feature-loader";
import { buildGMStacks, buildGMStacksFromFeatures } from "lib/domains/session-log/gm-cards";
import { buildCardStacks } from "lib/domains/session-log/extract-cards";
import { parseSourceDoc } from "lib/domains/features/parse-source-doc";
import type { GMFeature, GMStep, GMGeneratorAspect } from "lib/domains/features/types";
import type { TableDef } from "lib/domains/tables/types";
import { applyChoicePick } from "lib/domains/session-log/choice";
import { gmStepLines, resolveGmBody, type GMStepContext } from "lib/domains/gm/example";
import { resolveTableRoll } from "lib/domains/gm/steps";
import { TableRollContext } from "lib/components/session-log/table-roll-context";
import { generatorSteps, genStepLine } from "lib/domains/gm/emit";
import { parseBranchRef, selectStepBlock, stepUseLinks, spliceStepUses } from "lib/domains/gm/steps";
import { cardXFileRefs, inlineCardXFileRefs, selectGenerator } from "lib/domains/gm/card-refs";
import { expandCalledGenerator } from "lib/domains/gm/expand-gen";
import type { CardRider, CardStack, SessionFeatureCard } from "lib/domains/session-log/card-types";
import { DEFAULT_LOG_TEMPLATE } from "lib/domains/session-log/card-types";
import { actionCall, findActionCalls, leadingActionCall } from "lib/domains/session-log/action-call";
import {
  appliedValue,
  bookkeeping,
  rowId,
  usesSpent,
  type BookkeepingRow,
  type PartySheet,
  type SheetSnapshot,
} from "lib/domains/session-log/bookkeeping";
import { patchYamlBlock } from "lib/utils/yaml-patcher";
import { ammoRows, carriedAmmo, isAmmoChange, withAmmoCounts, type AmmoStack } from "lib/domains/session-log/ammo";
import {
  carriedEntries,
  itemStem,
  lootDestinations,
  type CarriedEntry,
  type ContainerNote,
  type LootDestination,
} from "lib/domains/session-log/loot-destinations";
import { hudLoadouts, type HeldItem, type HudInfo } from "lib/domains/session-log/hud";
import { applyLoadout, readLoadouts, type Loadout } from "lib/domains/session-log/loadouts";
import { resourceGlyph, type HotbarResource, type TileKind } from "lib/domains/session-log/hotbar-model";
import { modifyCard, toggleKey } from "lib/domains/session-log/modifiers";
import { withPartyGroups } from "lib/domains/session-log/party-groups";
import { withXpAward } from "lib/domains/session-log/xp-award";
import type { PartyMember } from "lib/domains/session-log/party-cards";
import type { NoteOption } from "lib/components/session-log/note-combobox";
import { openImageStudio } from "lib/plugin/image-studio-modal";
import type { ItemPrice } from "lib/domains/session-log/party-cards";
import type { LootSource } from "lib/components/session-log/party-popover";
import { clockText, foldClock, hoursSinceLongRest } from "lib/domains/session-log/clock";
import { durationOf, readConditionRules, type ConditionEffects } from "lib/domains/session-log/roll-advice";
import {
  checkMoves,
  grantFeet,
  provokedBy,
  routeFeet,
  type MoveCheck,
  type MoveGrant,
  type MoverInfo,
} from "lib/domains/battlemap/movement-rules";
import { withMoveChecks } from "lib/domains/battlemap/move-pills";
import {
  roundEconomies,
  slotsUsed,
  withRoundEconomy,
  type KindOf,
  type MultiattackOf,
} from "lib/domains/session-log/round-economy";
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
  /** Maps declared in the log's own header (`maps:`), by name. */
  private inlineMaps: Record<string, string> = {};
  private entities: EntityData[] = [];
  private gmFeatures: GMFeature[] = [];
  private stepCtx: GMStepContext = {};
  private stateKey = "default-log";
  private initialSidebarOpen = false;
  /** A PC's value for a `[[Name]]` roll term, by the actor's name (`Talon`). */
  private resolveRef: (actor: string, name: string) => number | undefined = () => undefined;
  /** Card stacks for the foes still in play, by the name they act under. */
  private foeStacks = new Map<string, CardStack[]>();
  /** The battle maps the log's fights are bound to, by the link as written. */
  private battleMaps: Record<string, SquareMap> = {};
  /** A combatant's value for a roll term in an `[Init:]` entry. */
  private resolveCombatant: (combatant: string, name: string) => number | undefined = () => undefined;
  /** Each party member's sheet as the log first read it — what its bookkeeping
   *  counts from — by the sheet's file. Kept in the state file. */
  private baseline: Record<string, SheetSnapshot> = {};
  /** The changes the bookkeeping has seen on the sheets (`rowId`s) — done for
   *  good, though later logs move the sheets on. Kept in the state file. */
  private sheetDone = new Set<string>();
  /** Each party member's features with uses to count, by their sheet's file. */
  private usesByFile = new Map<string, Array<{ key: string; name: string; max?: number; recovery?: string }>>();
  /** Whether a PC's sheet already lists an item (undefined: not a PC). */
  private sheetHas: (owner: string | undefined, item: string) => boolean | undefined = () => undefined;

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
    // A party member's sheet changed — by the bookkeeping's "Update sheet" or
    // by hand: read it again, so the tally shows what it holds now.
    let pending: number | undefined;
    this.registerEvent(
      this.baseView.app.vault.on("modify", (file) => {
        if (!this.entities.some((e) => e.filePath === file.path)) return;
        window.clearTimeout(pending);
        pending = window.setTimeout(() => void this.processAndRender(), 300);
      })
    );
  }

  private async processAndRender() {
    try {
      const block = parseSessionLogBlock(this.source);
      this.logData = processSessionLog(block);
      this.stateKey = block.state_key;
      this.initialSidebarOpen = (await this.kv.get<boolean>(`${block.state_key}:log-sidebar-open`)) === true;

      // The note's frontmatter is the session's own config: `pcs:` names who
      // plays and `gm:` the GM Screen, so a log needs no header to know either.
      // The block header still wins for `gm:` and adds to the PCs.
      const noteFm = this.baseView.app.metadataCache.getCache(this.filePath)?.frontmatter as
        | Record<string, unknown>
        | undefined;
      const entityRefs = [...(block.entities ?? [])];
      for (const pc of linkList(noteFm?.pcs)) {
        if (!entityRefs.some((r) => linkKey(r.file) === linkKey(pc))) entityRefs.push({ file: pc });
      }
      if (entityRefs.length > 0) {
        this.entities = await this.entityResolver.resolveEntities(entityRefs);
      }
      this.modifierCache.clear();
      this.defenseCache.clear();
      this.modifierValues.clear();
      // Icons added since are found on the next render.
      this.iconIndex = null;
      // What carried containers hold (a Quiver's 20 arrows) — the snapshot reads it.
      await this.loadContainerNotes();
      await this.loadBaseline();
      this.resolveRef = this.buildRefResolver();
      this.sheetHas = this.buildSheetCheck();
      this.resolveCombatant = this.buildCombatantResolver(await this.loadCombatants(this.logData.entries));
      this.foeStacks = await this.loadFoeStacks(this.logData.entries);
      this.inlineMaps = block.maps ?? {};
      this.battleMaps = await this.loadBattleMaps(this.logData.entries);

      const gmRef = block.gm ?? linkList(noteFm?.gm)[0];
      if (gmRef) {
        this.gmFeatures = await this.loadGMScreen(gmRef);
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

  /**
   * The answer to "what is `[[Insight]]` for Talon?": match the actor to a PC,
   * then ask that PC's system through its `Modifier` expression. The log syntax
   * is the same in every system — each system decides what a name is worth.
   * Contexts are built lazily and cached per PC, values per (PC, name).
   */
  /** The loaded PCs, as actor-match candidates (name + frontmatter aliases). */
  private pcCandidates(): { entities: EntityData[]; candidates: Array<{ name: string; aliases: string[] }> } {
    const entities = this.entities.filter((e) => e.exists);
    const candidates = entities.map((e) => {
      const file = this.baseView.app.vault.getAbstractFileByPath(e.filePath);
      const fm = file instanceof TFile ? this.baseView.app.metadataCache.getFileCache(file)?.frontmatter : undefined;
      const aliases = fm?.aliases;
      return { name: e.name, aliases: Array.isArray(aliases) ? aliases.map(String) : aliases ? [String(aliases)] : [] };
    });
    return { entities, candidates };
  }

  /**
   * Whether an owner's sheet already lists an item — read from the PC's
   * inventory (or merged sheet) fences, by whole name, linked or not.
   * `undefined` when the owner is not a loaded PC (the party, an NPC).
   */
  private buildSheetCheck(): (owner: string | undefined, item: string) => boolean | undefined {
    const { entities, candidates } = this.pcCandidates();
    return (owner, item) => {
      if (!owner) return undefined;
      const i = matchActor(owner, candidates);
      if (i < 0) return undefined;
      const fences = Array.from(entities[i].codeBlocks.entries())
        .filter(([meta]) => /(^|\.)(inventory|sheet)$/.test(meta))
        .flatMap(([, bodies]) => bodies);
      const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(^|[^\\w])${escaped}(?![\\w])`, "i");
      return fences.some((body) => re.test(body));
    };
  }

  /**
   * An entity's value for a named roll term, through its system's `Modifier`
   * expression — a character's skill, a creature's initiative. Contexts are
   * built lazily and cached per file, values per (file, name).
   */
  private modifierCache = new Map<string, ((name: string) => unknown) | null>();
  /** Each entity's AC and HP, as its system's `ArmorClass` / `HitPoints` give them. */
  private defenseCache = new Map<string, { ac?: number; hp?: Health }>();
  /** Every combatant the log names by link, by the name it's written with
   *  (`fat kobold, a` → the `Kobold, A` statblock). */
  private combatantsByName = new Map<string, EntityData>();
  /** Each entity's riders (Mystic Mark), by its file — features that only ride on attacks. */
  private riderNamesByFile = new Map<string, Set<string>>();
  private modifierValues = new Map<string, number | undefined>();
  private entityModifier(e: EntityData, name: string): number | undefined {
    const key = `${e.filePath}\u0000${name}`;
    if (this.modifierValues.has(key)) return this.modifierValues.get(key);
    if (!this.modifierCache.has(e.filePath)) {
      const system = SystemRegistry.getInstance().getSystemForFile(e.filePath);
      const type = entityTypeOf(system, e.codeBlocks);
      const fn = type
        ? buildEntityContext(system, type, e.codeBlocks, e.frontmatter as Record<string, unknown>).expressions.Modifier
        : undefined;
      this.modifierCache.set(e.filePath, fn ? (n: string) => fn(n) : null);
    }
    const v = this.modifierCache.get(e.filePath)?.(name);
    const value = typeof v === "number" && Number.isFinite(v) ? v : undefined;
    this.modifierValues.set(key, value);
    return value;
  }

  private buildRefResolver(): (actor: string, name: string) => number | undefined {
    const { entities, candidates } = this.pcCandidates();
    return (actor, name) => {
      const i = matchActor(actor, candidates);
      return i < 0 ? undefined : this.entityModifier(entities[i], name);
    };
  }

  /**
   * Load every combatant an `[Init:]` roll names by link (`[[Kobold, Elite]]
   * d20+[[Initiative]]=20`), so its modifiers can be read from its own note —
   * a statblock as readily as a sheet. Keyed by lowercased link target.
   */
  private async loadCombatants(entries: SessionLogData["entries"]): Promise<Map<string, EntityData>> {
    // Every name the log links in its initiative list or a foe tag — by the
    // link (the note) and by the name as written (`Fat [[Kobold, A]]`).
    const written = new Map<string, string>();
    const note = (name: string) => {
      const link = name.match(/\[\[([^\]|#]+)/)?.[1]?.trim();
      if (link) written.set(name, link);
    };
    for (const entry of entries) {
      if (entry.type === "oracle_question") for (const f of entry.foes ?? []) note(f.name);
      if (entry.type !== "consequence" && entry.type !== "world_event") continue;
      for (const tag of entry.tags) {
        if (tag.kind === "initiative") for (const e of tag.entries) note(e.name);
        if (tag.kind === "foe") note(tag.name);
      }
    }
    const out = new Map<string, EntityData>();
    this.combatantsByName.clear();
    for (const [name, target] of written) {
      let entity = out.get(target.toLowerCase());
      if (!entity) {
        const file = this.resolveLink(target);
        if (!file) continue;
        const resolved = await this.entityResolver.resolveEntity({ file: file.path });
        if (!resolved.exists) continue;
        entity = resolved;
        out.set(target.toLowerCase(), entity);
      }
      this.combatantsByName.set(combatantKey(name), entity);
    }
    return out;
  }

  /** The note a combatant's name leads to: a link's, the foe written so, or the party member. */
  private entityOf(name: string): EntityData | undefined {
    const link = name.match(/\[\[([^\]|#]+)/)?.[1]?.trim();
    const key = combatantKey(name);
    const byName = this.combatantsByName.get(key) ?? (link ? this.combatantsByName.get(combatantKey(link)) : undefined);
    if (byName) return byName;
    const keys = [...this.combatantsByName.keys()];
    const near = matchActor(
      name,
      keys.map((k) => ({ name: k }))
    );
    if (near >= 0) return this.combatantsByName.get(keys[near]);
    const { entities, candidates } = this.pcCandidates();
    const i = matchActor(link ?? name, candidates);
    return i >= 0 ? entities[i] : undefined;
  }

  /** A combatant's AC and hit points, from its sheet or statblock. */
  private defenseOf = (name: string): { ac?: number; hp?: Health } => {
    const e = this.entityOf(name);
    if (!e) return {};
    const cached = this.defenseCache.get(e.filePath);
    if (cached) return cached;
    let found: { ac?: number; hp?: Health } = {};
    try {
      const system = SystemRegistry.getInstance().getSystemForFile(e.filePath);
      const type = entityTypeOf(system, e.codeBlocks);
      const ex = type
        ? (buildEntityContext(system, type, e.codeBlocks, e.frontmatter as Record<string, unknown>)
            .expressions as Record<string, ((...a: unknown[]) => unknown) | undefined>)
        : undefined;
      const ac = ex?.ArmorClass?.();
      const hp = ex?.HitPoints?.() as Health | undefined;
      found = {
        ...(typeof ac === "number" && Number.isFinite(ac) ? { ac } : {}),
        ...(hp && Number.isFinite(hp.current) && Number.isFinite(hp.max)
          ? { hp: { current: hp.current, max: hp.max } }
          : {}),
      };
    } catch {
      found = {};
    }
    this.defenseCache.set(e.filePath, found);
    return found;
  };

  /** A combatant's value for a roll term: its linked note first, else the PC it names. */
  private buildCombatantResolver(
    combatants: Map<string, EntityData>
  ): (combatant: string, name: string) => number | undefined {
    return (combatant, name) => {
      const link = combatant
        .match(/\[\[([^\]|#]+)/)?.[1]
        ?.trim()
        .toLowerCase();
      const linked = link ? combatants.get(link) : undefined;
      if (linked) return this.entityModifier(linked, name);
      const shown = combatant.replace(
        /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g,
        (_m, t: string, a?: string) => a ?? t
      );
      return this.resolveRef(shown.trim(), name);
    };
  }

  /**
   * An entity's session actions as cards, from its system's `SessionActions`
   * expression — the same convention for a character sheet and a statblock.
   * Empty when the system offers none.
   */
  private sessionActionCardsFor(entity: EntityData, actor: string, prefix: string): SessionFeatureCard[] {
    // Its actions are called on its own page — `@[[Talon Pallton|Talon]].action(…)`.
    const actorPage = { page: this.pageOf(entity), label: actor };
    if (!entity.exists) return [];
    try {
      const system = SystemRegistry.getInstance().getSystemForFile(entity.filePath);
      const type = entityTypeOf(system, entity.codeBlocks);
      if (!type) return [];
      const fn = buildEntityContext(system, type, entity.codeBlocks, entity.frontmatter as Record<string, unknown>)
        .expressions.SessionActions;
      const actions = fn?.();
      // Its riders only go with its attacks: remembered, so no other card offers them alone.
      if (Array.isArray(actions)) this.riderNamesByFile.set(entity.filePath, riderNames(actions as SessionAction[]));
      return Array.isArray(actions)
        ? sessionActionCards(actions as SessionAction[], actor, `${prefix}:${actor}`, actorPage)
        : [];
    } catch (error) {
      console.error(`rpg log: SessionActions failed for ${entity.name}:`, error);
      return [];
    }
  }

  /**
   * Card stacks for the foes still in play: each foe's own note — a statblock —
   * gives its actions (its feature refs: Mining Pick, Sling, …), and its
   * system's `SessionActions` adds the rest (the basic actions). Foes marked
   * down, or at 0 HP, drop out; a foe with no note has no cards.
   */
  private async loadFoeStacks(entries: SessionLogData["entries"]): Promise<Map<string, CardStack[]>> {
    const out = new Map<string, CardStack[]>();
    for (const foe of foesInPlay(groupIntoProse(entries))) {
      const actor = foeName(foe.name);
      const link = foe.name.match(/\[\[([^\]|#]+)/)?.[1]?.trim();
      const file = link ? this.resolveLink(link) : null;
      if (!file) continue;
      try {
        const entity = await this.entityResolver.resolveEntity({ file: file.path });
        // Its statblock's own actions first (Mining Pick, Sling, …), then what
        // its system adds — the basic actions any creature can take. A name the
        // statblock already has (its own Dodge, say) isn't offered twice.
        let statCards: SessionFeatureCard[] = [];
        const raw = entity.codeBlocks.get("stat.monster")?.[0];
        if (raw) {
          const monster = (parseYaml(splitFenceBody(raw).yaml) ?? {}) as Record<string, unknown>;
          const refs = Array.isArray(monster.features) ? (monster.features as StatFeatureRef[]) : [];
          const features = await resolveStatFeatures(refs, file.path, monster);
          statCards = sessionActionCards(statActions(features), actor, `foe:${actor}`, {
            page: this.pageOf(entity),
            label: actor,
          });
        }
        const own = new Set(statCards.map((c) => c.name.toLowerCase()));
        const systemCards = this.sessionActionCardsFor(entity, actor, "foe").filter(
          (c) => !own.has(c.name.toLowerCase())
        );
        // A Multiattack plays its attacks as the statblock has them — their cards' own lines.
        const cards = [...statCards, ...systemCards].map((c) =>
          c.multiattack
            ? {
                ...c,
                multiattack: {
                  ...c.multiattack,
                  attacks: c.multiattack.attacks.map((a) => {
                    const own = statCards.find((s) => s.name.toLowerCase() === a.name.toLowerCase());
                    return own
                      ? { name: own.name, logTemplate: own.logTemplate, ...(own.range ? { range: own.range } : {}) }
                      : a;
                  }),
                },
              }
            : c
        );
        if (cards.length > 0) {
          out.set(
            actor,
            buildCardStacks(cards, actor).map((s) => ({ ...s, actorType: "foe" as const }))
          );
        }
      } catch (error) {
        console.error(`rpg log: could not load actions for ${actor}:`, error);
      }
    }
    return out;
  }

  /**
   * What a creature's statblock says, for setting up a fight: its HP (the number
   * `stats.hp` starts with — `26`, or `26 (4d8 + 8)`) and its Initiative modifier,
   * through its system's `Modifier` expression. `found: false` when the link
   * leads to no statblock.
   */
  private lookupCreature = async (link: string): Promise<CreatureInfo> => {
    const file = this.resolveLink(link);
    if (!file) return { found: false };
    try {
      const entity = await this.entityResolver.resolveEntity({ file: file.path });
      const raw = entity.codeBlocks.get("stat.monster")?.[0];
      if (!raw) return { found: false };
      const monster = (parseYaml(splitFenceBody(raw).yaml) ?? {}) as { stats?: { hp?: unknown } };
      const hp = parseInt(String(monster.stats?.hp ?? ""), 10);
      const initiative = this.entityModifier(entity, "Initiative");
      return {
        found: true,
        ...(Number.isFinite(hp) ? { hp } : {}),
        ...(initiative != null ? { initiative } : {}),
      };
    } catch {
      return { found: false };
    }
  };

  /** A battle map by its note's name: the first `rpg map` block in it, parsed. */
  private lookupMap = async (link: string): Promise<SquareMap | null> => {
    const inline = this.inlineMap(link);
    if (inline) return inline;
    const file = this.resolveLink(link);
    if (!file) return null;
    const block = (await this.baseView.app.vault.read(file)).match(/```rpg map[^\n]*\n([\s\S]*?)\n```/);
    // A hex map is an overworld map, not a battle board: no fight on it yet.
    if (!block || isHexMapSource(block[1])) return null;
    return measureMapImage(resolveMapImage(parseSquareMap(block[1]), this.baseView.app, file.path));
  };

  /**
   * The map each fight is bound to (`[COMBAT: [[Kobold Ambush]]]`): the first
   * `rpg map` block in the linked note, parsed. A link that leads nowhere, or to
   * a note with no map, is simply left out.
   */
  private async loadBattleMaps(entries: SessionLogData["entries"]): Promise<Record<string, SquareMap>> {
    const out: Record<string, SquareMap> = {};
    for (const battle of foldBattles(groupIntoProse(entries))) {
      if (out[battle.map]) continue;
      const inline = await this.inlineMap(battle.map);
      if (inline) {
        out[battle.map] = inline;
        continue;
      }
      const file = this.resolveLink(battle.map);
      if (!file) continue;
      const text = await this.baseView.app.vault.read(file);
      const block = text.match(/```rpg map[^\n]*\n([\s\S]*?)\n```/);
      if (block && !isHexMapSource(block[1]))
        out[battle.map] = await measureMapImage(
          resolveMapImage(parseSquareMap(block[1]), this.baseView.app, file.path)
        );
    }
    return out;
  }

  /**
   * A combatant's token emoji: `token:` in the frontmatter of their note — the
   * linked one (`[[Talon Pallton]]`, `Fat [[Kobold, A]]`), or the party member a
   * plain name is (`Talon`). Read from Obsidian's cache, so it costs nothing.
   */
  private tokenIcon = (name: string): string | undefined => {
    const fmToken = (fm: Record<string, unknown> | undefined) => {
      const t = fm?.token;
      return typeof t === "string" && t.trim() ? t.trim() : undefined;
    };
    const link = name.match(/\[\[([^\]|#]+)/)?.[1];
    if (link) {
      const file = this.resolveLink(link);
      return file ? fmToken(this.baseView.app.metadataCache.getFileCache(file)?.frontmatter) : undefined;
    }
    const key = combatantKey(name);
    const names = logNames(this.entities.map((e) => e.name));
    const pc = this.entities.find((e) => combatantKey(e.name) === key || combatantKey(names.get(e.name) ?? "") === key);
    return pc ? fmToken(pc.frontmatter as Record<string, unknown>) : undefined;
  };

  /**
   * A combatant's Initiative modifier, for rolling it from the map's Setup: a
   * party member's from their sheet (by log name or linked page), a foe's from
   * the statblock its name links.
   */
  private initiativeOf = async (name: string): Promise<number | undefined> => {
    const link = name.match(/\[\[([^\]|#]+)/)?.[1]?.trim();
    const key = combatantKey(link ?? name);
    const names = logNames(this.entities.map((e) => e.name));
    const pc = this.entities.find((e) => combatantKey(e.name) === key || combatantKey(names.get(e.name) ?? "") === key);
    if (pc) return this.resolveRef?.(names.get(pc.name) ?? pc.name, "Initiative");
    return link ? (await this.lookupCreature(link)).initiative : undefined;
  };

  /** Maps to choose from, and pictures to make one from — for Start Combat. */
  private mapTools: MapTools = {
    lookup: (ref) => this.lookupMap(ref),
    list: async () => {
      const { vault, metadataCache } = this.baseView.app;
      const choices: MapChoice[] = Object.keys(this.inlineMaps).map((name) => ({
        kind: "log",
        label: name,
        ref: name,
      }));
      // Notes holding an `rpg map` block of their own — a code block that opens
      // as one, not an example quoted inside another (as in a guide).
      for (const file of vault.getMarkdownFiles()) {
        const code = metadataCache.getFileCache(file)?.sections?.filter((s) => s.type === "code") ?? [];
        if (code.length === 0) continue;
        const text = await vault.cachedRead(file);
        if (code.some((s) => /^```rpg map\b/.test(text.slice(s.position.start.offset, s.position.start.offset + 16)))) {
          choices.push({
            kind: "note",
            label: file.basename,
            ref: `[[${metadataCache.fileToLinktext(file, this.filePath, true)}]]`,
          });
        }
      }
      for (const file of vault.getFiles()) {
        if (!/^(png|jpe?g|webp|gif|avif)$/i.test(file.extension)) continue;
        choices.push({
          kind: "picture",
          label: file.name,
          ref: `[[${metadataCache.fileToLinktext(file, this.filePath, false)}]]`,
        });
      }
      return choices;
    },
    detect: async (picture) => {
      const file = this.resolveLink(picture);
      if (!file) return null;
      const img = new Image();
      img.src = this.baseView.app.vault.getResourcePath(file);
      try {
        await img.decode();
      } catch {
        return null;
      }
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const p = brightnessProfiles(data, canvas.width, canvas.height);
      return gridFromProfiles(p.columns, p.rows);
    },
    picture: async (picture, cell, offsetX, offsetY) => {
      const source = `grid: square\nimage: "${picture}"\ncell: ${cell}\noffset: ${offsetX}, ${offsetY}\n---\n`;
      const map = await measureMapImage(resolveMapImage(parseSquareMap(source), this.baseView.app, this.filePath));
      return map.image?.url ? map : null;
    },
  };

  /**
   * A map the log declares itself (`maps:` in its header), by the plain name a
   * fight gives it (`[COMBAT: Clearing]`) — a `[[link]]` always means a note.
   */
  private inlineMap(name: string): Promise<SquareMap> | null {
    if (name.includes("[[")) return null;
    const key = Object.keys(this.inlineMaps).find((k) => k.trim().toLowerCase() === name.trim().toLowerCase());
    if (!key) return null;
    return measureMapImage(resolveMapImage(parseSquareMap(this.inlineMaps[key]), this.baseView.app, this.filePath));
  }

  /** A party member's name as the log knows them — their first (`Talon Pallton`,
   *  `[[Talon Pallton]]` → `Talon`); undefined for anyone not in the party. */
  private partyName = (actor: string): string | undefined => {
    const key = combatantKey(actor);
    const names = logNames(this.entities.map((e) => e.name));
    const pc = this.entities.find((e) => combatantKey(e.name) === key || combatantKey(names.get(e.name) ?? "") === key);
    return pc ? (names.get(pc.name) ?? pc.name) : undefined;
  };

  /** A condition's rules as the system knows them (`restrained`); undefined for one it
   *  doesn't (`pinned` is only Icicle Javelin's effect). */
  private conditionRules = (condition: string): { name: string; rules: string[] } | undefined => {
    const system = SystemRegistry.getInstance().getSystemForFile(this.filePath);
    const library = (system.entities?.character?.lookup as Record<string, unknown> | undefined)?.$conditions as
      | Record<string, { name: string; rules: string[] }>
      | undefined;
    return library?.[condition.trim().toLowerCase()];
  };

  // ── Bookkeeping: the party's sheets, as the log changes them ──

  /** A sheet's YAML block, parsed (`character.features`). */
  private sheetBlock(e: EntityData, block: string): Record<string, unknown> {
    const raw = e.codeBlocks.get(block)?.[0];
    if (!raw) return {};
    try {
      return (parseYaml(raw) as Record<string, unknown>) ?? {};
    } catch {
      return {};
    }
  }

  /** What a party member's sheet holds now that a session changes. */
  private sheetSnapshot(e: EntityData): SheetSnapshot {
    const hp = this.defenseOf(this.logNameOf(e)).hp;
    // Death saves marked, in its own health block or the combined sheet.
    const healthBlock = e.codeBlocks.has("character.health") ? "character.health" : "character.sheet";
    const marked = this.sheetBlock(e, healthBlock).death_saves as { successes?: number; failures?: number } | undefined;
    const deathSaves = marked
      ? { successes: Number(marked.successes) || 0, failures: Number(marked.failures) || 0 }
      : undefined;
    const uses = (this.sheetBlock(e, "character.features").spent ?? {}) as Record<string, number>;
    const casters = (this.sheetBlock(e, "character.spells").casters ?? {}) as Record<
      string,
      { spent?: Record<string, number> }
    >;
    const slots: Record<string, Record<string, number>> = {};
    for (const [caster, c] of Object.entries(casters)) if (c?.spent) slots[caster] = { ...c.spent };
    // Its XP, in its own header block or the combined sheet.
    const headerBlock = e.codeBlocks.has("character.header") ? "character.header" : "character.sheet";
    const xpRaw = Number(this.sheetBlock(e, headerBlock).xp);
    const xp = Number.isFinite(xpRaw) ? xpRaw : undefined;
    // Its other counts: hit dice left, exhaustion, Luck, coins.
    const health = this.sheetBlock(e, healthBlock);
    const header = this.sheetBlock(e, headerBlock);
    const coins = (this.sheetBlock(e, "character.inventory").currency ?? {}) as Record<string, number>;
    const dice = (health.hit_dice ?? {}) as Record<string, number | { current?: number }>;
    const counters: Record<string, number> = {
      "Hit Dice": Object.values(dice).reduce<number>(
        (n, d) => n + (typeof d === "number" ? d : Number(d?.current) || 0),
        0
      ),
      Exhaustion: Number(health.exhaustion) || 0,
      Luck: Number(header.luck) || 0,
      ...Object.fromEntries(Object.entries(coins).map(([k, v]) => [k.toUpperCase(), Number(v) || 0])),
    };
    return {
      ...(hp ? { hp } : {}),
      ...(deathSaves ? { deathSaves } : {}),
      ...(xp != null ? { xp } : {}),
      ammo: this.ammoOf(e),
      counters,
      uses: { ...uses },
      slots,
    };
  }

  /** A sheet's spellcasters that cast with slots — those preparing or knowing
   *  spells past cantrips — in the sheet's order. */
  private castersOf(e: EntityData): string[] {
    const casters = (this.sheetBlock(e, "character.spells").casters ?? {}) as Record<string, Record<string, unknown>>;
    return Object.entries(casters)
      .filter(([, c]) => c && (c.prepared != null || c.known != null || c.spent != null))
      .map(([name]) => name);
  }

  /** The name the log writes for a party member (`Talon Pallton` → `Talon`). */
  private logNameOf(e: EntityData): string {
    return logNames(this.entities.map((x) => x.name)).get(e.name) ?? e.name;
  }

  /** A party member's proficiency bonus, through their system — what `max: PB` counts. */
  private proficiencyOf(e: EntityData): number | undefined {
    try {
      const system = SystemRegistry.getInstance().getSystemForFile(e.filePath);
      const type = entityTypeOf(system, e.codeBlocks);
      const ex = type
        ? (buildEntityContext(system, type, e.codeBlocks, e.frontmatter as Record<string, unknown>)
            .expressions as Record<string, ((...a: unknown[]) => unknown) | undefined>)
        : undefined;
      const pb = ex?.ProficiencyBonus?.();
      return typeof pb === "number" && Number.isFinite(pb) ? pb : undefined;
    } catch {
      return undefined;
    }
  }

  /** A feature's uses, as its sheet counts them: a number, or `PB`. */
  private resolveMax(e: EntityData, expr: string | undefined): number | undefined {
    if (!expr) return undefined;
    if (/^\s*pb\s*$/i.test(expr)) return this.proficiencyOf(e);
    const n = Number(expr);
    return Number.isFinite(n) ? n : undefined;
  }

  /**
   * Where THIS log keeps its bookkeeping: its own `state_key`, or else its note
   * and its place among the note's logs — each log its own tally, so a new one
   * counts from the sheets as the last one left them.
   */
  private bookKey = "";
  /** The toggles switched on, by their key (`kowyn|rage`) — saved under this log's state key. */
  private toggles: string[] = [];
  private saveToggles = (keys: string[]): void => {
    this.toggles = keys;
    void this.kv.set(`${this.bookKey}:toggles`, keys);
  };
  private async loadBookKey(): Promise<void> {
    if (this.stateKey !== "default-log") {
      this.bookKey = this.stateKey;
      return;
    }
    let nth = 0;
    const info = this.ctx.getSectionInfo(this.containerEl);
    if (info) {
      nth = info.text
        .split("\n")
        .slice(0, info.lineStart)
        .filter((l) => /^\s*(`{3,}|~{3,})\s*rpg\s+log\b/.test(l)).length;
    } else {
      // Not laid out yet: find this log among the note's by its text.
      const file = this.baseView.app.vault.getAbstractFileByPath(this.filePath);
      if (file instanceof TFile) {
        const text = await this.baseView.app.vault.cachedRead(file);
        const bodies = [...text.matchAll(/^\s*(`{3,}|~{3,})\s*rpg\s+log\b[^\n]*\n([\s\S]*?)^\s*\1\s*$/gm)].map((m) =>
          m[2].trim()
        );
        nth = Math.max(0, bodies.indexOf(this.source.trim()));
      }
    }
    this.bookKey = `${this.filePath}#log${nth}`;
  }

  /**
   * Each party member's sheet as the log first read it — what its bookkeeping
   * counts from. Read once per sheet and kept, so writing the session's changes
   * to the sheet doesn't have the log count them again.
   */
  private async loadBaseline(): Promise<void> {
    await this.loadBookKey();
    const key = `${this.bookKey}:sheet-baseline`;
    this.baseline = (await this.kv.get<Record<string, SheetSnapshot>>(key)) ?? {};
    let changed = false;
    for (const e of this.entities.filter((x) => x.exists)) {
      const kept = this.baseline[e.filePath];
      if (!kept) {
        this.baseline[e.filePath] = this.sheetSnapshot(e);
        changed = true;
        continue;
      }
      // A baseline kept before the log counted something (hit dice, coins,
      // XP) starts that count from the sheet as it is now — not from 0.
      const now = this.sheetSnapshot(e);
      const counters = { ...(now.counters ?? {}), ...(kept.counters ?? {}) };
      const ammo = { ...(now.ammo ?? {}), ...(kept.ammo ?? {}) };
      if (
        Object.keys(counters).length !== Object.keys(kept.counters ?? {}).length ||
        (kept.xp == null && now.xp != null) ||
        Object.keys(ammo).length !== Object.keys(kept.ammo ?? {}).length
      ) {
        this.baseline[e.filePath] = {
          ...kept,
          counters,
          ammo,
          ...(kept.xp == null && now.xp != null ? { xp: now.xp } : {}),
        };
        changed = true;
      }
    }
    if (changed) await this.kv.set(key, this.baseline);
    this.sheetDone = new Set((await this.kv.get<string[]>(`${this.bookKey}:sheet-done`)) ?? []);
    // Which toggles (a Rage, a stance) are switched on — kept in the state, under this log's key.
    this.toggles = (await this.kv.get<string[]>(`${this.bookKey}:toggles`)) ?? [];
  }

  /** Remember changes seen on their sheets, so they stay done. */
  private markDone = (ids: string[]): void => {
    const fresh = ids.filter((id) => !this.sheetDone.has(id));
    if (fresh.length === 0) return;
    for (const id of fresh) this.sheetDone.add(id);
    void this.kv.set(`${this.bookKey}:sheet-done`, [...this.sheetDone]);
  };

  /** The party's sheets, for the bookkeeping. */
  private partySheets(): PartySheet[] {
    return this.entities
      .filter((e) => e.exists)
      .map((e) => {
        const sheet = this.sheetSnapshot(e);
        return {
          name: this.logNameOf(e),
          page: e.name,
          sheet,
          baseline: this.baseline[e.filePath] ?? sheet,
          uses: this.usesByFile.get(e.filePath) ?? [],
          casters: this.castersOf(e),
          slotMax: this.slotMaxOf(e),
          counterMax: { "Hit Dice": this.hitDiceOf(this.logNameOf(e)).reduce((n, d) => n + d.max, 0) },
        };
      });
  }

  /** Each of its casters' spell slots by circle — its system's `SpellSlots`. */
  private slotMaxOf(e: EntityData): Record<string, number[]> {
    try {
      const system = SystemRegistry.getInstance().getSystemForFile(e.filePath);
      const type = entityTypeOf(system, e.codeBlocks);
      if (!type) return {};
      const ex = buildEntityContext(system, type, e.codeBlocks, e.frontmatter as Record<string, unknown>)
        .expressions as Record<string, ((...a: unknown[]) => unknown) | undefined>;
      const out: Record<string, number[]> = {};
      for (const caster of this.castersOf(e)) {
        const slots = ex.SpellSlots?.(caster);
        if (Array.isArray(slots) && slots.length > 0) out[caster] = slots.map(Number);
      }
      return out;
    } catch {
      return {};
    }
  }

  /** Where the log starts a creature's hit points: a party member's from their
   *  sheet as the log first read it; anyone else's from their statblock. */
  private startHp = (name: string): Health | undefined => {
    const e = this.entityOf(name);
    const base = e && this.entities.includes(e) ? this.baseline[e.filePath]?.hp : undefined;
    return base ?? this.defenseOf(name).hp;
  };

  /** Write one of the session's changes to its sheet. */
  private applySheetUpdate = async (row: BookkeepingRow): Promise<void> => {
    const e = this.entities.find((x) => this.logNameOf(x) === row.who);
    if (!e) return;
    const app = this.baseView.app;
    this.markDone([rowId(row)]);
    // The log's progress, on top of the sheet as it is now.
    const value = appliedValue(row);
    if (row.kind === "ammo") {
      // Its stack's `qty`, wherever it sits in the inventory's `items:`.
      const stack = this.ammoOf(e)[row.key];
      if (!stack) return;
      const block = e.codeBlocks.has("character.inventory") ? "inventory" : "sheet";
      const items = JSON.parse(JSON.stringify(this.sheetBlock(e, `character.${block}`).items ?? [])) as unknown[];
      let list: unknown[] = items;
      for (const i of stack.at.slice(0, -1)) {
        const holder = list[i] as { contents?: unknown[] };
        if (!holder || !Array.isArray(holder.contents)) return;
        list = holder.contents;
      }
      const last = stack.at[stack.at.length - 1];
      const entry = list[last];
      list[last] = typeof entry === "string" ? { name: entry, qty: value } : { ...(entry as object), qty: value };
      await patchYamlBlock(app, e.filePath, "character", block, "items", items);
      return;
    }
    if (row.kind === "hp") {
      // Its own health block, or the combined sheet block that holds it.
      const block = e.codeBlocks.has("character.health") ? "health" : "sheet";
      await patchYamlBlock(app, e.filePath, "character", block, "current_hp", value);
    } else if (row.kind === "counter") {
      const healthKey = e.codeBlocks.has("character.health") ? "health" : "sheet";
      const headerKey = e.codeBlocks.has("character.header") ? "header" : "sheet";
      if (row.key === "Hit Dice") {
        // Dice left, by size: the change lands on the largest first (a spend
        // takes from it, a rest gives back to it).
        const dice = {
          ...((this.sheetBlock(e, `character.${healthKey}`).hit_dice ?? {}) as Record<
            string,
            number | { current?: number; max?: number }
          >),
        };
        let change = value - row.sheet;
        for (const die of Object.keys(dice).sort((a, b) => parseInt(b.slice(1), 10) - parseInt(a.slice(1), 10))) {
          if (change === 0) break;
          const d = dice[die];
          const now = typeof d === "number" ? d : Number(d?.current) || 0;
          const max = typeof d === "number" ? Infinity : (d?.max ?? Infinity);
          const next = Math.max(0, Math.min(max, now + change));
          change -= next - now;
          dice[die] = typeof d === "number" ? next : { ...d, current: next };
        }
        await patchYamlBlock(app, e.filePath, "character", healthKey, "hit_dice", dice);
      } else if (row.key === "Exhaustion") {
        await patchYamlBlock(app, e.filePath, "character", healthKey, "exhaustion", value);
      } else if (row.key === "Luck") {
        await patchYamlBlock(app, e.filePath, "character", headerKey, "luck", value);
      } else {
        const currency = { ...((this.sheetBlock(e, "character.inventory").currency ?? {}) as Record<string, number>) };
        currency[row.key.toLowerCase()] = value;
        await patchYamlBlock(app, e.filePath, "character", "inventory", "currency", currency);
      }
    } else if (row.kind === "xp") {
      const block = e.codeBlocks.has("character.header") ? "header" : "sheet";
      await patchYamlBlock(app, e.filePath, "character", block, "xp", Math.max(0, row.sheet + (row.target - row.from)));
    } else if (row.kind === "saves") {
      const block = e.codeBlocks.has("character.health") ? "health" : "sheet";
      const marked = {
        successes: 0,
        failures: 0,
        ...((this.sheetBlock(e, `character.${block}`).death_saves ?? {}) as object),
      } as Record<string, number>;
      marked[row.key] = Math.min(3, value);
      await patchYamlBlock(app, e.filePath, "character", block, "death_saves", marked);
    } else if (row.kind === "uses") {
      const spent = { ...((this.sheetBlock(e, "character.features").spent ?? {}) as Record<string, number>) };
      if (value > 0) spent[row.key] = value;
      else delete spent[row.key];
      await patchYamlBlock(app, e.filePath, "character", "features", "spent", spent);
    } else if (row.kind === "slot") {
      const [caster, circle] = row.key.split(":");
      const casters = {
        ...((this.sheetBlock(e, "character.spells").casters ?? {}) as Record<string, Record<string, unknown>>),
      };
      const entry = { ...(casters[caster] ?? {}) };
      const spent = { ...((entry.spent ?? {}) as Record<string, number>) };
      if (value > 0) spent[circle] = value;
      else delete spent[circle];
      entry.spent = spent;
      casters[caster] = entry;
      await patchYamlBlock(app, e.filePath, "character", "spells", "casters", casters);
    }
  };

  /** Count a party member's changes from their sheet as it is now — when the
   *  sheet had them already before the log first read it. */
  private recount = async (who: string): Promise<void> => {
    const e = this.entities.find((x) => this.logNameOf(x) === who);
    if (!e) return;
    this.baseline[e.filePath] = this.sheetSnapshot(e);
    await this.kv.set(`${this.bookKey}:sheet-baseline`, this.baseline);
    // Its changes count afresh, so none is done yet.
    for (const id of [...this.sheetDone]) if (id.startsWith(`${who}\u0000`)) this.sheetDone.delete(id);
    await this.kv.set(`${this.bookKey}:sheet-done`, [...this.sheetDone]);
    await this.processAndRender();
  };

  /** A party member's hit dice, by size: how many are left, of how many. */
  private hitDiceOf = (name: string): Array<{ die: string; left: number; max: number }> => {
    const e = this.entities.find((x) => this.logNameOf(x) === name) ?? this.entityOf(name);
    if (!e) return [];
    const block = e.codeBlocks.has("character.health") ? "character.health" : "character.sheet";
    const dice = (this.sheetBlock(e, block).hit_dice ?? {}) as Record<
      string,
      number | { current?: number; max?: number }
    >;
    return Object.entries(dice).map(([die, d]) => {
      const left = typeof d === "number" ? d : Number(d?.current) || 0;
      const max = typeof d === "number" ? d : Number(d?.max) || left;
      return { die, left, max };
    });
  };

  /**
   * What a fallen creature leaves to take: its weapons (its statblock's attacks
   * that are items — a Sling, a Dagger) and its armour (`ac: 14 (leather
   * armor)`), each a note of its own.
   */
  private lootOf = (name: string): Array<{ name: string; link: boolean }> => {
    const e = this.entityOf(name);
    const raw = e?.codeBlocks.get("stat.monster")?.[0];
    if (!e || !raw) return [];
    let data: Record<string, unknown> = {};
    try {
      data = (parseYaml(splitFenceBody(raw).yaml) as Record<string, unknown>) ?? {};
    } catch {
      return [];
    }
    const isItem = (n: string) => {
      const f = this.baseView.app.metadataCache.getFirstLinkpathDest(n, e.filePath);
      return !!f && /\bitems?\b|weapons|armor|armour|gear|equipment/i.test(f.path);
    };
    const out: Array<{ name: string; link: boolean }> = [];
    const refs = Array.isArray(data.features) ? (data.features as Array<{ ref?: string }>) : [];
    for (const r of refs) {
      const n = r.ref
        ?.split("#")[1]
        ?.replace(/\s*\([^)]*\)\s*$/, "")
        .trim();
      if (n && isItem(n) && !out.some((o) => o.name === n)) out.push({ name: n, link: true });
    }
    const ac = String((data.stats as Record<string, unknown> | undefined)?.ac ?? "");
    const armour =
      ac.match(/\[\[([^\]|#]+)/)?.[1]?.trim() ??
      ac
        .match(/\(([^)]+)\)/)?.[1]
        ?.replace(/\s*armou?r$/i, "")
        .trim();
    if (armour) {
      const n = armour.charAt(0).toUpperCase() + armour.slice(1);
      if (isItem(n) && !out.some((o) => o.name === n)) out.push({ name: n, link: true });
    }
    return out;
  };

  /** The vault's item notes — weapons, armour, gear — to find as you type. */
  private itemNotes = (): NoteOption[] =>
    this.baseView.app.vault
      .getMarkdownFiles()
      .filter((f) => /\bitems?\b|weapons|armor|armour|gear|equipment/i.test(f.parent?.path ?? ""))
      .map((f) => ({ name: f.basename, folder: f.parent?.path ?? "" }));

  /** An item note's price in gp — its `cost: 10 gp` — and, for one sold in
   *  bundles (Arrows' `storage: { amount: 20, cost: 1 gp }`), how many in one. */
  private itemCost = async (name: string): Promise<ItemPrice | undefined> => {
    const f = this.baseView.app.metadataCache.getFirstLinkpathDest(name, this.filePath);
    if (!f) return undefined;
    const text = await this.baseView.app.vault.cachedRead(f);
    const per: Record<string, number> = { pp: 10, gp: 1, ep: 0.5, sp: 0.1, cp: 0.01 };
    const gp = (raw?: string) => {
      const m = raw?.match(/([\d.,]+)\s*(pp|gp|ep|sp|cp)\b/i);
      return m ? Number(m[1].replace(/,/g, "")) * per[m[2].toLowerCase()] : undefined;
    };
    const storage = text.match(/^storage:\s*\n((?:[ \t]+.*\n?)+)/m)?.[1] ?? "";
    const amount = Number(storage.match(/^\s+amount:\s*(\d+)/m)?.[1]);
    const bundleCost = gp(storage.match(/^\s+cost:\s*(.+)$/m)?.[1]);
    const price = gp(text.match(/^cost:\s*(.+)$/m)?.[1]);
    if (amount > 1 && bundleCost != null) return { price: bundleCost, bundle: amount };
    return price != null ? { price } : undefined;
  };

  /** Whether a note exists for an item name (`Arrows`) — to link it when it does. */
  private itemNote = (name: string): boolean => {
    const f = this.baseView.app.metadataCache.getFirstLinkpathDest(name, this.filePath);
    return !!f;
  };

  /** Each carried item's picture (a URL), by its name — for the HUD's hands. */
  private itemImages = new Map<string, string>();

  /** What each carried item's note says about casting (two hands, a focus, a pouch), by its name. */
  private itemFacts = new Map<string, ItemFacts>();

  /** What each carried item's note says about holding things, by its name. */
  private containerNotes = new Map<string, ContainerNote | undefined>();

  /** A member's inventory items, in its own block or the combined sheet. */
  private carriedOf(e: EntityData): CarriedEntry[] {
    const block = e.codeBlocks.has("character.inventory") ? "character.inventory" : "character.sheet";
    return carriedEntries(this.sheetBlock(e, block).items);
  }

  /** Read the notes of everything the party carries (and what those hold) —
   *  which of them are containers, and what a named one holds. */
  private async loadContainerNotes(): Promise<void> {
    const app = this.baseView.app;
    const queue = this.entities.filter((e) => e.exists).flatMap((e) => this.carriedOf(e));
    while (queue.length > 0) {
      const entry = queue.shift()!;
      queue.push(...(entry.contents ?? []));
      const stem = itemStem(entry.name);
      if (this.containerNotes.has(stem)) continue;
      this.containerNotes.set(stem, undefined);
      const f = app.metadataCache.getFirstLinkpathDest(stem, this.filePath);
      if (!f) continue;
      const text = await app.vault.cachedRead(f);
      this.itemFacts.set(stem.toLowerCase(), readItemFacts(text, stem));
      // Its picture, for the HUD's hands (`image: "![[longbow.webp|384]]"` in its block).
      const pic = text.match(/^image:\s*["']?!?\[\[([^\]|#]+)/m)?.[1]?.trim();
      const picFile = pic ? app.metadataCache.getFirstLinkpathDest(pic, f.path) : null;
      if (picFile) this.itemImages.set(stem.toLowerCase(), app.vault.getResourcePath(picFile));
      const named = text.match(/^```+rpg item\.container[^\n]*\n([\s\S]*?)^```/m);
      if (named) {
        let data: Record<string, unknown> = {};
        try {
          data = (parseYaml(splitFenceBody(named[1]).yaml) as Record<string, unknown>) ?? {};
        } catch {
          // A note that doesn't parse holds nothing we can see.
        }
        const sections = Array.isArray(data.sections) ? (data.sections as Array<{ items?: unknown }>) : [];
        const items = [...carriedEntries(data.items), ...sections.flatMap((x) => carriedEntries(x.items))];
        this.containerNotes.set(stem, { named: { name: typeof data.name === "string" ? data.name : stem, items } });
        queue.push(...items);
        continue;
      }
      // An element that holds things: `container:` in its own fence.
      const element = text.match(/^```+rpg item\.element[^\n]*\n([\s\S]*?)^```/m);
      // Not one for liquids only (a Waterskin's `volume_cap: 4 pints`) — loot doesn't go in it.
      const cap = element?.[1].match(/^\s+volume_cap:\s*(.+)$/m)?.[1] ?? "";
      const liquid =
        /\b(pints?|oz|ounces?|gallons?|quarts?)\b/i.test(cap) && !/\bcubic\b|arrows|bolts|bullets|needles/i.test(cap);
      if (element && /^container:/m.test(element[1]) && !liquid) {
        let spec: { for_ammo?: unknown; ammo_cap?: unknown } = {};
        try {
          const head = splitFenceBody(element[1]).yaml;
          spec = ((parseYaml(head) as { container?: typeof spec } | null)?.container ?? {}) as typeof spec;
        } catch {
          // Its caps unread; it still holds things.
        }
        const forAmmo = (Array.isArray(spec.for_ammo) ? spec.for_ammo : spec.for_ammo ? [spec.for_ammo] : []).map(
          String
        );
        const cap = spec.ammo_cap;
        this.containerNotes.set(stem, {
          holds: true,
          ...(forAmmo.length ? { forAmmo } : {}),
          ...(typeof cap === "number" || (cap && typeof cap === "object")
            ? { ammoCap: cap as number | Record<string, number> }
            : {}),
        });
      }
    }
  }

  /**
   * A card's own icon art: an image named for it (`Longbow.webp`,
   * `Mystic Mark.png`) in any folder called `Icons` — matched without its
   * source mark (`Douse Light ᴷ` → `Douse Light`) or case.
   */
  private iconIndex: Map<string, string> | null = null;
  private iconFor = (name: string): string | undefined => {
    const key = (n: string) =>
      n
        .replace(/[ᴬᴮᴰᴴᴷᴺº]/gu, "")
        .trim()
        .toLowerCase();
    if (!this.iconIndex) {
      this.iconIndex = new Map();
      const vault = this.baseView.app.vault;
      for (const f of vault.getFiles()) {
        if (!/^(png|webp|jpe?g|svg|gif)$/i.test(f.extension)) continue;
        if (!/(^|\/)icons\//i.test(f.path)) continue;
        this.iconIndex.set(key(f.basename), vault.getResourcePath(f));
      }
    }
    return this.iconIndex.get(key(name));
  };

  /** The loadouts a party member's sheet declares (`loadouts:` on its inventory). */
  private loadoutsFor = (actor: string): Loadout[] => {
    const e = this.entities.find((x) => x.exists && this.logNameOf(x) === actor);
    if (!e) return [];
    const block = e.codeBlocks.has("character.inventory") ? "character.inventory" : "character.sheet";
    return readLoadouts(this.sheetBlock(e, block).loadouts);
  };

  /** A character's picture: `portrait:` on their health or sheet block, resolved to a URL. */
  private portraitOf(e: EntityData): string | undefined {
    const field = (this.sheetBlock(e, "character.health").portrait ??
      this.sheetBlock(e, "character.sheet").portrait ??
      this.sheetBlock(e, "character.header").portrait) as unknown;
    // (`portrait: [[x.webp]]`, unquoted, is read by YAML as a list holding a list.)
    let flat: unknown = field;
    while (Array.isArray(flat) && flat.length === 1) flat = flat[0];
    const link = typeof flat === "string" ? (flat.match(/\[\[([^\]|#]+)/)?.[1]?.trim() ?? flat.trim()) : undefined;
    const f = link ? this.baseView.app.metadataCache.getFirstLinkpathDest(link, e.filePath) : null;
    return f ? this.baseView.app.vault.getResourcePath(f) : undefined;
  }

  /** A foe's face: the `image` of its statblock (or its note's), resolved to a URL. */
  private foeHudOf(name: string): HudInfo | undefined {
    const e = this.entityOf(name);
    if (!e) return undefined;
    const raw = e.codeBlocks.get("stat.monster")?.[0];
    let image: unknown;
    if (raw) {
      try {
        image = ((parseYaml(splitFenceBody(raw).yaml) ?? {}) as Record<string, unknown>).image;
      } catch {
        /* an unreadable statblock has no face */
      }
    }
    const fm = e.frontmatter as Record<string, unknown> | undefined;
    image ??= fm?.reference_img ?? fm?.image;
    let flat: unknown = image;
    while (Array.isArray(flat) && flat.length === 1) flat = flat[0];
    const link = typeof flat === "string" ? imageLink(flat) : undefined;
    const f = link ? this.baseView.app.metadataCache.getFirstLinkpathDest(link, e.filePath) : null;
    return f ? { portrait: this.baseView.app.vault.getResourcePath(f), sheetPath: e.filePath } : undefined;
  }

  /** What the HUD shows of a character besides their cards: face, hands, loadouts. */
  private hudOf = (drawerName: string): HudInfo | undefined => {
    const e = this.entities.find((x) => x.exists && x.name === drawerName);
    if (!e) return this.foeHudOf(drawerName);
    const log = this.logNameOf(e);
    const block = e.codeBlocks.has("character.inventory") ? "character.inventory" : "character.sheet";
    const raw = this.sheetBlock(e, block).items;
    const list = (Array.isArray(raw) ? raw : []) as Array<{ name?: string; slot?: string } | string>;
    const inSlot = (...slots: string[]): HeldItem | undefined => {
      const entry = list.find(
        (i): i is { name?: string; slot?: string } => typeof i === "object" && !!i && !!i.slot && slots.includes(i.slot)
      );
      if (!entry?.name) return undefined;
      const stem = itemStem(entry.name);
      const image = this.iconFor(stem) ?? this.itemImages.get(stem.toLowerCase());
      return { name: stem, ...(image ? { image } : {}) };
    };
    const hands = {
      main: inSlot("main_hand"),
      off: inSlot("off_hand", "shield"),
      light: inSlot("light"),
      instrument: inSlot("instrument"),
    };
    // What's in the hands and carried, for the spells that need a hand or a focus.
    const factsOf = (n: string) => this.itemFacts.get(itemStem(n).toLowerCase()) ?? readItemFacts("", itemStem(n));
    const held: HeldThing[] = list
      .filter(
        (i): i is { name?: string; slot?: string } =>
          typeof i === "object" && !!i && !!i.name && ["main_hand", "off_hand", "shield"].includes(i.slot ?? "")
      )
      .map((i) => {
        const facts = factsOf(i.name!);
        return { hands: i.slot === "main_hand" && facts.twoHanded ? 2 : 1, focus: facts.focus ?? [] };
      });
    const everything = (entries: CarriedEntry[]): CarriedEntry[] =>
      entries.flatMap((x) => [x, ...everything(x.contents ?? [])]);
    const pouch = everything(this.carriedOf(e)).some((x) => factsOf(x.name).pouch);
    const token = (e.frontmatter as Record<string, unknown>)?.token;
    const portrait = this.portraitOf(e);
    // A portrait that's the art alone is drawn in the card frame, as on the sheet.
    const framed = [this.sheetBlock(e, "character.health"), this.sheetBlock(e, "character.sheet")].some(
      (b) => !!frameSpec(b.framed, undefined, "portrait")
    );
    return {
      ...(portrait ? { portrait } : {}),
      ...(portrait && framed ? { framed: true } : {}),
      ...(typeof token === "string" && token.trim() ? { token: token.trim() } : {}),
      sheetPath: e.filePath,
      casting: { held, pouch },
      hands: Object.fromEntries(Object.entries(hands).filter(([, v]) => v)) as HudInfo["hands"],
      loadouts: hudLoadouts(this.loadoutsFor(log), this.heldLoadoutOf(log), (n) => this.iconFor(n)),
    };
  };

  /** A character's picture, made in the image studio: a PC's portrait, a foe's image. */
  private makePortrait = (drawerName: string): void => {
    const e = this.entities.find((x) => x.exists && x.name === drawerName) ?? this.entityOf(drawerName);
    const file = e ? this.baseView.app.vault.getAbstractFileByPath(e.filePath) : null;
    if (!e || !(file instanceof TFile)) {
      new Notice(`No note for ${drawerName} to make a picture for.`);
      return;
    }
    openImageStudio(this.baseView.app, {
      file,
      focus: this.entities.includes(e) ? "portrait" : "image",
      onSaved: () => void this.processAndRender(),
    });
  };

  /** Open a sheet in a tab of its own — the log stays where it is. */
  private openSheet = (path: string): void => {
    void this.baseView.app.workspace.openLinkText(path, "", "tab");
  };

  /** The loadout in hand now: the one whose slots the sheet already shows. */
  private heldLoadoutOf = (actor: string): string | undefined => {
    const e = this.entities.find((x) => x.exists && this.logNameOf(x) === actor);
    if (!e) return undefined;
    const block = e.codeBlocks.has("character.inventory") ? "character.inventory" : "character.sheet";
    const items = this.sheetBlock(e, block).items;
    const list = Array.isArray(items) ? items : [];
    const held = (l: unknown[]) =>
      JSON.stringify(
        (l as Array<{ name?: string; slot?: string }>)
          .flatMap((i) =>
            i && typeof i === "object" && i.slot && /^(main_hand|off_hand|shield|light|instrument)$/.test(i.slot)
              ? [`${i.name}@${i.slot}`]
              : []
          )
          .sort()
      );
    const now = held(list);
    return this.loadoutsFor(actor).find((l) => held(applyLoadout(list, l).items) === now)?.name;
  };

  /** Put a loadout in hand: the sheet's inventory slots rewritten. */
  private equip = async (actor: string, loadoutName: string): Promise<void> => {
    const e = this.entities.find((x) => x.exists && this.logNameOf(x) === actor);
    const loadout = this.loadoutsFor(actor).find((l) => l.name === loadoutName);
    if (!e || !loadout) return;
    const block = e.codeBlocks.has("character.inventory") ? "inventory" : "sheet";
    const items = this.sheetBlock(e, `character.${block}`).items;
    const { items: next, missing } = applyLoadout(Array.isArray(items) ? items : [], loadout);
    if (missing.length > 0) new Notice(`${actor} doesn't carry ${missing.join(", ")} — the rest is in hand.`);
    await patchYamlBlock(this.baseView.app, e.filePath, "character", block, "items", next);
  };

  /** A card's icon, made in the image studio — the hotbar redrawn with it once saved. */
  private makeIcon = (card: SessionFeatureCard, kind: TileKind): void => {
    // Its tile's type picks the icon's stone and glow ("other" reads as an action).
    const tone = kind === "other" ? "action" : kind;
    openImageStudio(this.baseView.app, {
      // (Its note is found by the name as written — marks and all — `Icicle Javelin º`.)
      card: {
        name: card.name.replace(/\s*[ᴬᴮᴰᴴᴷᴺº]+$/u, "").trim(),
        noteName: card.name,
        text: card.summary ?? card.text ?? "",
        tone,
      },
      onSaved: () => {
        this.iconIndex = null;
        void this.processAndRender();
      },
    });
  };

  /** A small icon for something that isn't a card — a held item, a loadout — made in the image studio. */
  private makeNamedIcon = (what: { name: string; text?: string; tone?: IconTone }): void => {
    openImageStudio(this.baseView.app, {
      card: { name: what.name, noteName: what.name, text: what.text ?? "", tone: what.tone ?? "attack" },
      onSaved: () => {
        this.iconIndex = null;
        void this.processAndRender();
      },
    });
  };

  /** Whether an item is ammunition — its note sits with the ammunition. */
  private isAmmo = (stem: string): boolean => {
    const f = this.baseView.app.metadataCache.getFirstLinkpathDest(stem, this.filePath);
    return !!f && /\/ammunition\//i.test(f.path);
  };

  /** A member's ammunition, in pieces, against each container's cap. */
  private ammoOf(e: EntityData): Record<string, AmmoStack> {
    return carriedAmmo(this.logNameOf(e), this.carriedOf(e), (stem) => this.containerNotes.get(stem), this.isAmmo);
  }

  /** Where loot can go — each member, and the containers they carry. */
  private destinations = (): LootDestination[] =>
    lootDestinations(
      this.entities.filter((e) => e.exists).map((e) => ({ name: this.logNameOf(e), items: this.carriedOf(e) })),
      (stem) => this.containerNotes.get(stem)
    );

  /** Whether an item found can hold things (a Pouch, a Quiver) — so loot can go in it. */
  private holdsThings = (name: string): boolean => {
    const f = this.baseView.app.metadataCache.getFirstLinkpathDest(itemStem(name), this.filePath);
    const known = this.containerNotes.get(itemStem(name));
    return !!known || (!!f && /\/containers?\//i.test(f.path));
  };

  /** What defeating a creature is worth in XP — its system's `ExperiencePoints` (its CR on the table). */
  private xpOf = (name: string): number | undefined => {
    const e = this.entityOf(name);
    if (!e) return undefined;
    try {
      const system = SystemRegistry.getInstance().getSystemForFile(e.filePath);
      const type = entityTypeOf(system, e.codeBlocks);
      const ex = type
        ? (buildEntityContext(system, type, e.codeBlocks, e.frontmatter as Record<string, unknown>)
            .expressions as Record<string, ((...a: unknown[]) => unknown) | undefined>)
        : undefined;
      const xp = ex?.ExperiencePoints?.();
      return typeof xp === "number" && Number.isFinite(xp) ? xp : undefined;
    } catch {
      return undefined;
    }
  };

  /** A creature the GM keeps dying like a PC at 0 HP (a mighty villain, a
   *  special NPC) — its statblock says `death_saves: true`. */
  private keepsDying = (name: string): boolean => {
    const e = this.entityOf(name);
    const raw = e?.codeBlocks.get("stat.monster")?.[0];
    if (!raw) return false;
    try {
      const data = (parseYaml(splitFenceBody(raw).yaml) as Record<string, unknown>) ?? {};
      return data.death_saves === true || (data.stats as Record<string, unknown> | undefined)?.death_saves === true;
    } catch {
      return false;
    }
  };

  /** A creature's walking speed in feet — a sheet's `speed: { value: 30 }`, a
   *  statblock's `speed: 30 ft., climb 30 ft.` (its first). */
  private speedOf = (name: string): number | undefined => {
    const e = this.entityOf(name);
    if (!e) return undefined;
    for (const block of ["character.health", "character.sheet", "stat.monster"]) {
      const raw = e.codeBlocks.get(block)?.[0];
      if (!raw) continue;
      let data: Record<string, unknown> = {};
      try {
        data = (parseYaml(block === "stat.monster" ? splitFenceBody(raw).yaml : raw) as Record<string, unknown>) ?? {};
      } catch {
        continue;
      }
      // A statblock keeps it under `stats:`.
      const speed = (data.speed ?? (data.stats as Record<string, unknown> | undefined)?.speed) as unknown;
      const value =
        typeof speed === "number"
          ? speed
          : typeof speed === "string"
            ? parseInt(speed, 10)
            : typeof (speed as { value?: unknown })?.value === "number"
              ? (speed as { value: number }).value
              : NaN;
      if (Number.isFinite(value)) return value;
    }
    return undefined;
  };

  /** What a creature adds to a save of an ability (`STR`), from its sheet or statblock. */
  private saveModifier = (name: string, ability: string): number | undefined => {
    const e = this.entityOf(name);
    return e ? this.entityModifier(e, ability) : undefined;
  };

  /** The page an actor's pill links to — their sheet or statblock, by the name the log writes. */
  private actorPage = (name: string): string | undefined => {
    const e = this.entityOf(name);
    return e ? this.pageOf(e) : undefined;
  };

  /** How a note links an entity's page from this log (its shortest link text). */
  private pageOf(entity: EntityData): string {
    const file = this.baseView.app.vault.getAbstractFileByPath(entity.filePath);
    return file instanceof TFile
      ? this.baseView.app.metadataCache.fileToLinktext(file, this.filePath, true)
      : entity.name;
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
    // Splice the block back into the note — not the block alone over the note.
    await this.baseView.app.vault.modify(
      file as any,
      content.replace(codeBlockRegex, () => `${header}${updatedBody}${closing}`)
    );
  }

  /** A GM step dropdown pick: insert the chosen step's `label: calc` line under
   *  the gen: (via applyChoicePick), re-resolve, and persist to the note. */
  private async onChoicePick(selected: string) {
    const stepLines = Object.assign({}, ...this.gmFeatures.map((f) => gmStepLines(f, this.stepCtx)));
    await this.rewriteLogBody((body) =>
      resolveGmBody(applyChoicePick(body, selected, stepLines), this.gmFeatures, this.stepCtx)
    );
  }

  /** Append to the log — and, for a fight on a new picture map, keep that map
   *  in the block's header (`maps:`), in the same write. */
  private async appendToLogBody(newText: string, headerMap?: HeaderMap) {
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
      const updatedBlock = `${headerMap ? addHeaderMap(header, headerMap) : header}${updatedBody}${closing}`;
      const updatedContent = content.replace(codeBlockRegex, () => updatedBlock);

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
  } {
    const pcStacks = new Map<string, CardStack[]>();

    // Cards act under the name a player writes in the log (`@(Talon)`), not
    // the note's full name; the drawer's chips keep the full name.
    const names = logNames(this.entities.map((e) => e.name));
    for (const entity of this.entities) {
      const actor = names.get(entity.name) ?? entity.name;
      // Feature cards, plus what the character's system says it can do in a
      // session (attacks with what's in hand, the basic actions).
      const riders = this.riderNamesByFile.get(entity.filePath) ?? new Set<string>();
      // A rider's feature has no card of its own: it rides on the attacks.
      // Uses the sheet counts (`max: PB`) resolve for this character; a card
      // that spends one writes it (`[Talon/Second Wind-1]`), so the log counts it.
      // A feature card with no line of its own writes a call on the actor's
      // page (`@[[Lilith]].action("Wind Up")`) — its description on hover — at
      // a target when it picks one. Uses the sheet counts (`max: PB`) resolve
      // for this character; a card that spends one writes it.
      const page = this.pageOf(entity);
      const featureCards = extractCardsFromEntity(entity)
        .filter((c) => !riders.has(c.name.toLowerCase()))
        .map((c) => {
          const active = c.bucket === "action" || c.bucket === "bonus" || c.bucket === "reaction";
          const aims = active && /\b(?:target|creature)\b/i.test(c.text ?? "");
          const call =
            c.logTemplate === DEFAULT_LOG_TEMPLATE
              ? { logTemplate: `@({{actor}}) ${actionCall(page, c.name, actor)}${aims ? " → {{target}}" : ""}` }
              : {};
          const maxUses = c.maxUses ?? this.resolveMax(entity, c.maxExpr);
          if (maxUses == null) return { ...c, ...call };
          const template = call.logTemplate ?? c.logTemplate;
          const spends = /\[\{\{actor\}\}\//.test(template) ? "" : `\n=> [{{actor}}/${c.name}-1]`;
          return { ...c, maxUses, logTemplate: `${template}${spends}` };
        });
      // A martial action that can go with an attack (Wind Up, Aim) rides on
      // the weapon attacks it suits — its PB as this character's, taken as its
      // own bonus action.
      const pb = this.proficiencyOf(entity);
      const amount = (v: number | string | undefined) =>
        v == null ? undefined : /^\s*pb\s*$/i.test(String(v)) ? (pb != null ? String(pb) : undefined) : String(v);
      const martial = featureCards.flatMap((c) => {
        if (!c.ridesWith) return [];
        const damage = amount(c.ridesWith.damage);
        const hit = amount(c.ridesWith.hit);
        const takes = c.bucket === "bonus" || c.bucket === "reaction" ? { takes: c.bucket } : {};
        return [
          {
            with: c.ridesWith.with,
            rider: { name: c.name, ...(damage ? { damage } : {}), ...(hit ? { hit } : {}), ...takes } as CardRider,
          },
        ];
      });
      // The uses the bookkeeping counts — riders' (Mystic Mark) too.
      this.usesByFile.set(
        entity.filePath,
        extractCardsFromEntity(entity).flatMap((c) => {
          const max = c.maxUses ?? this.resolveMax(entity, c.maxExpr);
          return max != null && c.origin !== "spell"
            ? [
                {
                  key: c.id,
                  name: c.name,
                  max,
                  ...(c.recovery || c.recharge ? { recovery: c.recovery ?? c.recharge } : {}),
                },
              ]
            : [];
        })
      );
      const rolled = new Set<string>();
      const usesOf = (f: SessionFeatureCard): Partial<SessionFeatureCard> => ({
        ...(f.resourceRef ? { resourceRef: f.resourceRef } : {}),
        ...(f.maxUses != null ? { maxUses: f.maxUses } : {}),
        ...(f.recovery ? { recovery: f.recovery } : {}),
        ...(f.recharge ? { recharge: f.recharge } : {}),
      });
      // What the sheet rolls (Nature's Gift, Icicle Javelin) has its card already —
      // its dice, its target, the uses it spends. It plays from the feature's
      // stack (a bonus action) and counts the feature's uses; the feature's own
      // card, with nothing to roll, goes.
      const sessionCards = this.sessionActionCardsFor(entity, actor, "pc")
        .map((card) => {
          const feature = featureCards.find((c) => c.name.toLowerCase() === card.name.toLowerCase());
          if (!feature) return card;
          rolled.add(feature.id);
          // Attack first, whenever it strikes; else how it's taken — a bonus
          // action or a reaction plays from its own stack.
          const quick = feature.bucket === "bonus" || feature.bucket === "reaction";
          const bucket = quick && card.bucket === "action" ? feature.bucket : card.bucket;
          // One that strikes stays an attack, but is still taken as its feature says.
          const takes = quick && bucket === "attack" ? { takes: feature.bucket as "bonus" | "reaction" } : {};
          // (A spell's slot is spent by its cast — `[Kowyn/1st-Circle Slot-1]` — not counted here.)
          if (feature.origin === "spell")
            return { ...card, bucket, ...takes, id: card.id.replace(`:${card.bucket}:`, `:${bucket}:`) };
          // Where it comes from is the feature's (a class's, a heritage's) — its tile's ground.
          const from = feature.sourceKind ? { sourceKind: feature.sourceKind } : {};
          // A feature's card counts its uses under the feature's own key — the sheet's.
          return { ...card, bucket, ...takes, ...from, id: feature.id, ...usesOf(feature) };
        })
        .map((card) => {
          const rides = martial
            .filter((m) => card.origin === "weapon" && (!m.with || m.with === card.attackForm))
            .map((m) => m.rider);
          return rides.length > 0 ? { ...card, riders: [...(card.riders ?? []), ...rides] } : card;
        });
      const cards = [...sessionCards, ...featureCards.filter((c) => !rolled.has(c.id)).map((c) => ({ ...c, actor }))];
      if (cards.length > 0) {
        const stacks = buildCardStacks(cards, entity.name);
        pcStacks.set(entity.name, stacks);
      }
    }

    const gmStacks = this.gmFeatures.length > 0 ? buildGMStacksFromFeatures(this.gmFeatures) : buildGMStacks();
    return { pcStacks, gmStacks };
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
    const { pcStacks, gmStacks } = this.buildActionCards();
    // Targets are named as the log names them (`Talon`, not `Talon Pallton`).
    const logName = logNames(this.entities.map((e) => e.name));
    const entityNames = this.entities.map((e) => logName.get(e.name) ?? e.name);

    const handleAppendText = async (text: string, headerMap?: HeaderMap) => {
      // A card that asked for its pick up front arrives with the option selected
      // (`[a/b - a]`): spawn that option's lines, as picking it in the Log would.
      const picked = text.match(/\[[^\][]+?\s+-\s+([^\][]+?)\]/)?.[1]?.trim();
      const stepLines = Object.assign({}, ...this.gmFeatures.map((f) => gmStepLines(f, this.stepCtx)));
      const spawned = picked && stepLines[picked] ? applyChoicePick(text, picked, stepLines) : text;
      await this.appendToLogBody(spawned, headerMap);
    };

    // A table roll's row, read from the tables the GM tools load, so the Log can
    // preview a result before it is saved.
    const tableRoll = (ref: string, roll: number): string | undefined => {
      const table = this.stepCtx.tables?.[ref];
      if (!table) return undefined;
      return resolveTableRoll(`${ref} d100=${roll} ->`, table)
        .match(/->\s*(\S.*)$/)?.[1]
        ?.trim();
    };

    this.reactRoot.render(
      <TableRollContext.Provider value={tableRoll}>
        <SessionLogRoot
          logData={this.logData}
          sourcePath={this.filePath}
          initialSidebarOpen={this.initialSidebarOpen}
          initialToggles={this.toggles}
          onToggles={this.saveToggles}
          onSidebarToggle={(open) => void this.kv.set(`${this.stateKey}:log-sidebar-open`, open)}
          pcStacks={pcStacks}
          foeStacks={this.foeStacks}
          gmStacks={gmStacks}
          entityNames={entityNames}
          party={this.partySheets()}
          startHp={this.startHp}
          onApplySheet={(row) => void this.applySheetUpdate(row)}
          onApplyAllSheets={(rows) =>
            void (async () => {
              for (const row of rows) await this.applySheetUpdate(row);
            })()
          }
          onRecount={(who) => void this.recount(who)}
          sheetDone={this.sheetDone}
          onSheetDone={this.markDone}
          onAppendText={handleAppendText}
          onChoice={(selected) => void this.onChoicePick(selected)}
          onSave={(edits) => this.editLogBody(edits.scenes, edits.dice)}
          resources={this.stepCtx.resources ?? {}}
          lists={this.stepCtx.lists ?? {}}
          resolveRef={this.resolveRef}
          resolveCombatant={this.resolveCombatant}
          lookupCreature={this.lookupCreature}
          mapTools={this.mapTools}
          tokenIcon={this.tokenIcon}
          actorPage={this.actorPage}
          partyName={this.partyName}
          saveModifier={this.saveModifier}
          speedOf={this.speedOf}
          keepsDying={this.keepsDying}
          xpOf={this.xpOf}
          hitDiceOf={this.hitDiceOf}
          lootOf={this.lootOf}
          itemNote={this.itemNote}
          itemNotes={this.itemNotes}
          itemCost={this.itemCost}
          destinations={this.destinations()}
          iconFor={this.iconFor}
          loadoutsFor={this.loadoutsFor}
          heldLoadoutOf={this.heldLoadoutOf}
          hudOf={this.hudOf}
          openSheet={this.openSheet}
          makePortrait={this.makePortrait}
          onEquip={(actor, name) => void this.equip(actor, name)}
          makeIcon={this.makeIcon}
          makeNamedIcon={this.makeNamedIcon}
          holdsThings={this.holdsThings}
          conditionRules={this.conditionRules}
          defenseOf={this.defenseOf}
          initiativeOf={this.initiativeOf}
          onEditBody={(edit) => void this.rewriteLogBody(edit)}
          battleMaps={this.battleMaps}
          sheetHas={this.sheetHas}
        />
      </TableRollContext.Provider>
    );
  }
}

interface SessionLogRootProps {
  logData: SessionLogData;
  sourcePath: string;
  initialSidebarOpen: boolean;
  /** The toggles switched on (saved with this log's state), and keeping them. */
  initialToggles: string[];
  onToggles: (keys: string[]) => void;
  onSidebarToggle: (open: boolean) => void;
  pcStacks: Map<string, CardStack[]>;
  /** The foes still in play, by name, with their statblock actions. */
  foeStacks: Map<string, CardStack[]>;
  gmStacks: CardStack[];
  entityNames: string[];
  /** The party's sheets — as they are, and as the log first read them. */
  party: PartySheet[];
  /** Where the log starts a creature's hit points (a party member's, from
   *  their sheet as the log first read it). */
  startHp: (name: string) => Health | undefined;
  /** Write one of the session's changes to its sheet. */
  onApplySheet: (row: BookkeepingRow) => void;
  /** Write every change still to make. */
  onApplyAllSheets: (rows: BookkeepingRow[]) => void;
  /** Count a party member's changes from their sheet as it is now. */
  onRecount: (who: string) => void;
  /** The changes seen on the sheets already — done for good. */
  sheetDone: Set<string>;
  /** Remember changes seen on their sheets. */
  onSheetDone: (ids: string[]) => void;
  onAppendText: (text: string, headerMap?: HeaderMap) => void;
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
  /** A PC's value for a `[[Name]]` roll term, by actor name. */
  resolveRef: (actor: string, name: string) => number | undefined;
  /** A combatant's value for a roll term in an `[Init:]` entry. */
  resolveCombatant: (combatant: string, name: string) => number | undefined;
  /** Look up a creature's statblock — for the Start Combat card. */
  lookupCreature: (link: string) => Promise<CreatureInfo>;
  /** The battle maps the log's fights are bound to, by link. */
  battleMaps: Record<string, SquareMap>;
  /** Look up a battle map by its note — for the Start Combat card. */
  mapTools: MapTools;
  /** A combatant's token emoji, from their note. */
  tokenIcon: (name: string) => string | undefined;
  /** The page an action's actor links to (`Talon` → `Talon Pallton`). */
  actorPage: (name: string) => string | undefined;
  /** A party member's short name (`Talon Pallton` → `Talon`). */
  partyName: (actor: string) => string | undefined;
  /** What a creature adds to a save (`STR`) — for status cards. */
  saveModifier: (name: string, ability: string) => number | undefined;
  /** A creature's walking speed in feet, from its sheet or statblock. */
  speedOf: (name: string) => number | undefined;
  /** A creature the GM keeps dying like a PC at 0 HP (`death_saves: true`). */
  keepsDying: (name: string) => boolean;
  /** What defeating a creature is worth in XP. */
  xpOf: (name: string) => number | undefined;
  /** A party member's hit dice, by size. */
  hitDiceOf: (name: string) => Array<{ die: string; left: number; max: number }>;
  /** What a fallen creature leaves to take — its weapons and armour. */
  lootOf: (name: string) => Array<{ name: string; link: boolean }>;
  /** Whether an item has a note of its own. */
  itemNote: (name: string) => boolean;
  /** The vault's item notes, to find as you type. */
  itemNotes: () => NoteOption[];
  /** An item note's price in gp. */
  itemCost: (name: string) => Promise<ItemPrice | undefined>;
  /** Bags the party shares. */
  /** Where loot can go — each member, and the containers they carry. */
  destinations: LootDestination[];
  /** A card's own icon art, when the vault has some. */
  iconFor: (name: string) => string | undefined;
  /** The loadouts a character's sheet declares, and putting one in hand. */
  loadoutsFor: (actor: string) => Loadout[];
  onEquip: (actor: string, loadout: string) => void;
  heldLoadoutOf: (actor: string) => string | undefined;
  /** The HUD's face, hands and loadout icons for a character, by drawer name. */
  hudOf: (drawerName: string) => HudInfo | undefined;
  /** Open a character's sheet. */
  openSheet: (path: string) => void;
  /** Make a character's picture in the image studio. */
  makePortrait: (drawerName: string) => void;
  /** Make a card's icon in the image studio. */
  makeIcon: (card: SessionFeatureCard, kind: TileKind) => void;
  /** Make an icon for something that isn't a card: a held item, a loadout. */
  makeNamedIcon: (what: { name: string; text?: string; tone?: IconTone }) => void;
  /** Whether an item found can hold things. */
  holdsThings: (name: string) => boolean;
  conditionRules: (condition: string) => { name: string; rules: string[] } | undefined;
  /** A combatant's AC and hit points, from their sheet or statblock. */
  defenseOf: (name: string) => { ac?: number; hp?: Health };
  /** A combatant's Initiative modifier — for rolling it from the map. */
  initiativeOf: (name: string) => Promise<number | undefined>;
  /** Rewrite the log's body (the map's Setup edits). */
  onEditBody: (edit: (body: string) => string) => void;
  /** Whether a PC's sheet already lists an item, for the inventory checklist. */
  sheetHas: (owner: string | undefined, item: string) => boolean | undefined;
}

function SessionLogRoot({
  logData,
  sourcePath,
  initialSidebarOpen,
  initialToggles,
  onToggles,
  onSidebarToggle,
  pcStacks,
  foeStacks,
  gmStacks,
  entityNames,
  party,
  startHp,
  onApplySheet,
  onApplyAllSheets,
  onRecount,
  sheetDone,
  onSheetDone,
  onAppendText,
  onChoice,
  onSave,
  resources,
  lists,
  resolveRef,
  resolveCombatant,
  lookupCreature,
  battleMaps,
  mapTools,
  tokenIcon,
  actorPage,
  partyName,
  saveModifier,
  speedOf,
  keepsDying,
  xpOf,
  hitDiceOf,
  lootOf,
  itemNote,
  itemNotes,
  itemCost,
  destinations,
  holdsThings,
  iconFor,
  loadoutsFor,
  onEquip,
  heldLoadoutOf,
  hudOf,
  openSheet,
  makePortrait,
  makeIcon,
  makeNamedIcon,
  conditionRules,
  defenseOf,
  initiativeOf,
  onEditBody,
  sheetHas,
}: SessionLogRootProps) {
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
  const inventoryChanges = React.useMemo(() => collectInventoryChanges(segments), [segments]);
  // Fights bound to a map, replayed entry by entry, and the foes' health along
  // the way — what the map pane draws.
  const battles = React.useMemo(() => foldBattles(segments), [segments]);
  const foesAt = React.useMemo(() => foldFoes(segments), [segments]);
  // Everyone's hit points through the log, from their sheets and statblocks:
  // what each hit leaves its target with.
  const health = React.useMemo(
    () =>
      foldHealth(
        segments,
        (name) => startHp(name),
        (name) => defenseOf(name).ac,
        // The party dies by death saves at 0 HP — and anyone the GM keeps so; a monster just dies.
        (name) => !!partyName(name) || keepsDying(name)
      ),
    [segments, defenseOf, startHp, partyName, keepsDying]
  );
  // The party's sheets the session changed — hit points, uses, spell slots —
  // counted from each sheet as the log first read it.
  // Ammunition spent and recovered, counted against what each sheet carries.
  const ammoBook = React.useMemo(
    () =>
      ammoRows(
        party.map((p) => ({ name: p.name, page: p.page, baseline: p.baseline.ammo ?? {}, sheet: p.sheet.ammo ?? {} })),
        inventoryChanges
      ),
    [party, inventoryChanges]
  );
  const sheetRows = React.useMemo(
    () => [...bookkeeping(party, resourcesSpent(segments), health.now), ...ammoBook],
    [party, segments, health, ammoBook]
  );
  // Ammunition counted as a row isn't listed again as an item.
  const itemChanges = React.useMemo(
    () => inventoryChanges.filter((c) => !isAmmoChange(c, ammoBook)),
    [inventoryChanges, ammoBook]
  );
  // Each party member's ammunition as the log began, for the Log's running count.
  const ammoStart = React.useCallback(
    (key: string) => {
      for (const p of party) {
        const hit = p.baseline.ammo?.[key] ?? p.sheet.ammo?.[key];
        if (hit) return hit;
      }
      return undefined;
    },
    [party]
  );
  // The cards' uses, as the log leaves them — its own `[Talon/Mystic Mark-1]`s.
  // A GM card's uses (written nowhere in the log) are counted as it plays.
  const [gmSpent, setGmSpent] = React.useState<Record<string, number>>({});
  const partyUses = React.useMemo(() => usesSpent(sheetRows, party), [sheetRows, party]);
  const consumableState: SessionConsumableState = React.useMemo(
    () => ({
      spent: { ...gmSpent, ...partyUses },
      initialSpent: Object.assign({}, ...party.map((p) => p.sheet.uses)) as Record<string, number>,
    }),
    [gmSpent, partyUses, party]
  );
  // The foes as they stand now — their conditions — for an attack's riders: is
  // the target marked already, and who else bears a mark that's about to move.
  const fight = React.useMemo(() => {
    const latest = new Map<string, FoeAt>();
    for (const foes of [...foesAt.entries()].sort((a, b) => a[0] - b[0]).map(([, f]) => f)) {
      for (const f of foes) latest.set(combatantKey(f.name), f);
    }
    const shown = (name: string) =>
      name.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string, a?: string) => a ?? t).trim();
    return {
      conditionsOf: (name: string) => latest.get(combatantKey(name))?.conditions ?? [],
      withCondition: (c: string) =>
        [...latest.values()].filter((f) => f.conditions?.includes(c)).map((f) => shown(f.name)),
      isFoe: (name: string) => latest.has(combatantKey(name)),
    };
  }, [foesAt]);

  // ── Status: a condition a card leaves (Icicle Javelin's `pinned`) gives its
  // bearer a stack of its own while it lasts — the save that shakes it off ──
  // A condition that lasts as long as its source says (Luminous Bolt's
  // blinded, "until the end of its next turn") ends with itself.
  const endsWhen = React.useMemo(() => {
    const lasting = new Map<string, "end-of-next-turn">();
    for (const card of [...pcStacks.values(), ...foeStacks.values()].flat().flatMap((st) => st.cards)) {
      const d = card.inflicts ? durationOf(card.inflicts.note ?? card.inflicts.when) : undefined;
      if (d && card.inflicts)
        lasting.set(`${card.name.toLowerCase()}\u0000${card.inflicts.condition.toLowerCase()}`, d);
    }
    return (condition: string, from: string | undefined) =>
      from ? lasting.get(`${from.toLowerCase()}\u0000${condition}`) : undefined;
  }, [pcStacks, foeStacks]);
  const conditions = React.useMemo(() => conditionsNow(segments, endsWhen), [segments, endsWhen]);
  // Whether a combatant is out of the fight now: dead — a monster at 0 HP, a
  // PC past its death saves — or a state its tags gave it (dead, fled). A
  // dying PC isn't: it can still be struck, and healed.
  const isDownNow = React.useCallback(
    (name: string) => {
      const now = health.now(name);
      const dies = !!partyName(name) || keepsDying(name);
      if (now?.life?.state === "dead" || (now?.current === 0 && !dies)) return true;
      if (dies) return false;
      const latest = [...foesAt.entries()].sort((a, b) => a[0] - b[0]).flatMap(([, f]) => f);
      const foe = [...latest]
        .reverse()
        .find((f) => combatantKey(f.name) === combatantKey(name) || matchActor(name, [{ name: f.name }]) >= 0);
      return !!foe && (foe.current === 0 || /dead|fled|defeated|unconscious|down|surrendered/i.test(foe.state ?? ""));
    },
    [health, foesAt, partyName, keepsDying]
  );
  // What the conditions in play do to a card's rolls — read from the
  // system's own condition rules.
  const rollConditions = React.useMemo(() => {
    const read = new Map<string, ConditionEffects | undefined>();
    return {
      conditionsOf: (name: string) => {
        const key = combatantKey(name.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string) => t));
        const found =
          conditions.get(key) ??
          [...conditions.entries()].find(
            ([k]) => matchActor(name, [{ name: k }]) >= 0 || matchActor(k, [{ name }]) >= 0
          )?.[1];
        // At 0 HP and not dead — dying, or stable — a PC is unconscious (and prone).
        const life = health.now(name)?.life;
        const atZero = life && life.state !== "dead" ? ["unconscious", "prone"] : [];
        return [...new Set([...(found?.keys() ?? []), ...atZero])];
      },
      effectsOf: (condition: string) => {
        if (!read.has(condition)) {
          const rules = conditionRules(condition)?.rules;
          read.set(condition, rules ? readConditionRules(rules) : undefined);
        }
        return read.get(condition);
      },
    };
  }, [conditions, conditionRules, health]);
  const withStatus = React.useCallback(
    (stacks: Map<string, CardStack[]>, isFoe: boolean): Map<string, CardStack[]> => {
      // How each card's condition is shaken off, by the card that leaves it —
      // the tag names its source (`+pinned([[Icicle Javelin º]])`).
      const inflicters: Array<{ def: NonNullable<SessionFeatureCard["inflicts"]>; from: string }> = [];
      for (const all of [pcStacks, foeStacks]) {
        for (const list of all.values()) {
          for (const card of list.flatMap((s) => s.cards)) {
            if (card.inflicts) inflicters.push({ def: card.inflicts, from: card.name });
          }
        }
      }
      const escapeFrom = (condition: string, from: string | undefined) => {
        const same = inflicters.filter((i) => i.def.condition.toLowerCase() === condition);
        return (from ? same.find((i) => i.from.toLowerCase() === from.toLowerCase()) : undefined) ?? same[0];
      };
      const out = new Map<string, CardStack[]>();
      for (const [who, list] of stacks) {
        const actor = list[0]?.cards[0]?.actor ?? who;
        // A condition gets a card when its source says how it ends, or the system knows it.
        const cards = [...(conditions.get(combatantKey(actor)) ?? new Map<string, string | undefined>())].flatMap(
          ([c, source]) => {
            const escape = escapeFrom(c, source);
            const known = conditionRules(c);
            if (!escape && !known) return [];
            const def = escape?.def;
            const modifier = def?.save ? saveModifier(actor, def.save) : undefined;
            const from = source ?? escape?.from;
            return [
              statusCard({
                actor,
                isFoe,
                condition: c,
                ...(def?.save ? { save: def.save } : {}),
                ...(def?.when ? { when: def.when } : {}),
                ...(def?.fail ? { fail: def.fail } : {}),
                ...(modifier != null ? { modifier } : {}),
                ...(from ? { from } : {}),
                ...(known ? { rules: known.rules } : {}),
              }),
            ];
          }
        );
        // Dying at 0 HP — a PC, or a creature the GM keeps dying — means a
        // death save at the start of each turn.
        const life = health.now(actor)?.life;
        if (life?.state === "dying") {
          cards.unshift({
            id: `death-save:${actor}`,
            name: "Death Save",
            bucket: "status",
            logTemplate: "@({{actor}}) Death save\nd: Death save | d20= vs DC 10 ->",
            summary:
              `Dying — ${life.successes}✓ ${life.failures}✗. A d20, no modifier: 10 or more a success, a 1 two failures, ` +
              "a 20 back on their feet at 1 HP. Three successes: stable. Three failures: dead.",
            icon: "💀",
            source: "status",
            actor,
          });
        }
        // Someone else in the party is dying: anyone on their feet can try to
        // stabilize them — an action, a DC 10 WIS (Medicine) check.
        const someoneDying =
          !isFoe &&
          !life &&
          [...stacks.values()].some((l) => {
            const other = l[0]?.cards[0]?.actor;
            return !!other && other !== actor && health.now(other)?.life?.state === "dying";
          });
        const withStabilize = someoneDying
          ? list.map((st) =>
              st.bucket === "action"
                ? {
                    ...st,
                    cards: [
                      ...st.cards,
                      {
                        id: `stabilize:${actor}`,
                        name: "Stabilize",
                        bucket: "action" as const,
                        logTemplate: "@({{actor}}) Stabilizes {{target}}\nd: Medicine | d20+[[Medicine]]= vs DC 10 ->",
                        onSuccess: "=> [PC:{{target}}|+stable]",
                        targets: "dying" as const,
                        summary:
                          "Use your action on a dying creature: a DC 10 WIS (Medicine) check. On a success it's stable — " +
                          "no more death saves, still at 0 HP and unconscious.",
                        icon: "🩹",
                        source: "Medicine",
                        link: "Medicine",
                        actor,
                      },
                    ],
                  }
                : st
            )
          : list;
        out.set(
          who,
          cards.length > 0
            ? [
                { actor: who, actorType: isFoe ? "foe" : "pc", bucket: "status", label: "Status", cards },
                ...withStabilize,
              ]
            : withStabilize
        );
      }
      return out;
    },
    [pcStacks, foeStacks, conditions, saveModifier, conditionRules, health]
  );
  const pcStacksBase = React.useMemo(() => withStatus(pcStacks, false), [withStatus, pcStacks]);
  const foeStacksBase = React.useMemo(() => withStatus(foeStacks, true), [withStatus, foeStacks]);

  // Passives always, actives while the log has them on: what they change is
  // written into the cards they touch. An active is on by the log's last word
  // on it (`@(Kowyn) Rage on`).
  const [toggledOn, setToggledOn] = React.useState<Set<string>>(() => new Set(initialToggles));
  const flipToggle = React.useCallback(
    (card: SessionFeatureCard) => {
      setToggledOn((prev) => {
        const next = new Set(prev);
        const key = toggleKey(card.actor, card.name);
        if (!next.delete(key)) next.add(key);
        onToggles([...next]);
        return next;
      });
    },
    [onToggles]
  );
  const withModifiers = React.useCallback(
    (stacks: Map<string, CardStack[]>): Map<string, CardStack[]> => {
      const out = new Map<string, CardStack[]>();
      for (const [who, list] of stacks) {
        const all = list.flatMap((st) => st.cards);
        const applying = all
          .filter((c) => c.modifies && (!c.toggle || toggledOn.has(toggleKey(c.actor, c.name))))
          .map((c) => ({ from: c.name.replace(/\s*[ᴬᴮᴰᴴᴷᴺº]+$/u, "").trim(), modifies: c.modifies! }));
        out.set(
          who,
          list.map((st) => ({
            ...st,
            cards: st.cards.map((c) => {
              if (c.toggle) {
                return { ...c, on: toggledOn.has(toggleKey(c.actor, c.name)) };
              }
              return applying.length > 0 ? modifyCard(c, applying) : c;
            }),
          }))
        );
      }
      return out;
    },
    [toggledOn]
  );
  const pcStacksNow = React.useMemo(() => withModifiers(pcStacksBase), [withModifiers, pcStacksBase]);
  const foeStacksNow = React.useMemo(() => withModifiers(foeStacksBase), [withModifiers, foeStacksBase]);

  // Inside a fight, cards can move their actor too — from where they stand.
  // Its clock — the round, who's next — drives the GM's round and turn cards;
  // a foe that's down or fled has no turn to take.
  const combat = React.useMemo(() => {
    if (!combatOpen(segments)) return undefined;
    const lastFoes = new Map<string, boolean>();
    for (const foes of [...foesAt.entries()].sort((a, b) => a[0] - b[0]).map(([, f]) => f)) {
      for (const f of foes) lastFoes.set(combatantKey(f.name), isDown(f));
    }
    const clock = combatClock(segments, (name) => lastFoes.get(combatantKey(name)) === true) ?? { round: 0, next: [] };
    return { squareOf: (actor: string) => squareNow(battles, battleMaps, actor), clock };
  }, [segments, battles, battleMaps, foesAt]);
  // A fight bound to a map gives the log its map (with a note if the map is missing).
  const hasBattle = battles.length > 0;
  // With the Log open, each fight's entries are grouped under its map, which
  // sticks to the top of the Log while they scroll past.
  // The entry being read: whichever narrated entry sits nearest the upper third
  // of the screen. The map pane follows it.
  const [readingId, setReadingId] = React.useState<number | null>(null);
  // Until when a jump (the map's replay buttons) holds the reading position
  // against the scrolling it sets off — see `seekEntry`.
  const seekHold = React.useRef(0);
  /** The reading position, as scrolling reports it — unless a jump is still settling. */
  const readFromScroll = React.useCallback((id: number) => {
    if (Date.now() < seekHold.current) return;
    setReadingId(id);
  }, []);
  const scenes = React.useMemo(() => assembleProse(segments), [segments]);
  const dialOps = React.useMemo(() => resolveDialOps(logData.entries, resources), [logData.entries, resources]);
  const listOps = React.useMemo(() => resolveListOps(logData.entries, lists), [logData.entries, lists]);
  // The running values at the end of the log (`CF` → 4): declared defaults,
  // then every op in order — what a card played now runs against.
  const currentVars = React.useMemo(() => {
    const now: Record<string, number> = { ...resourceDefaults(resources) };
    for (const ops of dialOps.values()) for (const op of ops) now[op.key] = op.current;
    return now;
  }, [dialOps, resources]);
  // How each entry's action is taken — by the card it plays, its actor's: a
  // bonus action, a reaction, else an action (narration and moves, none).
  // The card an entry plays: the one its call names, or its text begins with.
  const cardFor = React.useCallback(
    (actor: string, name: string | undefined, text: string): SessionFeatureCard | undefined => {
      const cards = [...pcStacks.values(), ...foeStacks.values()]
        .flat()
        .flatMap((s) => s.cards)
        .filter((c) => combatantKey(c.actor) === combatantKey(actor) || matchActor(actor, [{ name: c.actor }]) >= 0);
      const lower = text.trim().toLowerCase();
      return (
        (name ? cards.find((c) => c.name.toLowerCase() === name.toLowerCase()) : undefined) ??
        cards.filter((c) => lower.startsWith(c.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0]
      );
    },
    [pcStacks, foeStacks]
  );
  // The cards that hold attacks: a Multiattack (its statblock's count), an
  // Opportunity Attack (one melee attack, as a reaction).
  const multiattackOf: MultiattackOf = React.useCallback(
    (actor, name) => {
      if (name && /^opportunity attack$/i.test(name.trim())) return { count: 1, attacks: [] };
      const m = name ? cardFor(actor, name, "")?.multiattack : undefined;
      return m ? { count: m.count, attacks: m.attacks.map((a) => a.name) } : undefined;
    },
    [cardFor]
  );
  const kindOf: KindOf = React.useCallback(
    (actor, name, text) => {
      const card = cardFor(actor, name, text);
      if (!card) return undefined;
      if (card.takes) return card.takes;
      if (card.bucket === "bonus" || card.bucket === "reaction") return card.bucket;
      return card.bucket === "attack" || card.bucket === "action" || card.bucket === "active" ? "action" : undefined;
    },
    [cardFor]
  );
  // What each round spent — the round lines' tallies, and what a card about to
  // spend a slot again is warned of.
  const economies = React.useMemo(
    () => roundEconomies(segments, kindOf, multiattackOf),
    [segments, kindOf, multiattackOf]
  );
  const spentNow = React.useCallback((actor: string) => slotsUsed(segments, economies, actor), [segments, economies]);
  // The movement rules' view of everyone: speed, melee reach, side, the round
  // they move in (did they Dash, Disengage?), and whether they're down.
  const moveRules = React.useMemo(() => {
    const shownName = (n: string) =>
      n.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string) => t).trim();
    // The same creature, either way it's written (`Talon` / `[[Talon Pallton]]`).
    const sameName = (a: string, b: string) =>
      combatantKey(shownName(a)) === combatantKey(shownName(b)) ||
      matchActor(shownName(a), [{ name: shownName(b) }]) >= 0 ||
      matchActor(shownName(b), [{ name: shownName(a) }]) >= 0;
    // A creature's melee reach: its longest — a statblock's `reach 10 ft.`, a
    // reach weapon's 10 ft — else 5 ft.
    const reachOf = (name: string) => {
      const cards = [...pcStacks.values(), ...foeStacks.values()]
        .flat()
        .flatMap((st) => st.cards)
        .filter((c) => sameName(c.actor, name));
      const feet = cards.flatMap((c) => {
        const r = c.range ?? "";
        const m = r.match(/reach\s*(\d+)/i) ?? (c.attackForm === "melee" ? r.match(/^\s*(\d+)\s*ft/i) : null);
        return m ? [parseInt(m[1], 10)] : [];
      });
      return Math.max(5, ...feet);
    };
    const info = (name: string): MoverInfo => {
      const speed = speedOf(name);
      return { reach: reachOf(name), foe: !partyName(name), ...(speed != null ? { speed } : {}) };
    };
    const rounds = [...economies.entries()];
    const roundOf = (name: string, id: number) => {
      const found = rounds.filter(([at, e]) => at <= id && sameName(e.owner, name)).pop();
      if (!found) return undefined;
      const [start, e] = found;
      // Whether it's still its round there — no one else's begun since.
      const latest = rounds.filter(([at]) => at <= id).pop();
      return {
        start,
        current: latest?.[0] === start,
        dashed: e.used.action.some((u) => /^dash\b/i.test(u)),
        disengaged: e.used.action.some((u) => /^disengage\b/i.test(u)),
      };
    };
    // The move an entry's card grants (Scurry's 15 ft): the card the mover
    // plays in that entry — its call, or what its text begins with.
    const grantOf = (name: string, id: number) => {
      const seg = segments.find((x) => x.sourceIndex === id);
      if (!seg || seg.type !== "action-group" || !seg.action.actor || !sameName(seg.action.actor, name))
        return undefined;
      const text = seg.action.text ?? "";
      const calls = [leadingActionCall(text)?.name, ...findActionCalls(text).map((c) => c.name)].filter(
        (n): n is string => !!n
      );
      for (const n of calls.length > 0 ? calls : [undefined]) {
        const card = cardFor(seg.action.actor, n, text);
        if (card?.grantsMove) return card.grantsMove;
      }
      return undefined;
    };
    const downAt = (name: string, id: number) => health.at(id, name)?.current === 0;
    return { sameName, info, roundOf, downAt, grantOf };
  }, [pcStacks, foeStacks, economies, speedOf, partyName, health, segments, cardFor]);
  // Every move read against the rules: feet of speed, conditions that forbid
  // it, the opportunity attacks it provoked — said on its move pill.
  const moveChecks = React.useMemo(() => {
    const out = new Map<number, MoveCheck[]>();
    for (const battle of battles) {
      for (const [id, list] of checkMoves(
        battle,
        battleMaps[battle.map],
        moveRules.info,
        moveRules.roundOf,
        moveRules.downAt,
        moveRules.grantOf
      )) {
        out.set(id, list);
      }
    }
    return out;
  }, [battles, battleMaps, moveRules]);
  // The fight now, for the cards: a move about to be made, read against the
  // rules (its feet, what's left, who it'd provoke); and who the last move
  // provoked — their Opportunity Attack aimed at the mover.
  const combatNow = React.useMemo(() => {
    if (!combat) return undefined;
    const battle = [...battles].reverse().find((b) => b.end == null);
    const map = battle ? battleMaps[battle.map] : undefined;
    const lastId = segments.length > 0 ? segments[segments.length - 1].sourceIndex : -1;
    const moveAhead = (actor: string, routes: string[], grant?: MoveGrant) => {
      if (!battle) return undefined;
      const placed = battle.frames.length > 0 ? battle.frames[battle.frames.length - 1].placements : battle.opening;
      const mine = placed.find((p) => moveRules.sameName(p.name, actor));
      if (!mine) return undefined;
      const path = [
        mine.at,
        ...routes
          .flatMap((r) => r.split(">"))
          .map((x) => parseSquare(x))
          .filter((q): q is Square => q != null),
      ];
      if (path.length < 2) return undefined;
      const me = moveRules.info(actor);
      const round = moveRules.roundOf(actor, lastId);
      // Feet already walked in its round.
      let spent = 0;
      for (const [id, list] of moveChecks) {
        if (round && id >= round.start) for (const c of list) if (moveRules.sameName(c.name, actor)) spent += c.feet;
      }
      const feet = routeFeet(path, map);
      // Granted by the card: its own limit. A plain move: the round's speed, in
      // its own round — or said to be outside it.
      const own = !grant && !!round?.current;
      const provokes =
        round?.disengaged || grant?.noProvoke
          ? []
          : provokedBy(
              path,
              me,
              placed.filter((p) => p !== mine),
              moveRules.info,
              map?.scale,
              (n) => moveRules.downAt(n, lastId)
            );
      const allowance = grant
        ? grantFeet(grant, me.speed)
        : own && me.speed != null
          ? me.speed * (round?.dashed ? 2 : 1)
          : undefined;
      return {
        feet,
        spent: grant ? feet : spent + feet,
        ...(allowance != null ? { allowance } : {}),
        ...(grant ? { granted: grant.from } : {}),
        ...(!grant && !own ? { offTurn: true } : {}),
        provokes: provokes.map((n) =>
          n.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string) => t)
        ),
      };
    };
    // Who the log's last move provoked, and by whom.
    const provoked = new Map<string, string>();
    const last = [...moveChecks.entries()].sort((a, b) => a[0] - b[0]).pop();
    // (Only the log's last entry: an opportunity attack answers the move just made.)
    if (last && last[0] === lastId) {
      for (const c of last[1])
        for (const p of c.provokes) provoked.set(combatantKey(p.replace(/\[\[|\]\]/g, "")), c.name);
    }
    const provokedFor = (actor: string) => {
      for (const [k, mover] of provoked)
        if (moveRules.sameName(k, actor))
          return mover.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string) => t);
      return undefined;
    };
    // Where the actor will stand once its routes are walked (or stands now).
    const standing = (actor: string, routes: string[]) => {
      if (!battle) return undefined;
      const placed = battle.frames.length > 0 ? battle.frames[battle.frames.length - 1].placements : battle.opening;
      const mine = placed.find((p) => moveRules.sameName(p.name, actor));
      const steps = routes
        .flatMap((r) => r.split(">"))
        .map((x) => parseSquare(x))
        .filter((q): q is Square => q != null);
      const at = steps.length > 0 ? steps[steps.length - 1] : mine?.at;
      return at ? { at, placed, mine } : undefined;
    };
    // How far a target is from the actor, from where it'll stand when it acts.
    const distanceTo = (actor: string, target: string, routes: string[] = []) => {
      const from = standing(actor, routes);
      const them = from?.placed.find((p) => moveRules.sameName(p.name, target));
      return from && them ? squareDistance(from.at, them.at) * (map?.scale || 5) : undefined;
    };
    // The hostile creatures within 5 ft of it there — a ranged attack's disadvantage.
    const crowding = (actor: string, routes: string[] = []) => {
      const from = standing(actor, routes);
      if (!from) return [];
      const me = moveRules.info(actor);
      return from.placed
        .filter((p) => p !== from.mine && moveRules.info(p.name).foe !== me.foe && !moveRules.downAt(p.name, lastId))
        .filter((p) => squareDistance(from.at, p.at) * (map?.scale || 5) <= 5)
        .map((p) => p.name.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string) => t));
    };
    // The fight's XP: every foe in it, what each is worth — and the party
    // members who fought it (not the dead), to share it.
    const shown = (n: string) =>
      n.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string, a?: string) => a ?? t).trim();
    const everyone = battle
      ? [...battle.opening, ...battle.frames.flatMap((f) => f.placements)].map((p) => p.name)
      : [];
    const seen = new Set<string>();
    const fighters = everyone.filter((n) => {
      const k = combatantKey(shown(n));
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const xp = {
      foes: fighters.filter((n) => !partyName(n)).map((n) => ({ name: shown(n), xp: xpOf(n) })),
      party: fighters.flatMap((n) => {
        const pc = partyName(n);
        return pc && health.now(pc)?.life?.state !== "dead" ? [pc] : [];
      }),
    };
    return { ...combat, moveAhead, provokedFor, distanceTo, crowding, xp };
  }, [combat, battles, battleMaps, segments, moveRules, moveChecks, partyName, xpOf, health]);
  // What each ended fight was worth — for the XP its ending line hands out.
  const fightWorth = React.useCallback(
    (id: number) => {
      const shown = (n: string) =>
        n.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string, a?: string) => a ?? t).trim();
      for (const b of battles) {
        if (b.end == null) continue;
        const at = segments.findIndex((s) => s.sourceIndex === b.end);
        if (segments[at + 1]?.sourceIndex !== id && b.end !== id) continue;
        const seen = new Set<string>();
        let total = 0;
        for (const p of [...b.opening, ...b.frames.flatMap((f) => f.placements)]) {
          const k = combatantKey(shown(p.name));
          if (seen.has(k) || partyName(p.name)) continue;
          seen.add(k);
          total += xpOf(p.name) ?? 0;
        }
        return total > 0 ? total : undefined;
      }
      return undefined;
    },
    [battles, segments, partyName, xpOf]
  );
  // The party as one, for its cards: each member as they stand now (HP, hit
  // dice, uses, slots, exhaustion — the sheet as the log leaves it), where loot
  // can go, what the last fight left, and the day's clock.
  // Each party member's pills: spell slots by circle against their caster's
  // most (a warlock's as pact slots), and their features' uses — as the log
  // leaves them.
  const resourcesFor = React.useCallback(
    (actor: string): HotbarResource[] => {
      const p = party.find((x) => x.name.toLowerCase() === actor.toLowerCase());
      if (!p) return [];
      const out: HotbarResource[] = [];
      for (const caster of p.casters) {
        const maxes = p.slotMax?.[caster] ?? [];
        const pact = /warlock/i.test(caster);
        maxes.forEach((max, i) => {
          if (!max) return;
          const circle = i + 1;
          const row = sheetRows.find((r) => r.who === p.name && r.kind === "slot" && r.key === `${caster}:${circle}`);
          const spent = row?.target ?? p.sheet.slots[caster]?.[String(circle)] ?? 0;
          out.push({
            kind: pact ? "pact" : "slot",
            label: `${pact ? "Pact" : ordinalCircle(circle)} slot${max > 1 ? "s" : ""}${pact ? ` (circle ${circle})` : ""}`,
            max,
            left: Math.max(0, max - spent),
            circle,
            recovery: pact ? "short rest" : "long rest",
          });
        });
      }
      for (const u of p.uses) {
        if (u.max == null) continue;
        const spent = partyUses[u.key] ?? p.sheet.uses[u.key] ?? 0;
        out.push({
          kind: "use",
          label: u.name,
          max: u.max,
          left: Math.max(0, u.max - spent),
          glyph: resourceGlyph(u.name),
          ...(u.recovery ? { recovery: u.recovery } : {}),
        });
      }
      return out;
    },
    [party, sheetRows, partyUses]
  );
  const partyNow = React.useMemo(() => {
    const shown = (n: string) =>
      n.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string, a?: string) => a ?? t).trim();
    const members: PartyMember[] = party.map((p) => {
      const rowFor = (kind: string, key: string) =>
        sheetRows.find((r) => r.who === p.name && r.kind === kind && r.key === key);
      const hp = health.now(p.name);
      const con = saveModifier(p.name, "CON");
      // Hit dice: the sheet's, moved by the log (a spend off the largest first).
      let dice = hitDiceOf(p.name);
      const hd = rowFor("counter", "Hit Dice");
      if (hd) {
        let change = hd.target - hd.sheet;
        dice = [...dice]
          .sort((a, b) => parseInt(b.die.slice(1), 10) - parseInt(a.die.slice(1), 10))
          .map((d) => {
            const left = Math.max(0, Math.min(d.max, d.left + change));
            change -= left - d.left;
            return { ...d, left };
          });
      }
      const caster = p.casters[0];
      const circles = new Set<string>([
        ...Object.keys((caster && p.sheet.slots[caster]) || {}),
        ...sheetRows.filter((r) => r.who === p.name && r.kind === "slot").map((r) => r.key.split(":")[1]),
      ]);
      const slots = caster
        ? [...circles].map((c) => ({
            circle: Number(c),
            spent: rowFor("slot", `${caster}:${c}`)?.target ?? p.sheet.slots[caster]?.[c] ?? 0,
          }))
        : [];
      const exhaustion = rowFor("counter", "Exhaustion")?.target ?? p.sheet.counters?.Exhaustion ?? 0;
      return {
        name: p.name,
        ...(hp ? { hp } : {}),
        ...(con != null ? { con } : {}),
        hitDice: dice,
        uses: p.uses.map((u) => ({
          name: u.name,
          spent: partyUses[u.key] ?? p.sheet.uses[u.key] ?? 0,
          ...(u.max != null ? { max: u.max } : {}),
          ...(u.recovery ? { recovery: u.recovery } : {}),
        })),
        slots,
        exhaustion,
      };
    });
    // The last fight's spoils: its fallen's gear, and the party's spent ammunition.
    const last = battles[battles.length - 1];
    let lootSource: LootSource | undefined;
    if (last) {
      const seen = new Set<string>();
      const items: LootSource["items"] = [];
      for (const pl of [...last.opening, ...last.frames.flatMap((f) => f.placements)]) {
        const k = combatantKey(shown(pl.name));
        if (seen.has(k) || partyName(pl.name)) continue;
        seen.add(k);
        // The same thing from several of them is one find, counted (3 Slings).
        for (const it of lootOf(pl.name)) {
          const had = items.find((x) => x.name === it.name);
          if (had) {
            had.qty = (had.qty ?? 1) + 1;
            had.from = `${had.from}, ${shown(pl.name)}`;
          } else items.push({ ...it, qty: 1, from: shown(pl.name) });
        }
      }
      const AMMO: Array<[RegExp, string]> = [
        [/crossbow/i, "Crossbow bolts"],
        [/bow/i, "Arrows"],
        [/sling/i, "Sling bullets"],
        [/blowgun/i, "Blowgun needles"],
      ];
      const fired = new Map<string, { who: string; item: string; fired: number }>();
      for (const seg of segments) {
        if (seg.sourceIndex < last.start || (last.end != null && seg.sourceIndex > last.end)) continue;
        if (seg.type !== "action-group" || !seg.action.actor || !partyName(seg.action.actor)) continue;
        const weapon = findActionCalls(seg.action.text)[0]?.name ?? "";
        const ammo = AMMO.find(([re]) => re.test(weapon))?.[1];
        const shots = (seg.rolls ?? []).filter((r) => /\battack\b/i.test(r.label ?? "")).length;
        if (!ammo || shots === 0) continue;
        const key = `${seg.action.actor}\u0000${ammo}`;
        const was = fired.get(key) ?? { who: seg.action.actor, item: ammo, fired: 0 };
        fired.set(key, { ...was, fired: was.fired + shots });
      }
      lootSource = { items, ammo: [...fired.values()].map((a) => ({ ...a, link: itemNote(a.item) })) };
    }
    return {
      members,
      destinations,
      holdsThings,
      ...(lootSource ? { lootSource } : {}),
      ...(hoursSinceLongRest(segments) != null ? { sinceLongRest: hoursSinceLongRest(segments) } : {}),
      clock: clockText(foldClock(segments).now),
      itemNotes,
      itemCost,
    };
  }, [
    party,
    sheetRows,
    health,
    saveModifier,
    hitDiceOf,
    partyUses,
    battles,
    segments,
    partyName,
    lootOf,
    itemNote,
    itemNotes,
    itemCost,
    destinations,
    holdsThings,
  ]);
  const sidebarItems = React.useMemo(
    () =>
      // Ammunition stowed or spent, with what it leaves carried (`18/20 left`).
      withAmmoCounts(
        // A party card and its members' entries (a short rest's hit dice), one entry.
        withPartyGroups(
          withXpAward(
            withMoveChecks(
              withRoundEconomy(
                withActorPages(
                  withTargetHealth(
                    withCheckResults(
                      // Attacks against their target's AC — a bare or missing one is the target's own.
                      withTargetAc(
                        withCombatantRolls(
                          withActorRefs(
                            buildSidebarItems(segments, dialOps, listOps, resourceDefaults(resources)),
                            resolveRef
                          ),
                          resolveCombatant
                        ),
                        (name) => defenseOf(name).ac
                      )
                    ),
                    health.hits,
                    health.at
                  ),
                  actorPage
                ),
                economies
              ),
              moveChecks
            ),
            segments,
            fightWorth
          ),
          segments,
          (actor) => !!partyName(actor)
        ),
        segments,
        ammoStart
      ),
    [
      ammoStart,
      segments,
      dialOps,
      listOps,
      resources,
      resolveRef,
      resolveCombatant,
      health,
      defenseOf,
      actorPage,
      economies,
      moveChecks,
      fightWorth,
      partyName,
    ]
  );

  const proseAnchors = React.useRef(new Map<number, HTMLElement>());
  const sidebarAnchors = React.useRef(new Map<number, HTMLElement>());
  const clickTick = React.useRef(0);
  const layoutRef = React.useRef<HTMLDivElement>(null);
  const [railHost, setRailHost] = React.useState<HTMLElement | null>(null);

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

  // Follow the reader: each narrated entry reports when it crosses a band near
  // the top of the screen, and the latest one there is the entry being read.
  React.useEffect(() => {
    if (!hasBattle) return;
    const visible = new Set<number>();
    const observer = new IntersectionObserver(
      (records) => {
        for (const r of records) {
          const id = Number((r.target as HTMLElement).dataset.lonelogAnchor);
          if (!Number.isFinite(id)) continue;
          if (r.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        if (visible.size > 0) readFromScroll(Math.max(...visible));
      },
      { rootMargin: "-25% 0px -65% 0px" }
    );
    for (const [id, el] of proseAnchors.current) {
      el.dataset.lonelogAnchor = String(id);
      observer.observe(el);
    }
    return () => observer.disconnect();
  }, [hasBattle, scenes]);

  // A request for the Log to bring an entry up under its map (the timeline).
  const [follow, setFollow] = React.useState<{ id: number; n: number } | null>(null);

  /** Go to an entry from the map's timeline: the pane moves, the prose follows
   *  — and the Log, when it's open. */
  const seekEntry = React.useCallback((id: number) => {
    // The jump stands while the prose and the Log scroll to it: what passes
    // under the reading line on the way isn't where the reader is.
    seekHold.current = Date.now() + 1000;
    setReadingId(id);
    setFollow((f) => ({ id, n: (f?.n ?? 0) + 1 }));
    // The nearest narrated entry at or before it (a purely mechanical one has
    // no prose of its own to scroll to).
    const ids = [...proseAnchors.current.keys()].filter((k) => k <= id).sort((a, b) => b - a);
    proseAnchors.current.get(ids[0])?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  // Going to an entry's passage (or a passage's entry): brought to the middle
  // of the screen where it can be, and lit for a moment so the eye finds it.
  React.useEffect(() => {
    if (!selection) return;
    const map = selection.side === "sidebar" ? sidebarAnchors.current : proseAnchors.current;
    // Gone to from the Log, inside a fight: its turn's map comes into view
    // (the passage follows it) — even for an entry with no passage of its own;
    // anywhere else, the passage to the middle.
    const turnMap = selection.side === "prose" ? turnMapAnchors.current.get(turnOf(selection.id) ?? -1) : undefined;
    const el = map.get(selection.id);
    const target = turnMap ?? el;
    if (!target) return;
    const block: ScrollLogicalPosition = turnMap ? "start" : "center";
    target.scrollIntoView({ block, behavior: "smooth" });
    // A long smooth scroll is cut short when the note draws its sections on the
    // way (the target moves): once it should have arrived, land it exactly.
    const settle = window.setTimeout(() => {
      const view = target.closest<HTMLElement>(".markdown-preview-view, .cm-scroller, .lonelog-sidebar");
      if (!view) return;
      const v = view.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      const off = block === "start" ? r.top - v.top : (r.top + r.bottom) / 2 - (v.top + v.bottom) / 2;
      if (Math.abs(off) > 48) target.scrollIntoView({ block });
    }, 700);
    if (!el) return () => window.clearTimeout(settle);
    el.classList.remove("is-flash");
    void el.offsetWidth; // restart the highlight when it's asked for again
    el.classList.add("is-flash");
    const timer = window.setTimeout(() => el.classList.remove("is-flash"), 2600);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(settle);
      el.classList.remove("is-flash");
    };
  }, [selection]);

  // ── The map in the text: one before each turn of a fight bound to a map ──
  // Each tells its turn — from its marker to the next (the first from the
  // fight's opening, so its Setup is there) — and follows the reading into it.
  const turnsOf = React.useMemo(() => {
    const out = new Map<number, number[]>();
    for (const b of battles) {
      out.set(
        b.start,
        segments
          .filter((s) => s.type === "round" && s.sourceIndex > b.start && (b.end == null || s.sourceIndex < b.end))
          .map((s) => s.sourceIndex)
      );
    }
    return out;
  }, [battles, segments]);
  const battleAt = React.useCallback(
    (id: number) => battles.find((b) => id >= b.start && (b.end == null || id <= b.end)),
    [battles]
  );
  const turnMapAnchors = React.useRef(new Map<number, HTMLElement>());
  /** The turn an entry falls in — its map's key (the first turn before any). */
  const turnOf = React.useCallback(
    (id: number): number | undefined => {
      const b = battleAt(id);
      const turns = b ? (turnsOf.get(b.start) ?? []) : [];
      if (turns.length === 0) return undefined;
      return [...turns].reverse().find((t) => t <= id) ?? turns[0];
    },
    [battleAt, turnsOf]
  );
  const renderTurnMap = (turnId: number, headInto?: HTMLElement | null) => {
    const b = battleAt(turnId);
    if (!b) return null;
    const turns = turnsOf.get(b.start) ?? [];
    const i = turns.indexOf(turnId);
    const from = i <= 0 ? b.start : turnId;
    const next = turns[i + 1];
    const to = next ?? (b.end != null ? b.end + 1 : undefined);
    return (
      <div
        className="lonelog-turn-map"
        ref={(el) => {
          if (el) turnMapAnchors.current.set(turnId, el);
          else turnMapAnchors.current.delete(turnId);
        }}
      >
        <BattlePane
          battles={battles}
          battleStart={b.start}
          within={{ from, ...(to != null ? { to } : {}) }}
          {...(headInto !== undefined ? { headInto } : {})}
          {...(i <= 0 ? { onSetup: onEditBody, initiativeOf } : {})}
          maps={battleMaps}
          readingId={readingId}
          onSeek={seekEntry}
          foesAt={foesAt}
          iconOf={tokenIcon}
          healthAt={health.at}
          hitAt={(id: number) => health.hits.get(id)}
          zoom
        />
      </div>
    );
  };
  /** An action clicked in the text: its turn's map goes to it. */
  const goToStep = (id: number) => {
    seekHold.current = Date.now() + 1000;
    setReadingId(id);
  };

  const handleDotClick = (id: number) => {
    setSidebarOpen(true);
    clickTick.current += 1;
    setSelection({ id, side: "sidebar", n: clickTick.current });
  };
  const handleSidebarClick = (id: number) => {
    clickTick.current += 1;
    setSelection({ id, side: "prose", n: clickTick.current });
    // In a fight, the map goes to it too — and stays, while the prose scrolls there.
    seekHold.current = Date.now() + 1500;
    setReadingId(id);
  };

  // A party card's use is counted from the line it writes (`[Talon/Mystic Mark-1]`).
  const handleSpend = (cardId: string) => {
    if (cardId in partyUses) return;
    setGmSpent((s) => ({ ...s, [cardId]: (s[cardId] ?? 0) + 1 }));
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
    const out: Array<{ line: string; from: string; to: string }> = pendingTermSwaps(sidebarItems, dieEdits);
    for (const r of editResults) {
      const key = resultEditKey(r.source);
      if (!(key in dieEdits)) continue;
      const next = dieEdits[key];
      if (next === r.original) continue;
      const swap = resultReplacement(r.source, next);
      if (swap) out.push({ line: r.source, ...swap });
    }
    return out;
  }, [sidebarItems, editResults, dieEdits]);

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

  // Discard every pending edit, restoring the values last written to the note.
  const handleUndo = () => {
    setSceneEdits({});
    setDieEdits({});
    setTokenEdits([]);
  };

  const hasActions = pcStacks.size > 0 || foeStacks.size > 0 || gmStacks.length > 0;
  const selectedId = selection?.id ?? null;

  return (
    <div className="session-log-container">
      {/* The prose and the drawer under it: the drawer follows the text column, and stays in view along it. */}
      <div
        className={`lonelog-dock-zone ${sidebarOpen ? "with-sidebar" : ""} ${stacked ? "is-stacked" : ""}`}
        style={sidebarPx != null ? ({ "--log-sidebar-width": `${sidebarPx}px` } as React.CSSProperties) : undefined}
      >
        <div
          ref={layoutRef}
          className={`lonelog-prose-layout ${sidebarOpen ? "with-sidebar" : ""} ${stacked ? "is-stacked" : ""}`}
          style={sidebarPx != null ? ({ "--log-sidebar-width": `${sidebarPx}px` } as React.CSSProperties) : undefined}
        >
          <div className={`lonelog-prose-main${hasBattle ? " has-battle" : ""}`}>
            {/* The roster's rail: the page's left margin beside the prose, as the Log
              is on the right. It sticks as the page scrolls; the drawer's roster is
              drawn into it (and above the cards, when the margin is too narrow). It's
              there while the Log is open; closed, the roster stays in the drawer. */}
            {hasActions && sidebarOpen && (
              <div className="lonelog-roster-rail" aria-label="Characters">
                <div className="lonelog-roster-sticky" ref={setRailHost} />
              </div>
            )}
            {sidebarItems.length > 0 && (
              // A rail of no height that sticks to the top of the page as it scrolls:
              // the controls ride in it, so they're always in reach. (Open, the Log
              // closes from its own header, which sticks with it.)
              <div className="lonelog-log-rail">
                <div className="lonelog-log-controls">
                  {isDirty && (
                    <button
                      type="button"
                      className="lonelog-log-undo"
                      aria-label="Undo unsaved log edits"
                      title="Undo unsaved edits"
                      onClick={handleUndo}
                    >
                      Undo
                    </button>
                  )}
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
                  {!sidebarOpen && (
                    <button
                      type="button"
                      className="lonelog-log-toggle"
                      aria-pressed={false}
                      aria-label="Open log"
                      onClick={() => setSidebarOpen(true)}
                    >
                      Log
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="lonelog-prose-body">
              <ProseView
                scenes={scenes}
                sourcePath={sourcePath}
                selectedId={selectedId}
                onSelectSource={handleDotClick}
                registerAnchor={registerProse}
                {...(hasBattle ? { renderTurnMap, onSelectStep: goToStep } : {})}
                partyName={partyName}
              />
            </div>
          </div>
          {sidebarOpen && (
            <LogSidebar
              items={sidebarItems}
              onClose={() => setSidebarOpen(false)}
              onReading={readFromScroll}
              follow={follow}
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
                pcStacks={pcStacksNow}
                foeStacks={foeStacksNow}
                gmStacks={gmStacks}
                consumableState={consumableState}
                entities={entityNames}
                onAppendText={onAppendText}
                onSpend={handleSpend}
                sourcePath={sourcePath}
                resolveRef={resolveRef}
                vars={currentVars}
                rosterHost={sidebarOpen ? railHost : null}
                lookupCreature={lookupCreature}
                mapTools={mapTools}
                {...(combatNow ? { combat: combatNow } : {})}
                defense={{ ac: (name: string) => defenseOf(name).ac, health: (name: string) => health.now(name) }}
                fight={fight}
                slotsUsed={spentNow}
                resourcesFor={resourcesFor}
                iconFor={iconFor}
                loadoutsFor={loadoutsFor}
                onEquip={onEquip}
                heldLoadoutOf={heldLoadoutOf}
                hudOf={hudOf}
                onOpenSheet={openSheet}
                onMakePortrait={makePortrait}
                onToggle={flipToggle}
                onMakeIcon={makeIcon}
                onMakeNamedIcon={makeNamedIcon}
                rollConditions={rollConditions}
                isDown={isDownNow}
                isDying={(name: string) => health.now(name)?.life?.state === "dying"}
                party={partyNow}
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

      {/* The session's bookkeeping comes last, after the drawer of cards: what
          it changed on the party's sheets — hit points, uses, slots, items. */}
      <SessionBookkeeping
        rows={sheetRows}
        inventory={itemChanges}
        sourcePath={sourcePath}
        sheetHas={sheetHas}
        pageOf={actorPage}
        onApply={onApplySheet}
        onApplyAll={onApplyAllSheets}
        onRecount={onRecount}
        doneIds={sheetDone}
        onSeen={onSheetDone}
        onSelectSource={handleDotClick}
      />
    </div>
  );
}

/**
 * A frontmatter link field as a list of `[[…]]` strings. YAML reads an unquoted
 * `[[Talon]]` as a nested array, so those are unwrapped back into a link.
 */
function linkList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : value != null ? [value] : [];
  return items.flatMap((v) => {
    let x: unknown = v;
    while (Array.isArray(x)) x = x[0];
    if (typeof x !== "string" || !x.trim()) return [];
    const t = x.trim();
    return [t.startsWith("[[") ? t : `[[${t}]]`];
  });
}

/** Compare links by their target note, ignoring brackets and aliases. */
function linkKey(ref: string): string {
  return ref.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim().toLowerCase();
}

/** The name a foe acts under: its tag's text with links read as their text
 *  (`Fat [[Kobold, A]]` → `Fat Kobold, A`). */
function foeName(name: string): string {
  return name.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string, a?: string) => a ?? t).trim();
}

/** `1` → `1st-circle`. */
function ordinalCircle(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}-circle`;
}
