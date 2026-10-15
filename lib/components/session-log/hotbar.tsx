/**
 * The drawer's cards as a hotbar, after Baldur's Gate 3's: the actor's
 * resources as pills along the top — a dot for the action, a triangle for the
 * bonus action, a diamond for the reaction (in a fight), a square per spell
 * slot (blue; a pact's purple), a feature's own glyph for its uses — filled
 * while there's one left, hollow once spent. Below, every card a square tile,
 * its glyph outlined in its type's colour, its name and what it does on hover;
 * a pill picks out the tiles that spend it. More tiles than fit: the arrows
 * page through them.
 */

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import type { CardStack as CardStackData, SessionFeatureCard } from "../../domains/session-log/card-types";
import { isAvailable, type SessionConsumableState } from "../../domains/session-log/consumable-state";
import {
  resourceKey,
  spendsResource,
  tileGlyph,
  tileKind,
  tileSource,
  type HotbarResource,
  type TileKind,
  type TileSource,
} from "../../domains/session-log/hotbar-model";
import { Menu } from "obsidian";
import { isTableStack, mechanismOf, TABLE_MECHANISMS, tableAreaOf } from "../../domains/session-log/table-cards";
import { LucideIcon } from "./lucide-icon";

interface HotbarProps {
  stacks: CardStackData[];
  /** The actor's resources now — the economy's in a fight, slots, uses. */
  resources: HotbarResource[];
  consumableState: SessionConsumableState;
  onPlay: (card: SessionFeatureCard) => void;
  /** A card's own icon art, when the vault has one (`Icons/Longbow.webp`). */
  iconFor?: (name: string) => string | undefined;
  /** Make (or remake) a card's icon — from its tile's right-click menu. */
  onMakeIcon?: (card: SessionFeatureCard, kind: TileKind) => void;
  /** Small controls for the end of the pills row (Move, Gear). */
  extras?: React.ReactNode;
  /** Why some cards are left out (spells that can't be cast with what's in hand). */
  awayNote?: string;
}

/** A card's tab, by where it comes from — BG3's Common · class · Items · Passives. */
export function tabOf(card: SessionFeatureCard, stack: { actorType?: string; bucket?: string }): string | undefined {
  // The table's cards (the GM's and the party's together): story, combat, the party's own.
  if (stack.actorType === "gm" || card.kind === "party") return tableAreaOf(card, stack.bucket);
  if (card.bucket === "passive" && !card.toggle) return "Passives";
  const source = tileSource(card, stack);
  switch (source) {
    case "basic":
    case "other":
      return "Common";
    case "item":
      return "Items";
    case "lineage":
    case "heritage":
    case "background":
    case "talent":
      return "Origin";
    default:
      // A class, a subclass, the spells of one: tabbed by its name.
      return card.source.replace(/^(pc|foe):.*$/, "Common").trim() || "Common";
  }
}

const KIND_LABEL: Record<TileKind, string> = {
  attack: "Attack",
  action: "Action",
  bonus: "Bonus action",
  reaction: "Reaction",
  spell: "Spell",
  passive: "Passive",
  gm: "Game Master",
  party: "Party",
  other: "Other",
};

const SOURCE_LABEL: Record<TileSource, string> = {
  basic: "Basic action",
  item: "Item",
  class: "Class",
  subclass: "Subclass",
  lineage: "Lineage",
  heritage: "Heritage",
  background: "Background",
  talent: "Talent",
  spell: "Spell",
  gm: "",
  party: "",
  other: "",
};

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];

/** One pip of a pill: its shape, filled while it's there to spend. */
function Pip({ kind, full, glyph }: { kind: HotbarResource["kind"]; full: boolean; glyph?: string }) {
  if (kind === "use" || kind === "toggle" || kind === "passive") {
    return (
      <span className={`rpg-hotbar-pip is-${kind}${full ? " is-full" : ""}`}>
        <LucideIcon name={glyph ?? "Star"} size="0.85rem" strokeWidth={2} />
      </span>
    );
  }
  return <span className={`rpg-hotbar-pip is-${kind}${full ? " is-full" : ""}`} aria-hidden="true" />;
}

/** A resource as a pill: its pips, its name and count on hover. */
function Pill({ r, active, onToggle }: { r: HotbarResource; active: boolean; onToggle: () => void }) {
  if (r.kind === "class") {
    // Just its icon, in its own colour; the name and count are on hover.
    const slug = r.label.toLowerCase().replace(/[^a-z]+/g, "-");
    return (
      <button
        type="button"
        className={`rpg-hotbar-pill is-class m-${slug}${active ? " is-active" : ""}`}
        aria-pressed={active}
        aria-label={`${r.label}: ${r.max}${r.note ? ` — ${r.note}` : ""}`}
        title={`${r.label} · ${r.max}${r.note ? ` — ${r.note}` : ""}`}
        onClick={onToggle}
      >
        <LucideIcon name={r.glyph ?? "Square"} size="1rem" strokeWidth={1.8} />
      </button>
    );
  }
  const recovery = r.recovery ? ` · back on ${r.recovery.replace(/^on\s+/i, "")}` : "";
  return (
    <button
      type="button"
      className={`rpg-hotbar-pill is-${r.kind}${active ? " is-active" : ""}${r.left === 0 ? " is-spent" : ""}`}
      aria-pressed={active}
      aria-label={r.note ? `${r.label} — ${r.note}` : `${r.label}: ${r.left} of ${r.max} left${recovery}`}
      onClick={onToggle}
    >
      {r.circle != null && <span className="rpg-hotbar-pill-circle">{ROMAN[r.circle] ?? r.circle}</span>}
      <span className="rpg-hotbar-pips">
        {/* Many uses read as a count, not a row of pips. */}
        {r.max > 5 ? (
          <>
            <Pip kind={r.kind} full={r.left > 0} glyph={r.glyph} />
            <span className="rpg-hotbar-pill-count">
              {r.left}/{r.max}
            </span>
          </>
        ) : (
          Array.from({ length: r.max }, (_, i) => <Pip key={i} kind={r.kind} full={i < r.left} glyph={r.glyph} />)
        )}
      </span>
    </button>
  );
}

/** A card as a tile: its glyph in its kind's colour; uses left, a spell's circle. */
function Tile({
  card,
  kind,
  source,
  image,
  depleted,
  onPlay,
  onMenu,
}: {
  card: SessionFeatureCard;
  kind: TileKind;
  source: TileSource;
  /** Its own icon art, when there is some. */
  image?: string;
  depleted: boolean;
  onPlay: () => void;
  onMenu?: (e: React.MouseEvent) => void;
}) {
  const what = card.summary ?? card.text ?? "";
  const from = SOURCE_LABEL[source];
  const changed = card.modifiedBy?.map((m) => `${m.from}: ${m.text}`).join("; ");
  return (
    <button
      type="button"
      className={`rpg-hotbar-tile is-${kind} from-${source}${image ? " has-art" : ""}${depleted ? " is-depleted" : ""}${card.toggle ? ` is-toggle${card.on ? " is-on" : ""}` : ""}${changed ? " is-changed" : ""}`}
      aria-label={`${card.name} — ${KIND_LABEL[kind]}${from ? ` · ${from}` : ""}${card.toggle ? ` · ${card.on ? "on" : "off"}` : ""}${what ? `\n${what}` : ""}${changed ? `\nChanged by ${changed}` : ""}`}
      data-tooltip-position="top"
      disabled={depleted}
      onClick={onPlay}
      onContextMenu={onMenu}
    >
      {image ? (
        <img className="rpg-hotbar-art" src={image} alt="" draggable={false} />
      ) : (
        <LucideIcon name={tileGlyph(card, kind)} size="1.15rem" strokeWidth={1.6} className="rpg-hotbar-glyph" />
      )}
      {/* Its name, small, along the foot — the tile read at a glance. */}
      {(() => {
        const label = card.name.replace(/\s*[ᴬᴮᴰᴴᴷᴺº]+$/u, "");
        // A very long word is set a size smaller, to stay whole in its tile.
        const longest = Math.max(...label.split(/\s+/).map((w) => w.length));
        return (
          <span className={`rpg-hotbar-tile-name${longest >= 12 ? " is-longer" : longest >= 10 ? " is-long" : ""}`}>
            {label}
          </span>
        );
      })()}
      {changed && <span className="rpg-hotbar-tile-changed" aria-hidden="true" />}
      {card.cast && <span className="rpg-hotbar-tile-circle">{ROMAN[card.cast.circle] ?? card.cast.circle}</span>}
      {card.maxUses != null && <span className="rpg-hotbar-tile-uses">{card.maxUses}</span>}
    </button>
  );
}

export function Hotbar({
  stacks,
  resources,
  consumableState,
  onPlay,
  iconFor,
  onMakeIcon,
  extras,
  awayNote,
}: HotbarProps) {
  const [tab, setTab] = useState("All");
  // A tile's menu: make its icon in the image studio.
  const menuFor = (card: SessionFeatureCard, kind: TileKind, hasArt: boolean) =>
    onMakeIcon
      ? (e: React.MouseEvent) => {
          e.preventDefault();
          const menu = new Menu();
          menu.addItem((item) =>
            item
              .setTitle(hasArt ? "Remake icon in image studio…" : "Make icon in image studio…")
              .setIcon("image-plus")
              .onClick(() => onMakeIcon(card, kind))
          );
          menu.showAtMouseEvent(e.nativeEvent);
        }
      : undefined;
  const [filter, setFilter] = useState<string | null>(null);
  // Toggles (lit while on) and the passives, as pills of their own beside the resources.
  const toggleCards = stacks
    .flatMap((st) => st.cards.map((card) => ({ card, kind: tileKind(card, st) })))
    .filter((x) => x.card.toggle);
  const passiveCount = stacks.flatMap((st) => st.cards).filter((c) => c.bucket === "passive" && !c.toggle).length;
  const extra: HotbarResource[] = [
    ...toggleCards.map(({ card, kind }) => ({
      kind: "toggle" as const,
      label: card.name.replace(/\s*[ᴬᴮᴰᴴᴷᴺº]+$/u, "").trim(),
      max: 1,
      left: card.on ? 1 : 0,
      glyph: tileGlyph(card, kind),
      note: card.on ? "on" : "off",
    })),
    ...(passiveCount > 0
      ? [
          {
            kind: "passive" as const,
            label: "Passives",
            max: 1,
            left: 1,
            glyph: "Gem",
            note: `${passiveCount} always on`,
          },
        ]
      : []),
  ];
  // On the table's cards, pills for what kind of machine each is.
  const mechanisms: HotbarResource[] = stacks.some(isTableStack)
    ? TABLE_MECHANISMS.flatMap((m) => {
        const n = stacks.reduce((sum, s) => sum + s.cards.filter((c) => mechanismOf(c, s.bucket) === m.id).length, 0);
        return n > 0 ? [{ kind: "class" as const, label: m.id, max: n, left: n, glyph: m.glyph, note: m.hint }] : [];
      })
    : [];
  const everything = [...resources, ...extra, ...mechanisms];
  const active = everything.find((r) => resourceKey(r) === filter);
  // A resource kept as a pill isn't a card of its own any more.
  // The passives sit last: what's always on after what's done.
  const passivesLast = [...stacks].sort((a, b) => Number(a.bucket === "passive") - Number(b.bucket === "passive"));
  const shown = passivesLast
    .filter((s) => !(s.bucket === "resource" && resources.some((r) => r.kind === "use")))
    .map((s) => ({
      stack: s,
      tiles: s.cards
        .map((card) => ({ card, kind: tileKind(card, s), source: tileSource(card, s) }))
        .filter(({ card, kind }) =>
          !active
            ? true
            : active.kind === "class"
              ? mechanismOf(card, s.bucket) === active.label
              : spendsResource(card, kind, active)
        )
        .filter(({ card }) => tab === "All" || tabOf(card, s) === tab),
    }))
    .filter((g) => g.tiles.length > 0);

  // Paging: arrows when the tiles run past the bar, each a bar's width.
  const strip = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ back: false, more: false });
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const measure = () =>
      setEdges({ back: el.scrollLeft > 2, more: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    measure();
    el.addEventListener("scroll", measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [shown.length, filter]);
  const page = (dir: 1 | -1) =>
    strip.current?.scrollBy({ left: dir * strip.current.clientWidth * 0.9, behavior: "smooth" });

  // The tabs, in the order they first appear — Common first, Passives last.
  const tabNames = (() => {
    const seen = new Set<string>();
    for (const s of stacks)
      for (const c of s.cards) {
        const t = tabOf(c, s);
        if (t) seen.add(t);
      }
    const order = (t: string) =>
      t === "Common" || t === "Story"
        ? 0
        : t === "Combat"
          ? 1
          : t === "Party"
            ? 2
            : t === "Items"
              ? 90
              : t === "Origin"
                ? 91
                : t === "Passives"
                  ? 99
                  : 10;
    return [...seen].sort((a, b) => order(a) - order(b));
  })();

  const economy = resources.filter((r) => r.kind === "action" || r.kind === "bonus" || r.kind === "reaction");
  const slots = resources.filter((r) => r.kind === "slot" || r.kind === "pact");
  const uses = resources.filter((r) => r.kind === "use");
  const states = extra;

  return (
    <section className="rpg-hotbar">
      {(everything.length > 0 || extras) && (
        <div className="rpg-hotbar-pills" role="toolbar" aria-label="Resources — pick one to see what spends it">
          {[economy, slots, uses, states, mechanisms]
            .filter((g) => g.length > 0)
            .map((group, gi) => (
              <div key={gi} className="rpg-hotbar-pill-group">
                {group.map((r) => (
                  <Pill
                    key={resourceKey(r)}
                    r={r}
                    active={filter === resourceKey(r)}
                    onToggle={() => setFilter((f) => (f === resourceKey(r) ? null : resourceKey(r)))}
                  />
                ))}
              </div>
            ))}
          {extras && <div className="rpg-hotbar-pill-group rpg-hotbar-extras">{extras}</div>}
        </div>
      )}
      <div className="rpg-hotbar-body">
        <button
          type="button"
          className="rpg-hotbar-page"
          aria-label="Back"
          disabled={!edges.back}
          onClick={() => page(-1)}
        >
          <LucideIcon name="ChevronLeft" size="1rem" />
        </button>
        <div className="rpg-hotbar-strip" ref={strip}>
          {shown.map(({ stack, tiles }) => (
            <div
              key={`${stack.actor}-${stack.bucket}`}
              className="rpg-hotbar-group"
              role="group"
              aria-label={stack.label}
            >
              {/* As square as it can be, up to three rows: 2 tiles stacked, 12 in three rows of four. */}
              <div
                className="rpg-hotbar-tiles"
                style={
                  { "--rows": Math.min(3, Math.max(1, Math.ceil(Math.sqrt(tiles.length)))) } as React.CSSProperties
                }
              >
                {tiles.map(({ card, kind, source }) => (
                  <Tile
                    key={card.id}
                    card={card}
                    kind={kind}
                    source={source}
                    {...(iconFor?.(card.name) ? { image: iconFor(card.name) } : {})}
                    {...(menuFor(card, kind, !!iconFor?.(card.name))
                      ? { onMenu: menuFor(card, kind, !!iconFor?.(card.name)) }
                      : {})}
                    depleted={!isAvailable(consumableState, card)}
                    onPlay={() => onPlay(card)}
                  />
                ))}
              </div>
              <span className="rpg-hotbar-group-label">{stack.label}</span>
            </div>
          ))}
          {shown.length === 0 && (
            <p className="actions-empty">
              {active ? `Nothing spends ${active.label.toLowerCase()}` : "No actions available"}
            </p>
          )}
        </div>
        <button
          type="button"
          className="rpg-hotbar-page"
          aria-label="More"
          disabled={!edges.more}
          onClick={() => page(1)}
        >
          <LucideIcon name="ChevronRight" size="1rem" />
        </button>
      </div>
      {awayNote && <p className="rpg-hotbar-away">{awayNote}</p>}
      {tabNames.length > 1 && (
        <div className="rpg-hotbar-tabs" role="tablist" aria-label="Where a card comes from">
          {["All", ...tabNames].map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`rpg-hotbar-tab${tab === t ? " is-active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
