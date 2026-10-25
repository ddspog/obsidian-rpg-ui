/**
 * The session's bookkeeping — what the log changed on each party member's
 * sheet (hit points, uses, spell slots, inventory) — in the Log's own voice:
 * a tray under the card drawer, one small card per character headed by their
 * `@` squircle, each change a Log-style row (icon, small-caps label, `10 → 6`
 * with the result bold) and a quiet "write" to put it on the sheet.
 *
 * A change is done once its sheet shows it — and stays done, though later
 * logs move the sheet on: each log keeps its own tally. Done ones fold away
 * behind the header's "Written" toggle.
 */

import * as React from "react";
import { Lucide } from "lib/ui/primitives/Lucide";
import { ActorPill } from "./action-call";
import { InlineMarkdown } from "./inline-markdown";
import { rowId, type BookkeepingRow } from "lib/domains/session-log/bookkeeping";
import { isGain, type InventoryChange } from "lib/domains/session-log/inventory-changes";

export interface SessionBookkeepingProps {
  rows: BookkeepingRow[];
  inventory: InventoryChange[];
  sourcePath: string;
  /** Whether the owner's sheet lists the item; undefined when the owner is no PC. */
  sheetHas: (owner: string | undefined, item: string) => boolean | undefined;
  /** Each party member's note, by the name the log writes (`Talon` → `Talon Pallton`). */
  pageOf: (who: string) => string | undefined;
  /** Write a change to its sheet. */
  onApply?: (row: BookkeepingRow) => void;
  /** Write every change still to make. */
  onApplyAll?: (rows: BookkeepingRow[]) => void;
  /** Count a character's changes from their sheet as it is now. */
  onRecount?: (who: string) => void;
  /** The changes seen on the sheets already (`rowId`s, items too) — done for good. */
  doneIds?: Set<string>;
  /** Told of the changes the sheets show now, to remember them done. */
  onSeen?: (ids: string[]) => void;
  /** Jump to the log entry an item was recorded in. */
  onSelectSource?: (id: number) => void;
}

/** One line of the tally: a sheet change or an item. */
type Entry =
  | { kind: "sheet"; row: BookkeepingRow }
  | { kind: "item"; change: InventoryChange; ok: boolean | undefined; status?: string };

/** `+1`, `−2`, `×3`, or nothing when the log gave no count. */
function countOf(c: InventoryChange): string {
  if (c.depleted) return "depleted";
  if (c.quantity != null) return `×${c.quantity}`;
  if (c.delta == null) return "";
  return c.delta < 0 ? `−${-c.delta}` : `+${c.delta}`;
}

/** What an item's change asks of its owner's sheet, and whether it shows it. */
function itemStatus(c: InventoryChange, onSheet: boolean | undefined): { ok: boolean; label: string } | undefined {
  if (onSheet === undefined) return undefined;
  if (isGain(c)) return onSheet ? { ok: true, label: "on sheet" } : { ok: false, label: "add to sheet" };
  return onSheet ? { ok: false, label: "still on sheet" } : { ok: true, label: "off sheet" };
}

/** An item change's identity, to remember it done. */
const itemId = (c: InventoryChange) =>
  `${c.owner ?? ""}\u0000item\u0000${c.path ? `${c.path.join("/")}/` : ""}${c.name}\u0000${countOf(c)}`;

/** Each kind of change's icon, as the Log draws its rows'. */
const ICONS: Record<string, string> = {
  hp: "Heart",
  uses: "Gauge",
  slot: "Sparkles",
  saves: "Skull",
  xp: "Star",
  counter: "Hash",
  ammo: "Crosshair",
  note: "PencilLine",
  item: "Backpack",
};

function RowIcon({ kind }: { kind: string }) {
  const Comp = (Lucide as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[
    ICONS[kind] ?? "Dot"
  ];
  return (
    <span className="lonelog-bookkeeping-icon">{Comp ? <Comp size={14} className="lonelog-row-lucide" /> : null}</span>
  );
}

/** A change as the Log writes a result: `10 → 6/10 −4`; a spend as what's
 *  left of its most (`2 → 1/2 left −1`), as the sheet's pips read. */
function Progress({ row }: { row: BookkeepingRow }) {
  if (row.kind === "note") return <b className="lonelog-formula-result">−{row.target}</b>;
  // A spend with a most counts down what's left; without one, up what's spent.
  const left = row.spends && row.max != null;
  const from = left ? row.max! - row.from : row.from;
  const to = left ? row.max! - row.target : row.target;
  const delta = to - from;
  // Losing what's left reads as loss (HP, hit dice, uses, slots, failed saves marked).
  const loss =
    row.kind === "saves"
      ? row.key === "failures"
        ? delta > 0
        : delta < 0
      : row.key === "Exhaustion" || (row.spends && !left)
        ? delta > 0
        : delta < 0;
  return (
    <>
      <span className="lonelog-bookkeeping-from">{from}</span>
      <span className="lonelog-formula-yields">→</span>
      <b className="lonelog-formula-result">{to}</b>
      {row.max != null && <span className="lonelog-bookkeeping-max">/{row.max}</span>}
      {row.spends && <span className="lonelog-bookkeeping-max">{left ? " left" : " spent"}</span>}
      {row.kind === "counter" && row.key === "Hit Dice" && <span className="lonelog-bookkeeping-max"> left</span>}
      {delta !== 0 && (
        <span className={`lonelog-bookkeeping-delta ${loss ? "is-loss" : "is-gain"}`}>
          {delta > 0 ? `+${delta}` : `−${-delta}`}
        </span>
      )}
      {row.short != null && (
        <span className="lonelog-bookkeeping-short" title="The log spends more than the sheet had when it began">
          short by {row.short}
        </span>
      )}
    </>
  );
}

/** What a write will change, per character, with a Write and a Cancel. */
const ReviewPanel = React.forwardRef<
  HTMLElement,
  { rows: BookkeepingRow[]; onConfirm: () => void; onCancel: () => void }
>(function ReviewPanel({ rows, onConfirm, onCancel }, ref) {
  const byWho = new Map<string, BookkeepingRow[]>();
  for (const row of rows) byWho.set(row.who ?? "Party", [...(byWho.get(row.who ?? "Party") ?? []), row]);
  const headingId = React.useId();
  return (
    <section
      ref={ref}
      className="lonelog-bookkeeping-review"
      aria-labelledby={headingId}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <h4 id={headingId}>
        Write {rows.length} {rows.length === 1 ? "change" : "changes"} to{" "}
        {byWho.size === 1 ? "the sheet" : "the sheets"}?
      </h4>
      <dl>
        {[...byWho].map(([who, list]) => (
          <div key={who}>
            <dt>{who}</dt>
            {list.map((row) => (
              <dd key={rowId(row)}>
                <span className="lonelog-row-label">{row.label}</span>
                <span className="lonelog-bookkeeping-value">
                  <Progress row={row} />
                </span>
              </dd>
            ))}
          </div>
        ))}
      </dl>
      <div className="lonelog-bookkeeping-review-actions">
        <button type="button" className="is-primary" data-confirm onClick={onConfirm}>
          Write {rows.length} {rows.length === 1 ? "change" : "changes"}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
});

export function SessionBookkeeping({
  rows,
  inventory,
  sourcePath,
  sheetHas,
  pageOf,
  onApply,
  onApplyAll,
  onRecount,
  doneIds,
  onSeen,
  onSelectSource,
}: SessionBookkeepingProps) {
  const [showWritten, setShowWritten] = React.useState(false);
  // The changes waiting on a confirmation, and whether they're the whole set ("Write all").
  const [review, setReview] = React.useState<{ rows: BookkeepingRow[]; all: boolean } | null>(null);
  const reviewRef = React.useRef<HTMLElement>(null);
  // Named by its heading — an `aria-label` would show as Obsidian's tooltip.
  const headingId = React.useId();

  // Each character in the order the log first changed them; the party's shared items last.
  const people: Array<string | undefined> = [];
  const entries = new Map<string | undefined, Entry[]>();
  const add = (who: string | undefined, e: Entry) => {
    if (!entries.has(who)) {
      entries.set(who, []);
      people.push(who);
    }
    entries.get(who)!.push(e);
  };
  for (const row of rows) add(row.who, { kind: "sheet", row });
  for (const c of inventory) {
    const st = itemStatus(c, sheetHas(c.owner, c.name));
    add(c.owner, { kind: "item", change: c, ok: st?.ok, ...(st ? { status: st.label } : {}) });
  }
  people.sort((a, b) => (a === undefined ? 1 : 0) - (b === undefined ? 1 : 0));

  // What the sheets show now is done for good — remembered, for when later logs move them on.
  const idOf = (e: Entry) => (e.kind === "sheet" ? rowId(e.row) : itemId(e.change));
  const shows = (e: Entry) => (e.kind === "sheet" ? e.row.ok : e.ok === true);
  const seen = [...entries.values()].flat().filter(shows).map(idOf);
  const seenKey = seen.join("\u0001");
  React.useEffect(() => {
    if (seen.length > 0) onSeen?.(seen);
  }, [seenKey]);
  // Bring the review into view and put the keyboard on its Write button.
  React.useEffect(() => {
    if (!review) return;
    const el = reviewRef.current;
    el?.scrollIntoView?.({ block: "nearest" });
    el?.querySelector<HTMLButtonElement>("button[data-confirm]")?.focus({ preventScroll: true });
  }, [review]);
  if (people.length === 0) return null;

  // Written once, but the sheet has moved since (set back by hand): not done —
  // it shows with what's left to write, offered to write again.
  const drifts = (e: Entry) => e.kind === "sheet" && e.row.kind !== "note" && !e.row.ok && !!doneIds?.has(idOf(e));
  const isDone = (e: Entry) => shows(e) || (!!doneIds?.has(idOf(e)) && !drifts(e));
  const all = [...entries.values()].flat();
  const writable = all.flatMap((e) => (e.kind === "sheet" && e.row.kind !== "note" && !isDone(e) ? [e.row] : []));
  const toWrite = all.filter((e) => !isDone(e)).length;
  const written = all.length - toWrite;

  const source = (c: InventoryChange) =>
    onSelectSource && c.sources.length > 0 ? (
      <button
        type="button"
        className="lonelog-bookkeeping-write is-quiet"
        title="Show where the log records it"
        aria-label={`Show where the log records ${c.name}`}
        onClick={() => onSelectSource(c.sources[0])}
      >
        ↵
      </button>
    ) : (
      <span />
    );

  const tick = (label: string) => (
    <span className="lonelog-bookkeeping-tick" aria-label={label}>
      ✓
    </span>
  );

  const changeRow = (e: Entry) => {
    const done = isDone(e);
    if (e.kind === "item") {
      const c = e.change;
      return (
        <dd key={idOf(e)} className={`lonelog-bookkeeping-change${done ? " is-done" : ""}`}>
          <RowIcon kind="item" />
          <span className="lonelog-row-label">
            {c.link ? <InlineMarkdown source={`[[${c.name}]]`} sourcePath={sourcePath} /> : c.name}
            {/* Where in its holder it goes: `in Pouch`, `in Backpack › Quiver`. */}
            {c.path && <small className="lonelog-bookkeeping-status"> in {c.path.join(" › ")}</small>}
          </span>
          <span className="lonelog-bookkeeping-value">
            {countOf(c) && <b className="lonelog-formula-result">{countOf(c)}</b>}
            {e.status && !done && <small className="lonelog-bookkeeping-status">{e.status}</small>}
          </span>
          {done ? tick("On the sheet") : source(c)}
        </dd>
      );
    }
    const row = e.row;
    // Done once, but the sheet has moved since (set back by hand, a rest, a
    // later log): what it shows now, and a way to write this log's again.
    const drifted = drifts(e);
    const sheetNow = row.spends && row.max != null ? row.max - row.sheet : row.sheet;
    return (
      <dd key={idOf(e)} className={`lonelog-bookkeeping-change${done ? " is-done" : ""}`}>
        <RowIcon kind={row.kind} />
        <span className="lonelog-row-label">{row.label}</span>
        <span className="lonelog-bookkeeping-value">
          <Progress row={row} />
          {row.kind === "note" && <small className="lonelog-bookkeeping-status">by hand</small>}
          {drifted && (
            <small className="lonelog-bookkeeping-status" title="Written once; the sheet has changed since">
              sheet now {sheetNow}
            </small>
          )}
        </span>
        {drifted && onApply ? (
          <button
            type="button"
            className="lonelog-bookkeeping-write is-quiet"
            title={`The sheet shows ${sheetNow} now — write this log's ${row.label} to ${row.who}'s sheet again`}
            onClick={() => setReview({ rows: [row], all: false })}
          >
            rewrite
          </button>
        ) : done ? (
          tick("Written to the sheet")
        ) : row.kind !== "note" && onApply ? (
          <button
            type="button"
            className="lonelog-bookkeeping-write"
            title={`Review, then write ${row.label} to ${row.who}'s sheet`}
            onClick={() => setReview({ rows: [row], all: false })}
          >
            write
          </button>
        ) : (
          <span />
        )}
      </dd>
    );
  };

  return (
    <section aria-labelledby={headingId} className="lonelog-bookkeeping">
      <hgroup className="lonelog-bookkeeping-head">
        <h3 id={headingId}>Bookkeeping</h3>
        <p>{toWrite > 0 ? `${toWrite} to write` : "All written"}</p>
        <menu>
          {writable.length > 1 && onApplyAll && (
            <li>
              <button
                type="button"
                className="lonelog-bookkeeping-tool"
                onClick={() => setReview({ rows: writable, all: true })}
              >
                Write all
              </button>
            </li>
          )}
          {written > 0 && (
            <li>
              <button
                type="button"
                className={`lonelog-bookkeeping-tool${showWritten ? " is-on" : ""}`}
                aria-pressed={showWritten}
                onClick={() => setShowWritten((v) => !v)}
              >
                ✓ Written {written}
              </button>
            </li>
          )}
        </menu>
      </hgroup>
      {review && (
        <ReviewPanel
          ref={reviewRef}
          rows={review.rows}
          onCancel={() => setReview(null)}
          onConfirm={() => {
            if (review.all || review.rows.length > 1) onApplyAll?.(review.rows);
            else onApply?.(review.rows[0]);
            setReview(null);
          }}
        />
      )}
      <div className="lonelog-bookkeeping-sheets">
        {people.map((who) => {
          const list = entries.get(who)!.filter((e) => showWritten || !isDone(e));
          if (list.length === 0) return null;
          const page = who ? pageOf(who) : undefined;
          const recountable = entries.get(who)!.some((e) => e.kind === "sheet" && e.row.kind !== "note");
          return (
            <dl key={who ?? "\u0000party"} className="lonelog-bookkeeping-sheet">
              <dt>
                {who ? <ActorPill label={who} {...(page ? { page } : {})} sourcePath={sourcePath} /> : "Party"}
                {who && onRecount && recountable && (
                  <button
                    type="button"
                    className="lonelog-bookkeeping-recount"
                    aria-label={`Count ${who}'s changes from their sheet as it is now`}
                    title="Count from the sheet as it is now — when it had these already"
                    onClick={() => onRecount(who)}
                  >
                    ↺
                  </button>
                )}
              </dt>
              {list.map(changeRow)}
            </dl>
          );
        })}
      </div>
    </section>
  );
}
