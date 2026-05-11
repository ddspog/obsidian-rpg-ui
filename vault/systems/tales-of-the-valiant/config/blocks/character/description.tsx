import * as React from "react";
import { Notice } from "obsidian";
import { EntityBlock, Markdown, PortraitThumb } from "rpg-ui-toolkit";
import type { CharacterEntity } from "../../entities/character.types";
import type {
  AppearanceSection,
  BackstoryHighlight,
  BackstorySection,
  DescriptionBlockData,
  MotivationCard,
  OrganizationEntry,
  RibbonEntry,
  SidePropRow,
} from "./description.types";

// ─── Persistence helpers ─────────────────────────────────────────────────────

/** Same shape as `usePersistentOpen` in features.tsx, but for a numeric tab
 *  index. Falls through silently when localStorage is unavailable (private
 *  browsing, Storybook harness variants, …) so the component still renders. */
function usePersistentTab(
  key: string,
  defaultIndex: number,
): [number, (next: number) => void] {
  const storageKey = `rpg-ui:tab:${key}`;
  const [index, setIndex] = React.useState<number>(() => {
    try {
      if (typeof localStorage === "undefined") return defaultIndex;
      const stored = localStorage.getItem(storageKey);
      if (stored == null) return defaultIndex;
      const n = Number(stored);
      return Number.isFinite(n) ? n : defaultIndex;
    } catch {
      return defaultIndex;
    }
  });
  const update = React.useCallback(
    (next: number) => {
      setIndex(next);
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        // ignore
      }
    },
    [storageKey],
  );
  return [index, update];
}

function useNoteKey(): string {
  return React.useMemo(() => {
    const app = (globalThis as unknown as {
      app?: { workspace?: { getActiveFile?: () => { path?: string } | null } };
    }).app;
    return app?.workspace?.getActiveFile?.()?.path ?? "default";
  }, []);
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** YAML leaves `[[Foo]]` as `[["Foo"]]`; flatten down to a plain string so
 *  Markdown + the prompt builder see a stable input. */
function flattenToString(v: unknown): string {
  let cur: unknown = v;
  while (Array.isArray(cur)) cur = cur[0];
  return typeof cur === "string" ? cur : "";
}

/** Strip wikilink punctuation and alias pipe to get the bare visible label —
 *  what you'd say out loud rather than what resolves to a vault file. */
function visibleLabel(raw: string): string {
  const m = raw.match(/^\[\[([^\]]+)\]\]$/);
  if (!m) return raw;
  const inner = m[1];
  const pipe = inner.indexOf("|");
  return (pipe >= 0 ? inner.slice(pipe + 1) : inner).trim();
}

// ─── Appearance ──────────────────────────────────────────────────────────────

/** Build a single-paragraph photo brief from the structured appearance data.
 *  Missing fields drop out so the prompt reads naturally even for sparse
 *  sheets. Side-prop keys are normalised to lowercase for the lookup but the
 *  final text uses natural casing. */
function buildImagePrompt(appearance: AppearanceSection | undefined): string {
  if (!appearance) return "";
  const flat: Record<string, string> = {};
  for (const row of appearance.side_props ?? []) {
    for (const [k, v] of Object.entries(row)) {
      if (v == null || v === "") continue;
      flat[k.toLowerCase()] = String(v);
    }
  }
  const bits: string[] = ["Photorealistic portrait."];
  if (flat.age) bits.push(`Age ${flat.age}.`);
  const sizePieces: string[] = [];
  if (flat.height) sizePieces.push(`height ${flat.height}`);
  if (flat.weight) sizePieces.push(`weight ${flat.weight}`);
  if (sizePieces.length > 0) bits.push(`${sizePieces.join(", ")}.`);
  const lookPieces: string[] = [];
  if (flat.eyes) lookPieces.push(`${flat.eyes} eyes`);
  if (flat.skin) lookPieces.push(`${flat.skin} skin`);
  if (flat.hair) lookPieces.push(`${flat.hair} hair`);
  if (lookPieces.length > 0) {
    const [first, ...rest] = lookPieces;
    const cap = first.charAt(0).toUpperCase() + first.slice(1);
    bits.push(rest.length > 0 ? `${cap}, ${rest.join(", ")}.` : `${cap}.`);
  }
  // Any other side-prop keys the author invented — don't silently drop them,
  // fold them in as plain `key value` phrases so custom systems still benefit.
  const knownKeys = new Set(["age", "height", "weight", "eyes", "skin", "hair"]);
  for (const [k, v] of Object.entries(flat)) {
    if (knownKeys.has(k)) continue;
    bits.push(`${k.charAt(0).toUpperCase()}${k.slice(1)}: ${v}.`);
  }
  const body = (appearance.body ?? "").trim();
  const clothes = (appearance.clothes ?? "").trim();
  if (body) bits.push(body.endsWith(".") ? body : `${body}.`);
  if (clothes) bits.push(clothes.endsWith(".") ? clothes : `${clothes}.`);
  return bits.join(" ");
}

function copyPromptToClipboard(prompt: string) {
  if (!prompt) {
    new Notice("Nothing to copy — appearance is empty");
    return;
  }
  const write = (): Promise<void> => {
    if (navigator?.clipboard?.writeText) {
      return navigator.clipboard.writeText(prompt);
    }
    // Fallback for environments without async clipboard (older Electron).
    const ta = document.createElement("textarea");
    ta.value = prompt;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(ta);
    }
    return Promise.resolve();
  };
  write()
    .then(() => new Notice("Image prompt copied"))
    .catch(() => new Notice("Failed to copy prompt"));
}

/** Pretty row label — YAML keys arrive lowercase for consistency, but the UI
 *  wants them uppercased as small-caps headings over the values. */
function upperLabel(key: string): string {
  return key.replace(/_/g, " ").toUpperCase();
}

function SidePropsGrid({ rows }: { rows: SidePropRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rpg-description-sideprops">
      {rows.map((row, i) => {
        const entries = Object.entries(row).filter(([, v]) => v != null && v !== "");
        if (entries.length === 0) return null;
        return (
          <dl
            key={i}
            className="rpg-description-sideprops-row"
            style={{ gridTemplateColumns: `repeat(${entries.length}, minmax(0, 1fr))` }}
          >
            {entries.map(([k]) => (
              <dt key={`k-${k}`}>{upperLabel(k)}</dt>
            ))}
            {entries.map(([k, v]) => (
              <dd key={`v-${k}`}>{String(v)}</dd>
            ))}
          </dl>
        );
      })}
    </div>
  );
}

function AppearanceTab({
  appearance,
  sourcePath,
}: {
  appearance?: AppearanceSection;
  sourcePath: string;
}) {
  const prompt = React.useMemo(() => buildImagePrompt(appearance), [appearance]);
  const isEmpty =
    !appearance ||
    (!appearance.body &&
      !appearance.clothes &&
      !appearance.art &&
      (appearance.side_props ?? []).length === 0);

  if (isEmpty) return <EmptyPanel hint="No appearance notes yet." />;

  return (
    <div className="rpg-description-appearance">
      <figure className="rpg-description-appearance-art" aria-label="Character art">
        <PortraitThumb src={appearance?.art} alt="Character art" />
      </figure>
      <div className="rpg-description-appearance-body">
        <SidePropsGrid rows={appearance?.side_props ?? []} />
        {appearance?.body && (
          <section aria-label="Body description">
            <header className="rpg-tag-heading"><span>Body</span></header>
            <Markdown source={appearance.body} sourcePath={sourcePath} />
          </section>
        )}
        {appearance?.clothes && (
          <section aria-label="Clothes description">
            <header className="rpg-tag-heading"><span>Attire</span></header>
            <Markdown source={appearance.clothes} sourcePath={sourcePath} />
          </section>
        )}
        <footer className="rpg-description-appearance-actions">
          <button
            type="button"
            className="rpg-description-copy-prompt"
            onClick={() => copyPromptToClipboard(prompt)}
            aria-label="Copy image generation prompt to clipboard"
            title="Copy a photo-brief based on this appearance to your clipboard"
          >
            Copy image prompt
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Backstory ───────────────────────────────────────────────────────────────

function HighlightsList({
  highlights,
  sourcePath,
}: {
  highlights: BackstoryHighlight[];
  sourcePath: string;
}) {
  if (highlights.length === 0) return null;
  return (
    <dl className="rpg-description-highlights" aria-label="Story highlights">
      {highlights.map((h, i) => {
        if (h.footnote) {
          return (
            <div
              key={i}
              className="rpg-description-highlight rpg-description-highlight-footnote"
            >
              <dd>
                <Markdown source={h.footnote} sourcePath={sourcePath} />
              </dd>
            </div>
          );
        }
        return (
          <div key={i} className="rpg-description-highlight">
            <dt>{h.key ?? ""}</dt>
            <dd>
              <Markdown source={h.value ?? ""} sourcePath={sourcePath} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function BackstoryTab({
  backstory,
  sourcePath,
}: {
  backstory?: BackstorySection;
  sourcePath: string;
}) {
  const isEmpty =
    !backstory ||
    (!backstory.text && !backstory.homeland && (backstory.highlights ?? []).length === 0);
  if (isEmpty) return <EmptyPanel hint="No backstory written yet." />;

  const homelandRaw = flattenToString(backstory?.homeland);

  return (
    <div className="rpg-description-backstory">
      {homelandRaw && (
        <header className="rpg-description-backstory-meta">
          <span className="rpg-description-meta-label">Homeland</span>
          <span className="rpg-description-meta-value">
            <Markdown source={homelandRaw} sourcePath={sourcePath} />
          </span>
        </header>
      )}
      {backstory?.text && (
        <article className="rpg-description-story-scroll" aria-label="Character backstory">
          <Markdown source={backstory.text} sourcePath={sourcePath} />
        </article>
      )}
      <HighlightsList highlights={backstory?.highlights ?? []} sourcePath={sourcePath} />
    </div>
  );
}

// ─── Ribbon rows (shared by Allies/Enemies + Organizations) ──────────────────

function RibbonRow({
  entry,
  variant,
  sourcePath,
}: {
  entry: RibbonEntry;
  variant: "compact" | "large";
  sourcePath: string;
}) {
  const portraitSrc = entry.portrait;
  const hasPortrait = portraitSrc != null && portraitSrc !== "";
  const label = visibleLabel(entry.name);
  return (
    <li className={`rpg-description-ribbon rpg-description-ribbon-${variant}`}>
      <aside
        className="rpg-description-ribbon-side"
        data-has-portrait={hasPortrait || undefined}
      >
        {hasPortrait && (
          <figure className="rpg-description-ribbon-portrait">
            <PortraitThumb src={portraitSrc} alt={label} />
          </figure>
        )}
        <header className="rpg-tag-heading rpg-description-ribbon-name">
          <span>
            <Markdown source={entry.name} sourcePath={sourcePath} />
          </span>
        </header>
        {entry.role && (
          <small className="rpg-description-ribbon-role">{entry.role}</small>
        )}
      </aside>
      {entry.text && (
        <div className="rpg-description-ribbon-body">
          <Markdown source={entry.text} sourcePath={sourcePath} />
        </div>
      )}
    </li>
  );
}

// ─── Allies & Enemies ────────────────────────────────────────────────────────

function AlliesEnemiesTab({
  allies,
  enemies,
  sourcePath,
}: {
  allies: RibbonEntry[];
  enemies: RibbonEntry[];
  sourcePath: string;
}) {
  if (allies.length === 0 && enemies.length === 0) {
    return <EmptyPanel hint="No allies or enemies logged yet." />;
  }
  return (
    <div className="rpg-description-side-by-side">
      <article className="rpg-description-column" data-kind="allies">
        <header className="rpg-tag-heading"><span>Allies</span></header>
        {allies.length === 0 ? (
          <p className="rpg-description-column-empty">None recorded.</p>
        ) : (
          <ul className="rpg-description-ribbon-list">
            {allies.map((a, i) => (
              <RibbonRow key={i} entry={a} variant="compact" sourcePath={sourcePath} />
            ))}
          </ul>
        )}
      </article>
      <article className="rpg-description-column" data-kind="enemies">
        <header className="rpg-tag-heading"><span>Enemies</span></header>
        {enemies.length === 0 ? (
          <p className="rpg-description-column-empty">None recorded.</p>
        ) : (
          <ul className="rpg-description-ribbon-list">
            {enemies.map((e, i) => (
              <RibbonRow key={i} entry={e} variant="compact" sourcePath={sourcePath} />
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}

// ─── Organizations ───────────────────────────────────────────────────────────

function OrganizationsTab({
  organizations,
  sourcePath,
}: {
  organizations: OrganizationEntry[];
  sourcePath: string;
}) {
  if (organizations.length === 0) {
    return <EmptyPanel hint="No organizations linked yet." />;
  }
  return (
    <ul className="rpg-description-organizations">
      {organizations.map((o, i) => (
        <li key={i} className="rpg-description-organization">
          <RibbonRow entry={o} variant="large" sourcePath={sourcePath} />
          {o.position && (
            <footer className="rpg-description-org-position">
              <span className="rpg-description-meta-label">Position</span>
              <span className="rpg-description-meta-value">
                <Markdown source={o.position} sourcePath={sourcePath} />
              </span>
            </footer>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─── Motivation ──────────────────────────────────────────────────────────────

function MotivationTab({
  cards,
  sourcePath,
}: {
  cards: MotivationCard[];
  sourcePath: string;
}) {
  if (cards.length === 0) {
    return <EmptyPanel hint="No motivations written yet." />;
  }
  return (
    <div
      className="rpg-description-motivation"
      data-count={cards.length}
      aria-label="Character motivations"
    >
      {cards.map((card, i) => {
        const style: React.CSSProperties | undefined = card.color
          ? ({ ["--rpg-card-accent"]: card.color } as React.CSSProperties)
          : undefined;
        return (
          <figure
            key={i}
            className="rpg-description-motivation-card"
            style={style}
            data-index={i}
          >
            <blockquote>
              <Markdown source={card.text} sourcePath={sourcePath} />
            </blockquote>
          </figure>
        );
      })}
    </div>
  );
}

// ─── Empty panel placeholder ─────────────────────────────────────────────────

function EmptyPanel({ hint }: { hint: string }) {
  return (
    <p className="rpg-description-empty" aria-details="Empty Tab">
      <em>{hint}</em>
    </p>
  );
}

// ─── Tab shell ───────────────────────────────────────────────────────────────

interface TabDef {
  id: string;
  label: string;
  render: () => React.ReactNode;
}

// ─── Main block ──────────────────────────────────────────────────────────────

export const description: EntityBlock<DescriptionBlockData, CharacterEntity> = ({
  self,
}) => {
  // Obsidian exposes the active note via `globalThis.app`. Storybook doesn't,
  // so `sourcePath` degrades to "" — Markdown still renders, just without
  // resolving relative wikilinks against a specific vault file.
  const sourcePath = React.useMemo(() => {
    const app = (globalThis as unknown as {
      app?: { workspace?: { getActiveFile?: () => { path?: string } | null } };
    }).app;
    return app?.workspace?.getActiveFile?.()?.path ?? "";
  }, []);

  const noteKey = useNoteKey();

  const tabs: TabDef[] = React.useMemo(
    () => [
      {
        id: "appearance",
        label: "Appearance",
        render: () => (
          <AppearanceTab appearance={self.appearance} sourcePath={sourcePath} />
        ),
      },
      {
        id: "backstory",
        label: "Backstory",
        render: () => (
          <BackstoryTab backstory={self.backstory} sourcePath={sourcePath} />
        ),
      },
      {
        id: "allies-enemies",
        label: "Allies & Enemies",
        render: () => (
          <AlliesEnemiesTab
            allies={self.allies ?? []}
            enemies={self.enemies ?? []}
            sourcePath={sourcePath}
          />
        ),
      },
      {
        id: "organizations",
        label: "Organizations",
        render: () => (
          <OrganizationsTab
            organizations={self.organizations ?? []}
            sourcePath={sourcePath}
          />
        ),
      },
      {
        id: "motivation",
        label: "Motivation",
        render: () => (
          <MotivationTab cards={self.motivation ?? []} sourcePath={sourcePath} />
        ),
      },
    ],
    [self, sourcePath],
  );

  const [activeIndex, setActiveIndex] = usePersistentTab(
    `${noteKey}:description`,
    0,
  );
  const clampedIndex = Math.max(0, Math.min(activeIndex, tabs.length - 1));
  const active = tabs[clampedIndex];

  // Per-tab scroll position — preserved across tab switches so the reader can
  // wander through the backstory, dip into allies, and come back without
  // losing their place. Captured before state update, re-applied in the next
  // frame once the new panel mounts.
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const scrollByTabRef = React.useRef<Map<number, number>>(new Map());

  const onSelectTab = React.useCallback(
    (next: number) => {
      if (next === clampedIndex) return;
      if (panelRef.current) {
        scrollByTabRef.current.set(clampedIndex, panelRef.current.scrollTop);
      }
      setActiveIndex(next);
    },
    [clampedIndex, setActiveIndex],
  );

  React.useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const saved = scrollByTabRef.current.get(clampedIndex) ?? 0;
    // Wait one frame so the new panel's children are laid out before we
    // re-assert scrollTop; otherwise the browser clamps the assignment to 0.
    const raf = requestAnimationFrame(() => {
      if (panelRef.current) panelRef.current.scrollTop = saved;
    });
    return () => cancelAnimationFrame(raf);
  }, [clampedIndex]);

  // Keyboard navigation: Left/Right arrows cycle tabs when the tablist holds
  // focus, Home/End jump to the ends — matches the WAI-ARIA tablist pattern.
  const onKeyDown = (e: React.KeyboardEvent<HTMLMenuElement>) => {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (clampedIndex + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (clampedIndex - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next != null) {
      e.preventDefault();
      onSelectTab(next);
    }
  };

  return (
    <section
      aria-details="Character Description"
      className="rpg-description-block"
    >
      <menu
        role="tablist"
        aria-label="Character description tabs"
        className="rpg-description-tablist"
        onKeyDown={onKeyDown}
      >
        {tabs.map((tab, i) => {
          const selected = i === clampedIndex;
          return (
            <li key={tab.id} className="rpg-description-tab-item" role="none">
              <button
                type="button"
                role="tab"
                id={`rpg-description-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`rpg-description-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                className="rpg-description-tab"
                data-active={selected || undefined}
                onClick={() => onSelectTab(i)}
              >
                <span>{tab.label}</span>
              </button>
            </li>
          );
        })}
      </menu>
      <div
        ref={panelRef}
        role="tabpanel"
        id={`rpg-description-panel-${active.id}`}
        aria-labelledby={`rpg-description-tab-${active.id}`}
        className="rpg-description-panel"
        data-tab={active.id}
      >
        {active.render()}
      </div>
    </section>
  );
};

export default description;
