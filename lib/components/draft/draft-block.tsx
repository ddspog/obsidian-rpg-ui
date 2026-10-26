/**
 * The `rpg draft` block (lib/domains/draft/draft.ts): a GM gathers ideas for
 * the adventure and copies them as one prompt for an LLM.
 *
 * It reads as a log block does: the ideas are a lonelog, told as prose with
 * the Log beside it — every roll there editable, rerolled with a click, a GM
 * step picked from its dropdown — and the GM Screen's cards in the drawer at
 * the foot, played into the ideas. The Code view shows the ideas as text.
 *
 * Above them, what the prompt is made of:
 * - **GM Screen:** whose cards the drawer holds (oracles, generators, meaning tables).
 * - **Tables:** any note's `rpg table.*` blocks, rolled once each click.
 * - **Map:** a hex map at one of its levels; clicking hexes picks them, and
 *   the prompt describes each (terrain, regions, places, marks).
 * - **Attached notes:** statblocks, items, places: the prompt summarises them.
 * - **Ask:** what the prompt asks for (encounter, statblock, NPC…).
 *
 * Everything is kept in the block's own text: the head, and the ideas below
 * `---`. A change is written when it's made (the Log's edits on Save, the code
 * when its box loses focus), by finding the block by its exact text.
 */

import { type App, Notice, TFile } from "obsidian";
import * as React from "react";
import { drawHexMap } from "lib/components/hexmap/draw-hex-map";
import { HexMapView } from "lib/components/hexmap/hex-map-view";
import { pickNote } from "lib/components/hexmap/note-picker";
import { BottomDrawer } from "lib/components/session-log/bottom-drawer";
import { LogSidebar, type SceneEditValue } from "lib/components/session-log/log-sidebar";
import { LucideIcon } from "lib/components/session-log/lucide-icon";
import { ProseView } from "lib/components/session-log/prose-view";
import { SessionActionsPanel } from "lib/components/session-log/session-actions-panel";
import { useSidebarRoom } from "lib/components/session-log/use-sidebar-room";
import {
  buildPrompt,
  DRAFT_ASKS,
  type DraftAsk,
  type DraftBlock as Draft,
  formatDraftBlock,
  type HexFact,
  parseDraftBlock,
  summarizeNote,
  tableLine,
} from "lib/domains/draft/draft";
import { parseSourceDoc } from "lib/domains/features/parse-source-doc";
import type { GMFeature } from "lib/domains/features/types";
import { type GMStepContext, gmStepLines, resolveGmBody } from "lib/domains/gm/example";
import { hexCenter, hexKey, hexPoints } from "lib/domains/hexmap/axial";
import { replaceRpgBody } from "lib/domains/hexmap/fence-text";
import { loadImports } from "lib/domains/hexmap/imports";
import type { HexLayout } from "lib/domains/hexmap/layout";
import { importsAtLevel, levelScale, levelView, MAX_LEVEL } from "lib/domains/hexmap/levels";
import { parseHexMap } from "lib/domains/hexmap/parse-hex-map";
import { resolveDialOps, resourceDefaults } from "lib/domains/lonelog/dial-ops";
import { resolveListOps } from "lib/domains/lonelog/list-ops";
import { parseLonelog } from "lib/domains/lonelog/parser";
import type { CardStack } from "lib/domains/session-log/card-types";
import { applyChoicePick } from "lib/domains/session-log/choice";
import { pendingTermSwaps } from "lib/domains/session-log/die-edits";
import { parseFormula, resultReplacement } from "lib/domains/session-log/formula";
import { buildGMStacksFromFeatures } from "lib/domains/session-log/gm-cards";
import {
  applySceneEdits,
  applyTokenEdits,
  assembleProse,
  buildSidebarItems,
  reconstructScene,
  resultEditKey,
  dieEditKey,
} from "lib/domains/session-log/prose-model";
import { groupIntoProse } from "lib/domains/session-log/prose-grouper";
import { rollOnce, formatRollOutcome } from "lib/domains/tables/roll";
import type { TableDef } from "lib/domains/tables/types";
import { GMLoader, type NoteRef } from "lib/services/gm-loader";
import { hexAtlas } from "lib/services/hex-atlas";

interface Props {
  source: string;
  app: App;
  sourcePath: string;
}

interface VaultNote extends NoteRef {
  file: TFile;
}

type DraftView = "prose" | "code";

/** What a block shows open, kept across the re-render a write causes. */
interface Kept {
  map: boolean;
  tables: Array<{ note: string; tables: TableDef[] }>;
  view: DraftView;
  log: boolean;
  prompt: boolean;
}
const panels = new Map<string, Kept>();
const VIEW_KEY = "rpg-ui:draft-view";
const lastView = (): DraftView => {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "code" ? "code" : "prose";
  } catch {
    return "prose";
  }
};

/** `[[Note|Alias]]` → `Note`. */
const linkTarget = (ref: string) =>
  ref
    .replace(/^!?\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|")[0]
    .split("#")[0]
    .trim();
const noteName = (ref: string) => linkTarget(ref).split("/").pop() ?? ref;

// The log's edit helpers work on an `rpg log` fence: the ideas are wrapped in one and back.
const LOG_OPEN = "```rpg log\n";
const LOG_CLOSE = "\n```";
const asLog = (body: string) => `${LOG_OPEN}${body}${LOG_CLOSE}`;
const fromLog = (text: string) => text.slice(LOG_OPEN.length, text.length - LOG_CLOSE.length);

/** Lines added at the end of the ideas. */
const appended = (body: string, text: string) =>
  [body.replace(/\s+$/, ""), text.replace(/^\n+/, "").replace(/\s+$/, "")].filter(Boolean).join("\n");

const NO_STACKS = new Map<string, CardStack[]>();
const FIGHT_CARDS = new Set(["start-combat", "next-turn", "next-round", "end-combat"]);

export function DraftBlock({ source, app, sourcePath }: Props) {
  const [draft, setDraft] = React.useState<Draft>(() => parseDraftBlock(source));
  const written = React.useRef(source);
  const key = `${sourcePath}\n${draft.title ?? ""}`;
  const kept: Kept = panels.get(key) ?? { map: false, tables: [], view: lastView(), log: true, prompt: false };
  const [ui, setUi] = React.useState(kept);
  const setKept = (patch: Partial<Kept>) =>
    setUi((prev) => {
      const next = { ...prev, ...patch };
      panels.set(key, next);
      return next;
    });
  const setView = (view: DraftView) => {
    try {
      window.localStorage.setItem(VIEW_KEY, view);
    } catch {
      // Nowhere to keep it: prose next time.
    }
    setKept({ view });
  };
  const [ideas, setIdeas] = React.useState(draft.body);

  const resolve = React.useCallback(
    (ref: string): TFile | null => {
      const f = app.metadataCache.getFirstLinkpathDest(linkTarget(ref), sourcePath);
      return f instanceof TFile ? f : null;
    },
    [app, sourcePath]
  );
  const linkTo = (f: TFile) => `[[${app.metadataCache.fileToLinktext(f, sourcePath, true)}]]`;

  /** The block written with a change; the text Obsidian has is swapped by its exact old text. */
  const save = React.useCallback(
    async (next: Draft) => {
      setDraft(next);
      const text = formatDraftBlock(next);
      const file = app.vault.getAbstractFileByPath(sourcePath);
      if (!(file instanceof TFile)) return;
      let found = false;
      await app.vault.process(file, (note) => {
        const out = replaceRpgBody(note, "draft", written.current, text);
        found = out !== null;
        if (found) written.current = text;
        return out ?? note;
      });
      if (!found) new Notice("Draft: couldn't find this block in its note (changed elsewhere?), so it wasn't saved.");
    },
    [app, sourcePath]
  );
  const draftRef = React.useRef(draft);
  draftRef.current = draft;

  // ---- the GM Screen's cards ----
  const [gm, setGm] = React.useState<{ features: GMFeature[]; ctx?: GMStepContext; stacks: CardStack[] } | null>(null);
  React.useEffect(() => {
    if (!draft.gm) {
      setGm(null);
      return;
    }
    let alive = true;
    const loader = new GMLoader<VaultNote>({
      resolve: (ref) => {
        const file = resolve(ref);
        return file ? { name: file.basename, file } : null;
      },
      read: (n) => app.vault.read(n.file),
      frontmatter: (n) => app.metadataCache.getFileCache(n.file)?.frontmatter as Record<string, unknown> | undefined,
    });
    void (async () => {
      const features = await loader.loadGMScreen(draft.gm!);
      const ctx = await loader.loadStepCtx(features);
      // A draft is no fight: its drawer holds the story cards only.
      const stacks = buildGMStacksFromFeatures(features)
        .map((st) => ({ ...st, cards: st.cards.filter((c) => !c.kind || !FIGHT_CARDS.has(c.kind)) }))
        .filter((st) => st.cards.length > 0);
      if (alive) setGm({ features, ctx, stacks });
    })();
    return () => {
      alive = false;
    };
  }, [draft.gm, app, resolve]);
  /** GM lines filled in from their dice: a rolled branch gets its label, a step line follows. */
  const resolveBody = (body: string) => (gm ? resolveGmBody(body, gm.features, gm.ctx) : body);
  /** New ideas, written. */
  const writeBody = (body: string) => {
    setIdeas(body);
    void save({ ...draftRef.current, body });
  };
  const addLines = (text: string) => writeBody(resolveBody(appended(ideas, text)));
  const [gmSpent, setGmSpent] = React.useState<Record<string, number>>({});
  const consumableState = React.useMemo(() => ({ spent: gmSpent, initialSpent: {} }), [gmSpent]);

  // ---- the ideas as a log ----
  const resources = React.useMemo(() => gm?.ctx?.resources ?? {}, [gm]);
  const lists = React.useMemo(() => gm?.ctx?.lists ?? {}, [gm]);
  const entries = React.useMemo(() => parseLonelog(ideas), [ideas]);
  const segments = React.useMemo(() => groupIntoProse(entries), [entries]);
  const scenes = React.useMemo(() => assembleProse(segments), [segments]);
  const dialOps = React.useMemo(() => resolveDialOps(entries, resources), [entries, resources]);
  const listOps = React.useMemo(() => resolveListOps(entries, lists), [entries, lists]);
  const currentVars = React.useMemo(() => {
    const now: Record<string, number> = { ...resourceDefaults(resources) };
    for (const ops of dialOps.values()) for (const op of ops) now[op.key] = op.current;
    return now;
  }, [dialOps, resources]);
  const sidebarItems = React.useMemo(
    () => buildSidebarItems(segments, dialOps, listOps, resourceDefaults(resources)),
    [segments, dialOps, listOps, resources]
  );

  // The Log's pending edits, as the log block keeps them: written together on Save.
  const [sceneEdits, setSceneEdits] = React.useState<Record<string, SceneEditValue>>({});
  const [dieEdits, setDieEdits] = React.useState<Record<string, string>>({});
  const [tokenEdits, setTokenEdits] = React.useState<Array<{ line: string; from: string; to: string; nth: number }>>(
    []
  );
  const sceneOriginals = React.useMemo(() => {
    const out: Record<string, { number: string; name: string; hadS: boolean }> = {};
    for (const item of sidebarItems)
      for (const row of item.rows)
        if (row.scene)
          out[row.scene.original] = { number: row.scene.number, name: row.scene.name, hadS: row.scene.hadS };
    return out;
  }, [sidebarItems]);
  const pendingScenes = React.useMemo(
    () =>
      Object.entries(sceneEdits).filter(([original, v]) => {
        const o = sceneOriginals[original];
        return o && (v.number !== o.number || v.name !== o.name);
      }),
    [sceneEdits, sceneOriginals]
  );
  const dieReplacements = React.useMemo(() => {
    const out: Array<{ line: string; from: string; to: string }> = pendingTermSwaps(sidebarItems, dieEdits);
    for (const item of sidebarItems)
      for (const row of item.rows) {
        if (!row.detail || !row.source) continue;
        const original = parseFormula(row.content)?.result;
        const k = resultEditKey(row.source);
        if (original == null || !(k in dieEdits) || dieEdits[k] === original) continue;
        const swap = resultReplacement(row.source, dieEdits[k]);
        if (swap) out.push({ line: row.source, ...swap });
      }
    return out;
  }, [sidebarItems, dieEdits]);
  const isDirty = pendingScenes.length > 0 || dieReplacements.length > 0 || tokenEdits.length > 0;
  const undoEdits = () => {
    setSceneEdits({});
    setDieEdits({});
    setTokenEdits([]);
  };
  const saveEdits = () => {
    const scenesTo = pendingScenes.map(([original, v]) => ({
      from: original,
      to: reconstructScene(v.number, v.name, sceneOriginals[original].hadS),
    }));
    const text = applyTokenEdits(applySceneEdits(asLog(ideas), scenesTo), [...dieReplacements, ...tokenEdits]);
    undoEdits();
    const body = resolveBody(fromLog(text));
    if (body !== ideas) writeBody(body);
  };
  const pickChoice = (selected: string) => {
    if (!gm) return;
    const stepLines = Object.assign({}, ...gm.features.map((f) => gmStepLines(f, gm.ctx)));
    writeBody(resolveBody(applyChoicePick(ideas, selected, stepLines)));
  };

  // A provenance dot in the prose and its entry in the Log, each brought to the other.
  const proseAnchors = React.useRef(new Map<number, HTMLElement>());
  const logAnchors = React.useRef(new Map<number, HTMLElement>());
  const anchorIn = (m: React.MutableRefObject<Map<number, HTMLElement>>) => (id: number, el: HTMLElement | null) => {
    if (el) m.current.set(id, el);
    else m.current.delete(id);
  };
  const registerProse = React.useMemo(() => anchorIn(proseAnchors), []);
  const registerLog = React.useMemo(() => anchorIn(logAnchors), []);
  const [selection, setSelection] = React.useState<{ id: number; side: "prose" | "log"; n: number } | null>(null);
  React.useEffect(() => {
    if (!selection) return;
    const el = (selection.side === "log" ? logAnchors : proseAnchors).current.get(selection.id);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selection]);
  const select = (id: number, side: "prose" | "log") => setSelection((s) => ({ id, side, n: (s?.n ?? 0) + 1 }));

  const layoutRef = React.useRef<HTMLDivElement>(null);
  const { sidebarPx, stacked } = useSidebarRoom(layoutRef);
  const logOpen = ui.log && ui.view === "prose";
  const widthVar = sidebarPx != null ? ({ "--log-sidebar-width": `${sidebarPx}px` } as React.CSSProperties) : undefined;

  // ---- tables ----
  const addTables = (f: TFile) =>
    void app.vault.read(f).then((text) => {
      const found = parseSourceDoc({ $name: f.basename, $contents: text }, "class").tables ?? [];
      if (found.length === 0) {
        new Notice(`Draft: ${f.basename} has no rpg table blocks.`);
        return;
      }
      setKept({ tables: [...ui.tables.filter((t) => t.note !== f.basename), { note: f.basename, tables: found }] });
    });
  const rollTable = (note: string, t: TableDef) => {
    const outcome = rollOnce(t, [], undefined);
    addLines(
      tableLine(
        `${note}${t.name ? ` ${t.name}` : ""}`,
        formatRollOutcome(outcome),
        "rolled" in outcome ? outcome.rolled : undefined
      )
    );
  };

  // ---- the map ----
  const [map, setMap] = React.useState<{ layout: HexLayout; name: string; scale?: string; source: string } | null>(
    null
  );
  React.useEffect(() => {
    if (!draft.map || !ui.map) return;
    let alive = true;
    void (async () => {
      const found = await hexAtlas.mapIn(linkTarget(draft.map!), sourcePath);
      if (!found || !alive) return;
      const top = parseHexMap(found.body);
      const { imports } = await loadImports(top, found.path, (l, from) => hexAtlas.mapIn(l, from));
      const view = levelView(found.body, draft.level);
      const drawn = await drawHexMap(view, importsAtLevel(imports, draft.level));
      if (alive)
        setMap({
          layout: drawn.layout,
          name: noteName(draft.map!),
          scale: levelScale(top.scale, draft.level),
          source: view,
        });
    })();
    return () => {
      alive = false;
    };
  }, [draft.map, draft.level, ui.map, sourcePath]);
  const picked = React.useMemo(() => new Set(draft.hexes.map(([q, r]) => hexKey(q, r))), [draft.hexes]);
  const toggleHex = (q: number, r: number) => {
    const k = hexKey(q, r);
    const hexes = picked.has(k)
      ? draft.hexes.filter(([a, b]) => hexKey(a, b) !== k)
      : [...draft.hexes, [q, r] as [number, number]];
    void save({ ...draftRef.current, hexes });
  };

  /** What the prompt says of each picked hex, from the map as drawn (imports and all). */
  const hexFacts = async (): Promise<{ facts: HexFact[]; name?: string; scale?: string }> => {
    if (!draft.map || draft.hexes.length === 0) return { facts: [] };
    let layout = map?.layout;
    let source = map?.source;
    let scale = map?.scale;
    if (!layout) {
      const found = await hexAtlas.mapIn(linkTarget(draft.map), sourcePath);
      if (!found) return { facts: [] };
      const top = parseHexMap(found.body);
      const { imports } = await loadImports(top, found.path, (l, from) => hexAtlas.mapIn(l, from));
      source = levelView(found.body, draft.level);
      layout = (await drawHexMap(source, importsAtLevel(imports, draft.level))).layout;
      scale = levelScale(top.scale, draft.level);
    }
    const parsed = source ? parseHexMap(source) : null;
    const facts = draft.hexes.map(([q, r]): HexFact => {
      const info = layout!.hexes.get(hexKey(q, r));
      const terrain = [...(info?.specs ?? [])].reverse().find((s) => s.layer === "terrain" && s.spec)?.spec;
      const marks = [
        ...(parsed?.markers ?? [])
          .filter((m) => Math.round(m.q) === q && Math.round(m.r) === r)
          .map((m) => [m.text, m.spec, m.link && `[[${m.link}]]`].filter(Boolean).join(" ")),
        ...(parsed?.labels ?? [])
          .filter((l) => Math.round(l.q) === q && Math.round(l.r) === r)
          .map((l) => `label "${l.text ?? l.link}"`),
        ...(parsed?.cells ?? [])
          .filter((c) => c.q === q && c.r === r && c.layer === "stack" && c.spec)
          .map((c) => c.spec!.replace(/^.*\[(.+)\]$/, "$1")),
      ];
      return {
        q,
        r,
        ...(terrain ? { terrain } : {}),
        ...(info?.label ? { label: info.label } : {}),
        ...(info?.link ? { link: info.link } : {}),
        regions: [...(info?.regions ?? []), ...(info?.faintRegions ?? [])],
        marks,
      };
    });
    return { facts, name: noteName(draft.map), scale };
  };

  // ---- the prompt ----
  const [preview, setPreview] = React.useState<string | null>(null);
  const makePrompt = async (): Promise<string> => {
    const current = { ...draftRef.current, body: ideas };
    const attachments: Array<{ name: string; summary: string }> = [];
    for (const ref of current.attach) {
      const f = resolve(ref);
      if (!f) {
        attachments.push({ name: noteName(ref), summary: `### ${noteName(ref)}\n(no such note yet)` });
        continue;
      }
      attachments.push({ name: f.basename, summary: summarizeNote(f.basename, await app.vault.read(f)) });
    }
    const { facts, name, scale } = await hexFacts();
    const note = sourcePath.split("/").pop()?.replace(/\.md$/, "") ?? sourcePath;
    return buildPrompt(current, {
      note,
      ...(name ? { map: { name, scale } } : {}),
      hexes: facts,
      attachments,
    });
  };
  React.useEffect(() => {
    if (ui.prompt) void makePrompt().then(setPreview);
    // Remade as what it's made of changes.
  }, [ui.prompt, ideas, draft]);
  const copyPrompt = async () => {
    const prompt = await makePrompt();
    if (ui.prompt) setPreview(prompt);
    try {
      await navigator.clipboard.writeText(prompt);
      new Notice(`Draft: the prompt is on the clipboard (${prompt.length} characters).`);
    } catch {
      new Notice("Draft: couldn't reach the clipboard.");
    }
  };

  const R = map?.layout.R ?? 40;
  const cards = gm?.stacks.reduce((n, s) => n + s.cards.length, 0) ?? 0;
  return (
    <section className={`rpg-draft session-log-container${logOpen && !stacked ? " is-wide" : ""}`} style={widthVar}>
      <header className="rpg-draft-head">
        <hgroup className="rpg-draft-heading">
          <p className="rpg-draft-kicker">Draft</p>
          <input
            className="rpg-draft-title"
            type="text"
            defaultValue={draft.title ?? ""}
            placeholder="What is this draft for?"
            aria-label="Title"
            onBlur={(e) =>
              e.target.value !== (draft.title ?? "") && void save({ ...draftRef.current, title: e.target.value })
            }
          />
        </hgroup>
        <menu className="rpg-draft-actions">
          <li>
            <label className="rpg-draft-ask">
              <span>Ask for</span>
              <select
                className="dropdown"
                value={draft.ask ?? "free"}
                onChange={(e) => void save({ ...draftRef.current, ask: e.target.value as DraftAsk })}
              >
                {DRAFT_ASKS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </li>
          <li>
            <button
              type="button"
              className="rpg-draft-quiet"
              onClick={() => setKept({ prompt: !ui.prompt })}
              aria-pressed={ui.prompt}
            >
              <LucideIcon name="eye" size={14} />
              <span>Prompt</span>
            </button>
          </li>
          <li>
            <button type="button" className="rpg-draft-copy mod-cta" onClick={() => void copyPrompt()}>
              <LucideIcon name="clipboard-copy" size={14} />
              <span>Copy prompt</span>
            </button>
          </li>
        </menu>
      </header>

      <dl className="rpg-draft-sources" aria-label="What the prompt is made of">
        <div className="rpg-draft-source">
          <dt>GM Screen</dt>
          <dd>
            <button
              type="button"
              className="rpg-draft-link"
              onClick={() =>
                pickNote(app, "The GM Screen…", sourcePath, (f) => void save({ ...draftRef.current, gm: linkTo(f) }))
              }
            >
              {draft.gm ? noteName(draft.gm) : "Choose a screen"}
            </button>
          </dd>
          {gm && <dd className="rpg-draft-note">{cards ? `${cards} cards in the drawer` : "No GM cards on it"}</dd>}
        </div>

        <div className="rpg-draft-source">
          <dt>Tables</dt>
          {ui.tables.map((g) => (
            <dd key={g.note} className="rpg-draft-rolls">
              <span className="rpg-draft-bucket">{g.note}</span>
              {g.tables.map((t, i) => (
                <button key={i} type="button" className="rpg-draft-roll" onClick={() => rollTable(g.note, t)}>
                  <LucideIcon name="dices" size={12} />
                  {t.name || "Roll"}
                </button>
              ))}
              <button
                type="button"
                aria-label={`Remove ${g.note}`}
                className="rpg-draft-x"
                onClick={() => setKept({ tables: ui.tables.filter((x) => x.note !== g.note) })}
              >
                <LucideIcon name="x" size={12} />
              </button>
            </dd>
          ))}
          <dd>
            <button
              type="button"
              className="rpg-draft-add"
              onClick={() => pickNote(app, "A note with rpg tables…", sourcePath, addTables)}
            >
              <LucideIcon name="plus" size={12} />
              Table note
            </button>
          </dd>
        </div>

        <div className="rpg-draft-source">
          <dt>Attached</dt>
          {draft.attach.length > 0 && (
            <dd>
              <ul className="rpg-draft-chips">
                {draft.attach.map((a) => (
                  <li key={a}>
                    <span>{noteName(a)}</span>
                    <button
                      type="button"
                      className="rpg-draft-x"
                      aria-label={`Remove ${noteName(a)}`}
                      onClick={() =>
                        void save({ ...draftRef.current, attach: draftRef.current.attach.filter((x) => x !== a) })
                      }
                    >
                      <LucideIcon name="x" size={11} />
                    </button>
                  </li>
                ))}
              </ul>
            </dd>
          )}
          <dd>
            <button
              type="button"
              className="rpg-draft-add"
              onClick={() =>
                pickNote(app, "A note to attach (a statblock, an item, a place)…", sourcePath, (f) => {
                  const ref = linkTo(f);
                  if (!draftRef.current.attach.includes(ref))
                    void save({ ...draftRef.current, attach: [...draftRef.current.attach, ref] });
                })
              }
            >
              <LucideIcon name="plus" size={12} />
              Note
            </button>
          </dd>
        </div>

        <div className="rpg-draft-source">
          <dt>Map</dt>
          <dd className="rpg-draft-rolls">
            <button
              type="button"
              className="rpg-draft-link"
              onClick={() =>
                pickNote(app, "A note with a hex map…", sourcePath, (f) => {
                  void save({ ...draftRef.current, map: linkTo(f), hexes: [] });
                  setKept({ map: true });
                })
              }
            >
              {draft.map ? noteName(draft.map) : "Choose a map"}
            </button>
            {draft.map && (
              <select
                className="rpg-draft-level"
                aria-label="Level"
                value={draft.level}
                onChange={(e) => void save({ ...draftRef.current, level: Number(e.target.value), hexes: [] })}
              >
                {Array.from({ length: MAX_LEVEL + 1 }, (_, d) => (
                  <option key={d} value={d}>
                    {d === 0 ? "main" : `level ${d}`}
                  </option>
                ))}
              </select>
            )}
          </dd>
          {draft.map && (
            <dd>
              <button
                type="button"
                className="rpg-draft-add"
                aria-pressed={ui.map}
                onClick={() => setKept({ map: !ui.map })}
              >
                <LucideIcon name="hexagon" size={12} />
                {ui.map ? "Hide map" : "Pick hexes"}
                {draft.hexes.length > 0 && <span className="rpg-draft-count">{draft.hexes.length}</span>}
              </button>
            </dd>
          )}
        </div>
      </dl>

      {draft.map && ui.map && (
        <div className="rpg-draft-map">
          {!map && <p className="rpg-draft-note">Drawing the map…</p>}
          {map && (
            <HexMapView
              layout={map.layout}
              title={map.name}
              scale={map.scale}
              coords="hover"
              errors={[]}
              maxHeight={55}
              play={{
                claims: () => true,
                onPointer: (p) => p.phase === "down" && toggleHex(p.hex.q, p.hex.r),
              }}
              overlay={
                <g className="rpg-draft-picked">
                  {draft.hexes.map(([q, r]) => {
                    const info = map.layout.hexes.get(hexKey(q, r));
                    const c = info ? { x: info.cx, y: info.cy } : hexCenter(q, r, R);
                    return <polygon key={hexKey(q, r)} points={hexPoints(c.x, c.y, R * 0.92)} strokeWidth={R / 10} />;
                  })}
                </g>
              }
            />
          )}
          <p className="rpg-draft-note">Click hexes to pick them for the prompt (again to drop them).</p>
        </div>
      )}

      {ui.prompt && (
        <pre className="rpg-draft-preview" aria-label="The prompt">
          {preview ?? "Making the prompt…"}
        </pre>
      )}

      <div className="rpg-draft-bar">
        <span className="rpg-draft-bar-label">Ideas and rolls</span>
        <div className="rpg-draft-views" role="radiogroup" aria-label="View">
          {(["prose", "code"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={ui.view === v}
              onClick={() => {
                if (ui.view === "code" && ideas !== draftRef.current.body) writeBody(ideas);
                setView(v);
              }}
            >
              <LucideIcon name={v === "prose" ? "book-open" : "code"} size={13} />
              {v === "prose" ? "Prose" : "Code"}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`lonelog-dock-zone ${logOpen ? "with-sidebar" : ""} ${stacked ? "is-stacked" : ""}`}
        style={widthVar}
      >
        <div
          ref={layoutRef}
          className={`lonelog-prose-layout ${logOpen ? "with-sidebar" : ""} ${stacked ? "is-stacked" : ""}`}
          style={widthVar}
        >
          <div className="lonelog-prose-main">
            {ui.view === "prose" && (
              <div className="lonelog-log-rail">
                <div className="lonelog-log-controls">
                  {isDirty && (
                    <button
                      type="button"
                      className="lonelog-log-undo"
                      aria-label="Undo unsaved log edits"
                      title="Undo unsaved edits"
                      onClick={undoEdits}
                    >
                      Undo
                    </button>
                  )}
                  {isDirty && (
                    <button type="button" className="lonelog-log-save" aria-label="Save log edits" onClick={saveEdits}>
                      Save
                    </button>
                  )}
                  {!logOpen && (
                    <button
                      type="button"
                      className="lonelog-log-toggle"
                      aria-pressed={false}
                      aria-label="Open log"
                      onClick={() => setKept({ log: true })}
                    >
                      Log
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="lonelog-prose-body">
              {ui.view === "code" ? (
                <textarea
                  className="rpg-draft-code"
                  value={ideas}
                  rows={Math.max(10, Math.min(40, ideas.split("\n").length + 2))}
                  placeholder={"Lonelog lines and plain ideas, one per line:\n? Is the cult here?\n-> Yes, but…"}
                  spellCheck={false}
                  aria-label="The ideas as text"
                  onChange={(e) => setIdeas(e.target.value)}
                  onBlur={() => ideas !== draftRef.current.body && writeBody(ideas)}
                />
              ) : ideas.trim() ? (
                <ProseView
                  scenes={scenes}
                  sourcePath={sourcePath}
                  selectedId={selection?.id ?? null}
                  onSelectSource={(id) => {
                    setKept({ log: true });
                    select(id, "log");
                  }}
                  registerAnchor={registerProse}
                />
              ) : (
                <p className="rpg-draft-empty">
                  Nothing here yet. Play a card from the drawer below, roll a table, or switch to <em>Code</em> to
                  write.
                </p>
              )}
            </div>
          </div>
          {logOpen && (
            <LogSidebar
              items={sidebarItems}
              onClose={() => setKept({ log: false })}
              selectedId={selection?.id ?? null}
              onSelect={(id) => select(id, "prose")}
              registerAnchor={registerLog}
              sourcePath={sourcePath}
              sceneEdits={sceneEdits}
              onSceneChange={(original, next) => setSceneEdits((prev) => ({ ...prev, [original]: next }))}
              dieEdits={dieEdits}
              onDieChange={(src, raw, slot, value) =>
                setDieEdits((prev) => ({ ...prev, [dieEditKey(src, raw, slot)]: value }))
              }
              onResultChange={(src, value) => setDieEdits((prev) => ({ ...prev, [resultEditKey(src)]: value }))}
              onTokenChange={(src, from, to, nth) =>
                setTokenEdits((prev) => [
                  ...prev.filter((e) => !(e.line === src && e.from === from && e.nth === nth)),
                  { line: src, from, to, nth },
                ])
              }
              onChoice={pickChoice}
            />
          )}
        </div>

        <BottomDrawer
          className="rpg-draft-drawer"
          label="GM cards"
          actionsPanel={
            gm && gm.stacks.length > 0 ? (
              <SessionActionsPanel
                pcStacks={NO_STACKS}
                gmStacks={gm.stacks}
                consumableState={consumableState}
                entities={[]}
                onAppendText={(text) => addLines(text)}
                onSpend={(id) => setGmSpent((s) => ({ ...s, [id]: (s[id] ?? 0) + 1 }))}
                sourcePath={sourcePath}
                vars={currentVars}
                gmOnly
              />
            ) : (
              <p className="rpg-draft-note rpg-draft-drawer-empty">
                {!draft.gm
                  ? "Choose a GM Screen above: its cards wait here."
                  : gm
                    ? "That GM Screen has no cards."
                    : "Loading the GM Screen's cards…"}
              </p>
            )
          }
        />
      </div>
    </section>
  );
}
