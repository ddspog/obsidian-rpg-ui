/**
 * The encounter catalog's board (`rpg encounter-catalog`): the party as the
 * last `rpg sim catalog check` profiled it, a strip of how many encounters fit,
 * and a card per encounter with its measured cost against what the difficulty
 * aims for. Actions write the catalog note (confirm, mark as run, tags).
 */

import * as React from "react";
import type { Board, BoardCard, CardStatus } from "lib/domains/encounter-catalog/board";

export interface EncounterBoardProps {
  board: Board;
  /** Opens a note (a monster, the source table). */
  openNote: (path: string) => void;
  onConfirm: (id: string) => void;
  onUsed: (id: string) => void;
  onTags: (id: string, tags: string[]) => void;
  /** Whether lower-tier entries are shown (asked for by the toggle). */
  lowerTiers: boolean;
  onLowerTiers: (on: boolean) => void;
}

type Filter = "fit" | "too-easy" | "too-hard" | "check" | "all";

const PAGE = 12;

const STATUS_LABEL: Record<CardStatus, string> = {
  fit: "Fits",
  "too-easy": "Too easy",
  "too-hard": "Too hard",
  stale: "Needs a check",
  unchecked: "Never checked",
};

const STALE_LABEL: Record<string, string> = {
  "party-changed": "the party changed",
  "difficulty-changed": "the difficulty changed",
  "sessions-elapsed": "it was checked sessions ago",
};

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** "Arctic T1 #3: Dire Wolf" → eyebrow "Arctic T1 · #3", title "Dire Wolf". */
function splitName(name: string): { eyebrow?: string; title: string } {
  const m = /^(.+?) #(\d+): (.+)$/.exec(name);
  return m ? { eyebrow: `${m[1]} · #${m[2]}`, title: m[3] } : { title: name };
}

function matches(card: BoardCard, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "check") return card.status === "stale" || card.status === "unchecked";
  return card.status === filter;
}

function search(card: BoardCard, words: string[]): boolean {
  if (words.length === 0) return true;
  const hay = [card.name, ...card.tags, ...card.monsters.map((m) => m.name), card.scene ?? ""].join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** The measured share of party HP lost against the difficulty's aim: a band where it fits, a dashed aim, a marker. */
function Gauge({
  value,
  aim,
  tolerance,
  status,
}: {
  value: number;
  aim: number;
  tolerance: number;
  status: CardStatus;
}) {
  const lo = Math.max(0, aim - tolerance);
  const hi = Math.min(1, aim + tolerance);
  return (
    <div
      className="rpg-enc-gauge"
      role="img"
      aria-label={`${pct(value)} of the party's hit points lost; the aim is ${pct(aim)}`}
    >
      <span className="rpg-enc-gauge-band" style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }} />
      <span className="rpg-enc-gauge-aim" style={{ left: `${aim * 100}%` }} />
      <span className={`rpg-enc-gauge-mark is-${status}`} style={{ left: `${Math.min(100, value * 100)}%` }} />
    </div>
  );
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const tag = draft.trim().toLowerCase();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setDraft("");
  };
  return (
    <div className="rpg-enc-tags is-editing">
      {tags.map((t) => (
        <span key={t} className="rpg-enc-tag">
          {t}
          <button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
            ×
          </button>
        </span>
      ))}
      <input
        className="rpg-enc-tag-input"
        value={draft}
        placeholder="Add a tag"
        aria-label="Add a tag"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

function Card({
  card,
  board,
  openNote,
  onConfirm,
  onUsed,
  onTags,
}: { card: BoardCard; board: Board } & Pick<EncounterBoardProps, "openNote" | "onConfirm" | "onUsed" | "onTags">) {
  const { eyebrow, title } = splitName(card.name);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const checked = card.status === "fit" || card.status === "too-easy" || card.status === "too-hard";
  return (
    <article className={`rpg-enc-card is-${card.status}${card.usedRecently ? " is-used" : ""}`}>
      <header className="rpg-enc-card-head">
        <div className="rpg-enc-card-title">
          {eyebrow && <span className="rpg-enc-eyebrow">{eyebrow}</span>}
          <h4>{title}</h4>
        </div>
        <span className={`rpg-enc-pill is-${card.status}`}>{STATUS_LABEL[card.status]}</span>
      </header>
      <div className="rpg-enc-monsters">
        {card.monsters.map((m) => (
          <button
            key={m.note}
            type="button"
            className="rpg-enc-monster"
            onClick={() => openNote(m.note)}
            title={m.note}
          >
            {m.count > 1 && <b>{m.count}×</b>} {m.name}
            {m.dice && <small> ({m.dice})</small>}
          </button>
        ))}
      </div>
      {card.scene && (
        <p
          className={`rpg-enc-scene${open ? " is-open" : ""}`}
          onClick={() => setOpen(!open)}
          title={open ? "Show less" : "Show the whole scene"}
        >
          {card.scene}
        </p>
      )}
      {card.outcome && (
        <div className={`rpg-enc-outcome${checked ? "" : " is-dim"}`}>
          <Gauge
            value={card.outcome.avgHpLost}
            aim={board.aim.toll}
            tolerance={board.aim.tolerance}
            status={card.status}
          />
          <div className="rpg-enc-numbers">
            <span>
              <b>{pct(card.outcome.avgHpLost)}</b> of the party's HP
            </span>
            <span>
              wipe <b>{pct(card.outcome.tpkRate)}</b>
            </span>
            <span>
              win <b>{pct(card.outcome.winRate)}</b>
            </span>
          </div>
        </div>
      )}
      {card.stale && (
        <p className="rpg-enc-note">Last check is out of date: {STALE_LABEL[card.stale] ?? card.stale}.</p>
      )}
      {card.atMax && (
        <p className="rpg-enc-note">On a high roll: {STATUS_LABEL[card.atMax as CardStatus] ?? card.atMax}.</p>
      )}
      {card.atMin && (
        <p className="rpg-enc-note">On a low roll: {STATUS_LABEL[card.atMin as CardStatus] ?? card.atMin}.</p>
      )}
      {editing ? (
        <TagEditor tags={card.tags} onChange={(tags) => onTags(card.id, tags)} />
      ) : (
        <div className="rpg-enc-tags">
          {card.tier === "lower" && <span className="rpg-enc-tag is-flag">lower tier</span>}
          {card.draft && <span className="rpg-enc-tag is-flag">draft</span>}
          {card.usedRecently && <span className="rpg-enc-tag is-flag">ran in session {card.lastUsedSession}</span>}
          {card.tags.map((t) => (
            <span key={t} className="rpg-enc-tag">
              {t}
            </span>
          ))}
        </div>
      )}
      <footer className="rpg-enc-actions">
        {card.draft && (
          <button type="button" className="mod-cta" onClick={() => onConfirm(card.id)}>
            Confirm
          </button>
        )}
        <button type="button" onClick={() => onUsed(card.id)}>
          Ran it
        </button>
        <button type="button" onClick={() => setEditing(!editing)}>
          {editing ? "Done" : "Tags"}
        </button>
        {card.source && <span className="rpg-enc-source">{card.source}</span>}
      </footer>
    </article>
  );
}

export function EncounterBoard(props: EncounterBoardProps) {
  const { board } = props;
  const { counts } = board;
  const [filter, setFilter] = React.useState<Filter>(counts.fit > 0 ? "fit" : "all");
  const [drafts, setDrafts] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [shown, setShown] = React.useState(PAGE);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const cards = board.cards.filter((c) => matches(c, filter) && (drafts || !c.draft) && search(c, words));
  const total = counts.fit + counts.tooEasy + counts.tooHard + counts.needsCheck;
  const share = (n: number) => `${total > 0 ? (n / total) * 100 : 0}%`;
  const profile = board.profile;

  const segments: Array<{ key: Filter; n: number; label: string }> = [
    { key: "fit", n: counts.fit, label: "fit" },
    { key: "too-easy", n: counts.tooEasy, label: "too easy" },
    { key: "too-hard", n: counts.tooHard, label: "too hard" },
    { key: "check", n: counts.needsCheck, label: "need a check" },
  ];

  return (
    <section className="rpg-enc-board">
      <header className="rpg-enc-party">
        <div className="rpg-enc-party-name">
          <span className="rpg-enc-eyebrow">Encounter catalog</span>
          <h3>{board.party.name}</h3>
          <span className="rpg-enc-pcs">{board.party.pcs.join(" · ")}</span>
        </div>
        <div className="rpg-enc-chips">
          {profile ? (
            <>
              <span className="rpg-enc-chip is-tier">Tier {profile.tier}</span>
              <span className="rpg-enc-chip">
                {profile.size} PCs · level {profile.averageLevel}
              </span>
              <span className="rpg-enc-chip">benchmark CR {profile.benchmark}</span>
              <span className="rpg-enc-chip">one monster CR {profile.singleCr.replace("-", "–")}</span>
            </>
          ) : (
            <span className="rpg-enc-chip">not profiled yet</span>
          )}
          <span className="rpg-enc-chip">{board.difficulty}</span>
          <span className="rpg-enc-chip">session {board.session}</span>
        </div>
      </header>

      <div className="rpg-enc-strip" role="group" aria-label="Encounters by fit">
        {segments.map((s) =>
          s.n > 0 ? (
            <button
              key={s.key}
              type="button"
              className={`rpg-enc-strip-seg is-${s.key}${filter === s.key ? " is-active" : ""}`}
              style={{ width: share(s.n) }}
              title={`${s.n} ${s.label}`}
              aria-label={`Show the ${s.n} that ${s.label === "fit" ? "fit" : `are ${s.label}`}`}
              onClick={() => setFilter(filter === s.key ? "all" : s.key)}
            />
          ) : null
        )}
      </div>
      <div className="rpg-enc-legend">
        {segments.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`rpg-enc-legend-item is-${s.key}${filter === s.key ? " is-active" : ""}`}
            onClick={() => setFilter(filter === s.key ? "all" : s.key)}
          >
            <i /> {s.n} {s.label}
          </button>
        ))}
        <button
          type="button"
          className={`rpg-enc-legend-item${filter === "all" ? " is-active" : ""}`}
          onClick={() => setFilter("all")}
        >
          all {total}
        </button>
      </div>

      {!profile && (
        <p className="rpg-enc-hint">
          Run <code>rpg sim catalog check</code> to profile the party: the board then keeps to its tier and spots
          encounters checked against an older party.
        </p>
      )}
      {counts.needsCheck > 0 && profile && (
        <p className="rpg-enc-hint">
          {counts.needsCheck} {counts.needsCheck === 1 ? "encounter needs" : "encounters need"} a check:{" "}
          <code>rpg sim catalog check</code>.
        </p>
      )}

      <div className="rpg-enc-tools">
        <input
          type="search"
          className="rpg-enc-search"
          placeholder="Search names, tags, monsters, scenes"
          aria-label="Search encounters"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
        />
        <label className="rpg-enc-toggle">
          <input type="checkbox" checked={drafts} onChange={(e) => setDrafts(e.target.checked)} /> drafts (
          {counts.drafts})
        </label>
        <label className="rpg-enc-toggle">
          <input type="checkbox" checked={props.lowerTiers} onChange={(e) => props.onLowerTiers(e.target.checked)} />{" "}
          lower tiers
        </label>
        {counts.otherTier > 0 && <span className="rpg-enc-muted">{counts.otherTier} from other tiers hidden</span>}
      </div>

      {cards.length === 0 ? (
        <p className="rpg-enc-empty">
          No encounter here. Try another filter, or ask the Game Master for a new one with <code>rpg sim plan</code>.
        </p>
      ) : (
        <div className="rpg-enc-cards">
          {cards.slice(0, shown).map((card) => (
            <Card
              key={card.id}
              card={card}
              board={board}
              openNote={props.openNote}
              onConfirm={props.onConfirm}
              onUsed={props.onUsed}
              onTags={props.onTags}
            />
          ))}
        </div>
      )}
      {cards.length > shown && (
        <button type="button" className="rpg-enc-more" onClick={() => setShown(shown + PAGE)}>
          Show {Math.min(PAGE, cards.length - shown)} more of {cards.length - shown}
        </button>
      )}
    </section>
  );
}

/** One `rpg encounter` block as a single line: the YAML stays in source mode. */
export function EncounterRow({
  card,
  aim,
  openNote,
}: {
  card: BoardCard;
  aim: number;
  openNote: (path: string) => void;
}) {
  const { eyebrow, title } = splitName(card.name);
  return (
    <div className={`rpg-enc-row is-${card.status}`} title={card.scene}>
      <span className={`rpg-enc-dot is-${card.status}`} aria-hidden="true" />
      <span className="rpg-enc-row-name">{title}</span>
      <span className="rpg-enc-row-monsters">
        {card.monsters.map((m, i) => (
          <React.Fragment key={m.note}>
            {i > 0 && " + "}
            <a
              className="rpg-enc-row-link"
              onClick={(e) => {
                e.preventDefault();
                openNote(m.note);
              }}
              href="#"
            >
              {m.count > 1 ? `${m.count}× ` : ""}
              {m.name}
            </a>
          </React.Fragment>
        ))}
      </span>
      <span className="rpg-enc-row-meta">
        {card.outcome ? `${pct(card.outcome.avgHpLost)} HP (aim ${pct(aim)})` : STATUS_LABEL[card.status]}
        {eyebrow ? ` · ${eyebrow}` : ""}
        {card.draft ? " · draft" : ""}
      </span>
    </div>
  );
}
