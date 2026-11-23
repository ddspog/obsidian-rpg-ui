/**
 * The encounter catalog's board (`rpg encounter-catalog`): the party as the
 * last `rpg sim catalog check` profiled it, how the catalog's fights measure
 * up for it, and a card per encounter with its cost to the party drawn
 * against what the difficulty aims for. Actions write the catalog note
 * (confirm, mark as run, tags).
 */

import * as React from "react";
import type { Board, BoardCard, CardStatus } from "lib/domains/encounter-catalog/board";

export interface EncounterBoardProps {
  board: Board;
  /** Opens a note (a monster). */
  openNote: (path: string) => void;
  onConfirm: (id: string) => void;
  /** Prepare the encounter in the party's latest session log (Start Combat then offers it). */
  onPrepare: (id: string) => void;
  /** Take a prepared encounter back out of the log. */
  onUnprepare: (id: string) => void;
  /** The entries prepared and not fought yet, by id, with the session note they are prepared in. */
  prepared: Map<string, string>;
  /** The session note Prepare writes to; none means there is nowhere to prepare. */
  sessionName?: string;
  onTags: (id: string, tags: string[]) => void;
  /** Copies a command for the terminal. */
  onCopy: (text: string) => void;
  /** Whether lower-tier entries are shown (asked for by the toggle). */
  lowerTiers: boolean;
  onLowerTiers: (on: boolean) => void;
}

type Filter = "too-easy" | "fit" | "too-hard" | "check" | "all";

const PAGE = 12;
/** Tags shown on a card before "+N". */
const TAGS_SHOWN = 3;

const STATUS_LABEL: Record<CardStatus, string> = {
  fit: "Fits",
  "too-easy": "Too easy",
  "too-hard": "Too hard",
  stale: "Needs a check",
  unchecked: "Not measured",
};

const STALE_LABEL: Record<string, string> = {
  "party-changed": "the party has changed since",
  "difficulty-changed": "the difficulty has changed since",
  "sessions-elapsed": "it was measured sessions ago",
};

const pct = (n: number): string => `${Math.round(n * 100)}%`;

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

/** The tags worth showing: not the tier or the book, which the byline already says. */
const shownTags = (card: BoardCard): string[] => card.tags.filter((t) => !/^tier-\d$/i.test(t) && t !== card.book);

/** Lucide's badge-check, drawn inline (a confirmed encounter's seal). */
function Seal() {
  return (
    <svg className="rpg-enc-seal" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/**
 * What the fight costs the party: the share of its hit points lost, on a scale
 * from none to all. The band is where a fight is a fair one for the difficulty,
 * the dash its aim, the dot the measured cost (a ring when too easy, a diamond
 * when too hard, so the status reads without colour).
 */
function Gauge({
  value,
  aim,
  tolerance,
  status,
  settle,
}: {
  value?: number;
  aim: number;
  tolerance: number;
  status: CardStatus;
  settle: boolean;
}) {
  const lo = Math.max(0, aim - tolerance);
  const hi = Math.min(1, aim + tolerance);
  return (
    <div className="rpg-enc-gauge-wrap">
      <div
        className="rpg-enc-gauge"
        role="img"
        aria-label={
          value === undefined
            ? `Not measured yet; the aim is ${pct(aim)} of the party's hit points`
            : `Costs ${pct(value)} of the party's hit points; the aim is ${pct(aim)}`
        }
      >
        <span className="rpg-enc-gauge-band" style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }} />
        <span className="rpg-enc-gauge-aim" style={{ left: `${aim * 100}%` }} />
        {value !== undefined && (
          <span
            className={`rpg-enc-gauge-mark is-${status}${settle ? " is-settling" : ""}`}
            style={{ left: `${Math.min(100, value * 100)}%` }}
          />
        )}
      </div>
      <div className="rpg-enc-gauge-scale" aria-hidden="true">
        <span>0</span>
        <span className="rpg-enc-gauge-scale-aim" style={{ left: `${aim * 100}%` }}>
          aim {pct(aim)}
        </span>
        <span>all HP</span>
      </div>
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
          <button
            type="button"
            className="rpg-enc-tag-remove"
            aria-label={`Remove tag ${t}`}
            onClick={() => onChange(tags.filter((x) => x !== t))}
          >
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
  highlight,
  settle,
  preparedIn,
  canPrepare,
  openNote,
  onConfirm,
  onPrepare,
  onUnprepare,
  onTags,
}: {
  card: BoardCard;
  board: Board;
  /** The one draft the board points at: its Confirm is the accent button. */
  highlight: boolean;
  settle: boolean;
  /** The session note it is prepared in, when it is. */
  preparedIn?: string;
  canPrepare: boolean;
} & Pick<EncounterBoardProps, "openNote" | "onConfirm" | "onPrepare" | "onUnprepare" | "onTags">) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [allTags, setAllTags] = React.useState(false);
  const measured = card.status === "fit" || card.status === "too-easy" || card.status === "too-hard";
  const tags = shownTags(card);
  const visibleTags = allTags ? tags : tags.slice(0, TAGS_SHOWN);
  const pill = card.usedRecently
    ? `Ran · session ${card.lastUsedSession}`
    : `${STATUS_LABEL[card.status]}${card.draft ? " · draft" : ""}`;
  return (
    <article
      className={`rpg-enc-card is-${card.status}${card.usedRecently ? " is-used" : ""}${card.draft ? "" : " is-confirmed"}`}
    >
      <header className="rpg-enc-card-head">
        <div className="rpg-enc-card-title">
          <h3>{card.title}</h3>
          {card.byline && <span className="rpg-enc-byline">{card.byline}</span>}
        </div>
        <span className={`rpg-enc-pill is-${card.usedRecently ? "used" : card.status}`}>
          {!card.draft && !card.usedRecently && <Seal />}
          {pill}
        </span>
      </header>
      <div className="rpg-enc-monsters">
        {card.monsters.map((m) => (
          <button
            key={m.note}
            type="button"
            className="rpg-enc-monster"
            onClick={() => openNote(m.note)}
            title={`Open ${m.name}`}
          >
            {m.count > 1 && <b>{m.count}×</b>} {m.name}
            {m.dice && <small> ({m.dice})</small>}
          </button>
        ))}
      </div>
      {card.scene && (
        <button
          type="button"
          className={`rpg-enc-scene${open ? " is-open" : ""}`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span className="rpg-enc-scene-text">{card.scene}</span>
          <span className="rpg-enc-scene-more">{open ? "Show less" : "Read the scene"}</span>
        </button>
      )}
      <div className={`rpg-enc-outcome${measured ? "" : " is-dim"}`}>
        <Gauge
          value={card.outcome?.avgHpLost}
          aim={board.aim.toll}
          tolerance={board.aim.tolerance}
          status={card.status}
          settle={settle}
        />
        {card.outcome && (
          <div className="rpg-enc-numbers">
            <span>
              costs <b>{pct(card.outcome.avgHpLost)}</b> of their HP
            </span>
            <span>
              wipes them <b>{pct(card.outcome.tpkRate)}</b>
            </span>
            <span>
              they win <b>{pct(card.outcome.winRate)}</b>
            </span>
          </div>
        )}
      </div>
      {card.stale && <p className="rpg-enc-note">Measured before, but {STALE_LABEL[card.stale] ?? card.stale}.</p>}
      {card.atMax && (
        <p className="rpg-enc-note">
          On a high roll: {STATUS_LABEL[card.atMax as CardStatus]?.toLowerCase() ?? card.atMax}.
        </p>
      )}
      {card.atMin && (
        <p className="rpg-enc-note">
          On a low roll: {STATUS_LABEL[card.atMin as CardStatus]?.toLowerCase() ?? card.atMin}.
        </p>
      )}
      {editing ? (
        <TagEditor tags={card.tags} onChange={(next) => onTags(card.id, next)} />
      ) : (
        (tags.length > 0 || card.tier === "lower") && (
          <div className="rpg-enc-tags">
            {card.tier === "lower" && <span className="rpg-enc-tag is-flag">lower tier</span>}
            {visibleTags.map((t) => (
              <span key={t} className="rpg-enc-tag">
                {t}
              </span>
            ))}
            {tags.length > TAGS_SHOWN && (
              <button type="button" className="rpg-enc-tag rpg-enc-tag-more" onClick={() => setAllTags(!allTags)}>
                {allTags ? "fewer" : `+${tags.length - TAGS_SHOWN}`}
              </button>
            )}
          </div>
        )
      )}
      <footer className="rpg-enc-actions">
        {card.draft && (
          <button
            type="button"
            className={`rpg-enc-action${highlight ? " mod-cta" : ""}`}
            onClick={() => onConfirm(card.id)}
          >
            Confirm
          </button>
        )}
        {preparedIn ? (
          <>
            <span className="rpg-enc-prepared">
              <span className="rpg-enc-prepared-state">prepared</span> in {preparedIn}
            </span>
            <button type="button" className="rpg-enc-action" onClick={() => onUnprepare(card.id)}>
              Unprepare
            </button>
          </>
        ) : (
          !card.usedRecently &&
          canPrepare && (
            <button
              type="button"
              className={`rpg-enc-action${highlight && !card.draft ? " mod-cta" : ""}`}
              onClick={() => onPrepare(card.id)}
            >
              Prepare
            </button>
          )
        )}
        <button type="button" className="rpg-enc-action" onClick={() => setEditing(!editing)}>
          {editing ? "Done" : "Tags"}
        </button>
      </footer>
    </article>
  );
}

function CopyCommand({ command, onCopy }: { command: string; onCopy: (text: string) => void }) {
  return (
    <span className="rpg-enc-command">
      <code>{command}</code>
      <button type="button" className="rpg-enc-copy" onClick={() => onCopy(command)}>
        Copy
      </button>
    </span>
  );
}

/** The sentence under the strip: what the counts say about this party. */
function storyOf(board: Board): string {
  const { fit, tooEasy, tooHard, needsCheck } = board.counts;
  const who = board.party.name || "the party";
  const level = board.profile ? ` at level ${board.profile.averageLevel}` : "";
  const parts: string[] = [];
  parts.push(fit === 1 ? `1 fight fits ${who}${level}` : `${fit} fights fit ${who}${level}`);
  if (tooHard > 0) parts.push(`${tooHard} would be too much for them yet`);
  if (tooEasy > 0) parts.push(`${tooEasy} would barely scratch them`);
  if (needsCheck > 0) parts.push(`${needsCheck} still to measure`);
  return `${parts.join("; ")}.`;
}

export function EncounterBoard(props: EncounterBoardProps) {
  const { board } = props;
  const { counts } = board;
  const total = counts.fit + counts.tooEasy + counts.tooHard + counts.needsCheck;
  const measuredAny = counts.fit + counts.tooEasy + counts.tooHard > 0;
  const [filter, setFilter] = React.useState<Filter>(counts.fit > 0 ? "fit" : "all");
  const [drafts, setDrafts] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [shown, setShown] = React.useState(PAGE);
  // The gauge's dot settles once per card per opening of the note, not on every filter change.
  const settled = React.useRef(new Set<string>());
  React.useEffect(() => {
    for (const c of board.cards) settled.current.add(c.id);
  });
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const cards = board.cards.filter((c) => matches(c, filter) && (drafts || !c.draft) && search(c, words));
  const active = cards.filter((c) => !c.usedRecently);
  const resting = cards.filter((c) => c.usedRecently);
  // The card the board points at: the best fit not prepared yet (its Confirm, else its Prepare, is the accent).
  const pick = active.find((c) => c.status === "fit" && !props.prepared.has(c.id))?.id;
  const profile = board.profile;
  const share = (n: number) => `${total > 0 ? (n / total) * 100 : 0}%`;

  // Left to right: the danger rises, as on each card's gauge.
  const segments: Array<{ key: Exclude<Filter, "all">; n: number; label: string }> = [
    { key: "too-easy", n: counts.tooEasy, label: "too easy" },
    { key: "fit", n: counts.fit, label: "fit" },
    { key: "too-hard", n: counts.tooHard, label: "too hard" },
    { key: "check", n: counts.needsCheck, label: "to measure" },
  ];

  const header = (
    <header className="rpg-enc-party">
      <span className="rpg-enc-pcs">{board.party.pcs.join(" · ")}</span>
      <div className="rpg-enc-chips">
        {profile ? (
          <>
            <span className="rpg-enc-chip is-tier">Tier {profile.tier}</span>
            <span className="rpg-enc-chip">
              {profile.size} PCs · level {profile.averageLevel}
            </span>
            <span className="rpg-enc-chip" title="The total CR at which a fight turns challenging">
              challenging at CR {profile.benchmark}
            </span>
            <span className="rpg-enc-chip" title="The CR range of one monster this party can face">
              one foe CR {profile.singleCr.replace("-", "–")}
            </span>
          </>
        ) : (
          <span className="rpg-enc-chip">not measured yet</span>
        )}
        <span className="rpg-enc-chip">{board.difficulty}</span>
        <span className="rpg-enc-chip">session {board.session}</span>
      </div>
    </header>
  );

  if (board.cards.length === 0 && counts.otherTier === 0) {
    const names = board.party.pcs;
    const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
    return (
      <section className="rpg-enc-board">
        {header}
        <div className="rpg-enc-first">
          <p className="rpg-enc-first-title">Nothing on file yet to throw at {who || "the party"}.</p>
          <p>Fill the catalog from a random-encounter table you own:</p>
          <CopyCommand command="rpg sim catalog draft <table note> --accept" onCopy={props.onCopy} />
          <p>Or ask for three fights that fit them now:</p>
          <CopyCommand command="rpg sim plan" onCopy={props.onCopy} />
        </div>
      </section>
    );
  }

  return (
    <section className="rpg-enc-board">
      {header}
      <div className={`rpg-enc-strip${measuredAny ? "" : " is-unmeasured"}`} aria-hidden="true">
        {segments.map((s) =>
          s.n > 0 ? (
            <span key={s.key} className={`rpg-enc-strip-seg is-${s.key}`} style={{ width: share(s.n) }} />
          ) : null
        )}
      </div>
      <p className="rpg-enc-story">{storyOf(board)}</p>
      <div className="rpg-enc-legend" role="group" aria-label="Show encounters that">
        {segments.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={filter === s.key}
            className={`rpg-enc-legend-item is-${s.key}`}
            onClick={() => setFilter(filter === s.key ? "all" : s.key)}
          >
            <i aria-hidden="true" /> {s.n} {s.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={filter === "all"}
          className="rpg-enc-legend-item"
          onClick={() => setFilter("all")}
        >
          all {total}
        </button>
        <span className="rpg-enc-key" aria-hidden="true">
          <i className="rpg-enc-key-band" /> a fair fight
        </span>
      </div>

      <div className="rpg-enc-tools">
        <input
          type="search"
          className="rpg-enc-search"
          placeholder="Search fights"
          aria-label="Search names, tags, monsters and scenes"
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
        {counts.otherTier > 0 && <span className="rpg-enc-muted">{counts.otherTier} from other tiers set aside</span>}
      </div>

      {!profile || counts.needsCheck > 0 ? (
        <div className="rpg-enc-callout">
          <p>
            {measuredAny
              ? `${counts.needsCheck} ${counts.needsCheck === 1 ? "fight needs" : "fights need"} measuring against ${board.party.name || "the party"} as it is now.`
              : `These ${counts.needsCheck} fights haven't met ${board.party.name || "your party"} yet. Measure them and each card will show what it costs them.`}
          </p>
          <CopyCommand command="rpg sim catalog check" onCopy={props.onCopy} />
        </div>
      ) : null}

      <h2 className="rpg-enc-visually-hidden">Encounters</h2>
      {active.length === 0 && resting.length === 0 ? (
        <p className="rpg-enc-empty">
          {filter === "all" && words.length === 0
            ? "No encounter for this party's tier. Turn on lower tiers, or ask for new ones with rpg sim plan."
            : "No encounter matches. Clear the search or pick another filter."}
        </p>
      ) : (
        <div className="rpg-enc-cards">
          {active.slice(0, shown).map((card) => (
            <Card
              key={card.id}
              card={card}
              board={board}
              highlight={card.id === pick}
              settle={!settled.current.has(card.id)}
              openNote={props.openNote}
              onConfirm={props.onConfirm}
              preparedIn={props.prepared.get(card.id)}
              canPrepare={!!props.sessionName}
              onPrepare={props.onPrepare}
              onUnprepare={props.onUnprepare}
              onTags={props.onTags}
            />
          ))}
        </div>
      )}
      {active.length > shown && (
        <button type="button" className="rpg-enc-more" onClick={() => setShown(shown + PAGE)}>
          Show {Math.min(PAGE, active.length - shown)} more of {active.length - shown}
        </button>
      )}
      {resting.length > 0 && (
        <>
          <h3 className="rpg-enc-resting-title">
            Resting until session {Math.min(...resting.map((c) => c.restingUntil ?? board.session))}
          </h3>
          <div className="rpg-enc-cards">
            {resting.map((card) => (
              <Card
                key={card.id}
                card={card}
                board={board}
                highlight={false}
                settle={false}
                openNote={props.openNote}
                onConfirm={props.onConfirm}
                preparedIn={props.prepared.get(card.id)}
                canPrepare={!!props.sessionName}
                onPrepare={props.onPrepare}
                onUnprepare={props.onUnprepare}
                onTags={props.onTags}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** One `rpg encounter` block as a single line: the YAML stays in source mode. */
export function EncounterRow({ card, openNote }: { card: BoardCard; openNote: (path: string) => void }) {
  return (
    <div className={`rpg-enc-row is-${card.status}`} title={card.scene}>
      <span className={`rpg-enc-dot is-${card.status}`} aria-hidden="true" />
      <span className="rpg-enc-row-name">{card.title}</span>
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
        {card.outcome ? `${pct(card.outcome.avgHpLost)} HP` : STATUS_LABEL[card.status]}
        {card.byline ? ` · ${card.byline}` : ""}
        {card.draft ? " · draft" : ""}
      </span>
    </div>
  );
}
