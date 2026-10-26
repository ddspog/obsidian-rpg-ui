/**
 * The battle map pane — for a fight bound to a map: the head of the fight's
 * entries in the Log sidebar (sticking while they scroll, zoomed on each turn's
 * action), or (Log closed) a backdrop behind the prose. It shows the battle as of the entry being read: where everyone stands,
 * who's acting, the turn's moves and attacks, HP and conditions. Under it, the
 * timeline steps through the fight round by round, turn by turn; stepping
 * scrolls the prose along.
 */

import {
  ChevronLeft,
  ChevronRight,
  Check,
  Dices,
  Map as MapIcon,
  Move,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Smile,
  X,
} from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import { frameAt, type Battle, type BattleFrame, type BattlePlacement } from "../../domains/battlemap/battle";
import { squareName, type Square, type SquareMap } from "../../domains/battlemap/square-map";
import { setIcon, setInitiative, setStartSquare } from "../../domains/battlemap/setup-edits";
import { defaultTokens } from "../../domains/battlemap/render-map-block";
import { matchActor } from "../../domains/session-log/actors";
import { isDown, type FoeAt } from "../../domains/session-log/foes";
import { combatantKey } from "../../domains/session-log/initiative";
import { SquareMapView, shownName, type MapArrow, type MapToken, type MapView } from "./square-map-view";

/** How an attack went, as the log's hit tracking has it. */
interface AttackOutcome {
  hit?: boolean;
  damage: number;
}

/** Tokens' pictures: what each shows, and the right-click menu changing it. */
export interface TokenPictures {
  /** A combatant's picture (`token_image:` in their note), as a URL. */
  imageOf: (name: string) => string | undefined;
  /** Right-click on a combatant's token: the menu to change its picture. */
  menu: (name: string, event: MouseEvent) => void;
  /** Called whenever a token's picture may have changed; gives back the unsubscribe. */
  watch: (changed: () => void) => () => void;
}

interface BattlePaneProps {
  battles: Battle[];
  maps: Record<string, SquareMap>;
  /** The log entry being read (by its source id), or null at the top. */
  readingId: number | null;
  /** Go to an entry — the pane's timeline moves the prose with it. */
  onSeek: (id: number) => void;
  /** Foes and their health, by the entry they're mentioned in. */
  foesAt: Map<number, FoeAt[]>;
  /**
   * `panel` — the full pane (map, timeline), drawn in the Log sidebar where the
   * fight starts. `backdrop` — behind the prose, faded, with a compact control
   * chip; shown only while the fight is being read.
   */
  variant?: "panel" | "backdrop";
  /** The fight to show (panel: the one whose start this entry is). */
  battleStart?: number;
  /** Close in on each turn's action instead of showing the whole map. */
  zoom?: boolean;
  /** A combatant's token emoji (`token:` in its note), if it has one. */
  iconOf?: (name: string) => string | undefined;
  /** Tokens' pictures — given, a token can be right-clicked to change its own. */
  pictures?: TokenPictures;
  /** Open the map's own note, when it has one (the title becomes a link to it). */
  onOpenMap?: (map: string) => void;
  /**
   * Change the fight's setup — given, the Setup frame's tokens can be clicked
   * to move where they start, roll their initiative, or give them an emoji.
   * Takes an edit to the log's body.
   */
  onSetup?: (edit: (body: string) => string) => void;
  /** A combatant's Initiative modifier, for rolling it (from sheet or statblock). */
  initiativeOf?: (name: string) => Promise<number | undefined>;
  /** Anyone's hit points as of an entry — party and foes — for the HP rings. */
  healthAt?: (id: number, name: string) => { current: number; max: number } | undefined;
  /** How an entry's attack went — a hit (and its damage) or a miss. */
  hitAt?: (id: number) => AttackOutcome | undefined;
  /**
   * A stretch of the fight this map tells — one turn, in the text (`from` its
   * marker, up `to` the next). It shows the step being read when that falls in
   * it, else how the stretch begins.
   */
  within?: { from: number; to?: number };
  /** Title the map on another line (the fight's header) instead of its own —
   *  where its icon, name and step go; null until that line is there. */
  headInto?: HTMLElement | null;
}

/** The fight the reader is in: the one around the entry being read, else the
 *  last one before it, else the first. */
function currentBattle(battles: Battle[], id: number | null): Battle | undefined {
  if (id == null) return battles[0];
  let found: Battle | undefined;
  for (const b of battles) {
    if (b.start <= id) found = b;
  }
  return found ?? battles[0];
}

/** Every foe's health as of an entry: the latest mention at or before it. */
function foesAsOf(foesAt: Map<number, FoeAt[]>, id: number): Map<string, FoeAt> {
  const out = new Map<string, FoeAt>();
  for (const [at, foes] of [...foesAt.entries()].sort((a, b) => a[0] - b[0])) {
    if (at > id) break;
    for (const f of foes) out.set(combatantKey(f.name), f);
  }
  return out;
}

/** The pieces of a frame the map draws: its tokens and its arrows. */
function drawFrame(
  map: SquareMap,
  frame: BattleFrame | undefined,
  foes: Map<string, FoeAt>,
  opening: BattlePlacement[] = [],
  iconOf?: (name: string) => string | undefined,
  hpOf?: (name: string) => { current: number; max: number } | undefined,
  hitOf?: (id: number) => AttackOutcome | undefined,
  imageOf?: (name: string) => string | undefined
): { tokens: MapToken[]; arrows: MapArrow[] } {
  // Before anything happens: where the initiative list put everyone, else the
  // map's own default spots.
  const placements =
    frame && frame.placements.length > 0 ? frame.placements : opening.length > 0 ? opening : defaultTokens(map);
  const keys = placements.map((p) => combatantKey(p.name));
  const indexOf = (name: string) => {
    const k = keys.indexOf(combatantKey(name));
    return k >= 0
      ? k
      : matchActor(
          name,
          keys.map((key) => ({ name: key }))
        );
  };
  const actor = frame?.actor ? indexOf(frame.actor) : -1;

  // A foe is one the log tags as one (`[F:…]`). Only a log with no foe tags at
  // all falls back on the name: a linked one is a creature from a statblock —
  // but a party written as links (`[[Talon Pallton]]`) stays the party.
  const tokens: MapToken[] = placements.map((p, i) => {
    const foe = foes.get(combatantKey(p.name));
    const icon = iconOf?.(p.name);
    const image = imageOf?.(p.name);
    const hp = hpOf?.(p.name);
    // PCs' and foes' conditions alike, as the fight tracks them.
    const conditions = frame?.conditions[combatantKey(p.name)] ?? foe?.conditions ?? [];
    return {
      name: p.name,
      at: p.at,
      side: foe || (foes.size === 0 && p.name.includes("[[")) ? "foe" : "pc",
      ...(icon ? { icon } : {}),
      ...(image ? { image } : {}),
      // Health as the log follows it (hits taken), else the foe tag's.
      ...((hp?.current ?? foe?.current) != null ? { hp: (hp?.current ?? foe?.current)! } : {}),
      ...((hp?.max ?? foe?.max) != null ? { max: (hp?.max ?? foe?.max)! } : {}),
      // Out of it: a foe marked down, or anyone the fight has left at 0 HP (KO).
      ...((foe && isDown(foe)) || hp?.current === 0 ? { down: true } : {}),
      ...(hp?.current === 0 ? { ko: true } : {}),
      ...(conditions.length ? { conditions } : {}),
      ...(i === actor ? { active: true } : {}),
    };
  });

  const arrows: MapArrow[] = [
    // Moves before the action, then after it — told apart on the map.
    ...(frame?.moves ?? [])
      .filter((m) => m.path.length > 1)
      .map((m) => ({ kind: m.after ? ("after" as const) : ("move" as const), path: m.path })),
    ...(frame?.attacks ?? []).flatMap((a) => {
      const from = indexOf(a.from);
      const to = indexOf(a.to);
      if (from < 0 || to < 0) return [];
      // How it went: a hit with its damage, or a miss (unknown until rolled).
      const outcome = hitOf?.(a.id);
      const result: MapArrow["result"] =
        outcome?.hit === false ? "miss" : outcome && (outcome.hit || outcome.damage > 0) ? "hit" : undefined;
      const note =
        result === "miss" ? "miss" : result === "hit" && outcome!.damage > 0 ? `−${outcome!.damage}` : undefined;
      return [
        {
          kind: "attack" as const,
          // From where both stood as it was made (a move after it doesn't move the strike).
          path: [a.fromAt ?? placements[from].at, a.toAt ?? placements[to].at],
          ...(result ? { result } : {}),
          ...(note ? { note } : {}),
        },
      ];
    }),
  ];
  return { tokens, arrows };
}

/** Squares of room kept around the action when zoomed. */
const ZOOM_PAD = 2;
/** The narrowest a zoomed view gets, in columns — close, but still a place. */
const ZOOM_MIN_COLS = 9;
/** The zoomed window's shape: wide, so the map leaves the Log room to scroll. */
const ZOOM_ASPECT = 16 / 9;

/**
 * The part of the map a turn needs: the creature acting, the path it moved and
 * whoever it struck — or, on a turn with no action (setting up, a new round),
 * everyone on the map. Padded, never narrower than ZOOM_MIN_COLS, and always
 * ZOOM_ASPECT wide, so the pane keeps its size as the view moves; a view wider
 * (or taller) than the map itself centres the map in it.
 */
function actionView(map: SquareMap, tokens: MapToken[], arrows: MapArrow[]): MapView | undefined {
  if (map.cols === 0 || map.rows === 0) return undefined;
  let squares = [...tokens.filter((t) => t.active).map((t) => t.at), ...arrows.flatMap((a) => a.path)];
  if (squares.length === 0) squares = tokens.map((t) => t.at);
  const whole = { c0: 0, c1: map.cols - 1, r0: 0, r1: map.rows - 1 };
  const cols = squares.map((s) => s.col);
  const rows = squares.map((s) => s.row);
  const { c0, c1, r0, r1 } = squares.length
    ? { c0: Math.min(...cols), c1: Math.max(...cols), r0: Math.min(...rows), r1: Math.max(...rows) }
    : whole;

  // Wide enough for the action and its room, in the window's shape — but no
  // bigger than it takes to hold the whole map.
  const widest = Math.max(map.cols, map.rows * ZOOM_ASPECT);
  const w = Math.min(
    widest,
    Math.max(c1 - c0 + 1 + 2 * ZOOM_PAD, (r1 - r0 + 1 + 2 * ZOOM_PAD) * ZOOM_ASPECT, ZOOM_MIN_COLS)
  );
  const h = w / ZOOM_ASPECT;
  const place = (centre: number, size: number, span: number) =>
    size >= span ? (span - size) / 2 : Math.max(0, Math.min(span - size, centre - size / 2));
  return { col: place((c0 + c1 + 1) / 2, w, map.cols), row: place((r0 + r1 + 1) / 2, h, map.rows), cols: w, rows: h };
}

export function BattlePane({
  battles,
  maps,
  readingId,
  onSeek,
  foesAt,
  variant = "panel",
  battleStart,
  zoom = false,
  iconOf,
  pictures,
  onOpenMap,
  onSetup,
  initiativeOf,
  healthAt,
  hitAt,
  within,
  headInto,
}: BattlePaneProps) {
  const battle =
    battleStart != null
      ? (battles.find((b) => b.start === battleStart) ?? currentBattle(battles, readingId))
      : currentBattle(battles, readingId);
  const map = battle ? maps[battle.map] : undefined;
  const [playing, setPlaying] = React.useState(false);
  // The Setup frame's editing: the token picked, and what's being done to it.
  const [picked, setPicked] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"menu" | "move" | "emoji">("menu");
  const [emoji, setEmoji] = React.useState("");
  // A token's picture changed (in its note): draw the map again.
  const [, redraw] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => pictures?.watch(redraw), [pictures]);

  // The fight's steps, opening with its Setup: everyone where the initiative
  // list (or a `[Pos:]` before the first turn) puts them, at the `[COMBAT]`.
  // Only the steps where something happens on the map: someone acts, moves or
  // strikes, a turn begins, or where they stand or what ails them changes. A
  // line of dialogue or narration is no step — the replay passes it by.
  const frames = React.useMemo<BattleFrame[]>(() => {
    if (!battle) return [];
    const setup: BattleFrame = {
      id: battle.start,
      round: 0,
      placements: battle.opening,
      moves: [],
      attacks: [],
      conditions: {},
    };
    const all = battle.frames[0]?.round === 0 ? battle.frames : [setup, ...battle.frames];
    const where = (f: BattleFrame) => f.placements.map((p) => `${p.name}@${p.at.col},${p.at.row}`).join(";");
    const ails = (f: BattleFrame) => JSON.stringify(f.conditions);
    const kept = all.filter((f, i) => {
      const prev = all[i - 1];
      return (
        !prev ||
        !!f.actor ||
        f.moves.length > 0 ||
        f.attacks.length > 0 ||
        f.round !== prev.round ||
        where(f) !== where(prev) ||
        ails(f) !== ails(prev)
      );
    });
    // A fight that marks its rounds (`R(Kobold, Tinkerer)`) steps a round at a
    // time: everything done in it at once — each move, each attack — with where
    // everyone ends it. Without round markers, each action is its own step.
    if (!all.some((f) => f.slot)) return kept;
    const steps: BattleFrame[] = [];
    for (const f of kept) {
      const last = steps[steps.length - 1];
      if (!last || f.slot || f.round !== last.round) {
        steps.push({ ...f, moves: [...f.moves], attacks: [...f.attacks] });
        continue;
      }
      last.moves.push(...f.moves);
      last.attacks.push(...f.attacks);
      last.placements = f.placements;
      last.conditions = f.conditions;
      if (!last.actor && f.actor) last.actor = f.actor;
    }
    return steps;
  }, [battle]);
  const last = frames[frames.length - 1];
  const inFight = !!battle && readingId != null && readingId >= battle.start && (!last || readingId <= last.id + 1);
  // Reading past the fight shows how it ended; before it, how it starts.
  const inStretch = (id: number) => !within || (id >= within.from && (within.to == null || id < within.to));
  const frame = within
    ? battle && readingId != null && inStretch(readingId)
      ? (frameAt({ ...battle, frames }, readingId) ?? frames[0])
      : (frames.find((f) => f.id >= within.from) ?? frames[0])
    : battle && readingId != null && readingId >= battle.start
      ? (frameAt({ ...battle, frames }, readingId) ?? frames[0])
      : frames[0];
  const index = frame ? frames.indexOf(frame) : -1;
  // The step's last entry — just before the next step, else the fight's end.
  const stepEnd = frames[index + 1] ? frames[index + 1].id - 1 : (battle?.end ?? last?.id ?? battle?.start ?? 0);

  // Play: step through the turns on their own, stopping at the last.
  React.useEffect(() => {
    if (!playing) return;
    if (index >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => onSeek(frames[index + 1].id), 1200);
    return () => window.clearTimeout(timer);
  }, [playing, index, frames, onSeek]);

  if (!battle) return null;
  if (!map) {
    return (
      <aside className="lonelog-battle-pane is-missing" aria-label="Battle map">
        <p className="lonelog-battle-missing">No `rpg map` found in {shownName(battle.map)}.</p>
      </aside>
    );
  }

  // Before the first turn: the fight's setup, which can be changed from here.
  const atSetup = !frame || frame.round === 0;
  const editing = !!onSetup && atSetup;

  const { tokens, arrows } = drawFrame(
    map,
    frame,
    foesAsOf(foesAt, frame?.id ?? battle.start),
    battle.opening,
    // The fight's own emoji (`🐸` in its initiative list) over the page's.
    (name) => battle.icons[combatantKey(name)] ?? iconOf?.(name),
    // Health as the step leaves it — after every action it holds.
    healthAt ? (name) => healthAt(stepEnd, name) : undefined,
    hitAt,
    pictures?.imageOf
  );
  // ── Setup editing ──
  const token = editing && picked ? tokens.find((t) => t.name === picked) : undefined;
  const unrolled = tokens.filter((t) => !battle.rolled.includes(combatantKey(t.name)));
  const done = () => {
    setPicked(null);
    setMode("menu");
  };
  /** Roll d20 + its Initiative for each, and write the rolls in. */
  const rollFor = async (names: string[]) => {
    if (!onSetup) return;
    const rolls = await Promise.all(
      names.map(async (name) => {
        const mod = await initiativeOf?.(name);
        const face = 1 + Math.floor(Math.random() * 20);
        return { name, roll: mod != null ? "d20+[[Initiative]]=" : "d20=", total: face + (mod ?? 0) };
      })
    );
    onSetup((body) => rolls.reduce((b, r) => setInitiative(b, battle.fight, r.name, r.roll, r.total), body));
    done();
  };
  const placeAt = (sq: Square) => {
    if (!onSetup || !token) return;
    const name = token.name;
    onSetup((body) => setStartSquare(body, battle.fight, name, squareName(sq)));
    done();
  };
  // Setup lives in the pane's own two slots, never a row of its own: the
  // header's right says who's picked (or what to do), and the button column
  // trades replay for that creature's actions while one is.
  const setupWhere = !editing ? null : !token ? null : mode === "move" ? (
    <span className="lonelog-battle-where is-setup">Pick a square for {shownName(token.name)}</span>
  ) : mode === "emoji" ? (
    <form
      className="lonelog-battle-setup-emoji"
      onSubmit={(e) => {
        e.preventDefault();
        const name = token.name;
        onSetup?.((body) => setIcon(body, battle.fight, name, emoji));
        done();
      }}
    >
      <input
        value={emoji}
        onChange={(e) => setEmoji(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setMode("menu")}
        placeholder="🐸"
        aria-label={`${shownName(token.name)}'s emoji for this fight (blank: their page's)`}
        size={3}
        autoFocus
      />
    </form>
  ) : (
    <span className="lonelog-battle-where is-setup" title={`${shownName(token.name)} · ${squareName(token.at)}`}>
      {token.icon && <span aria-hidden="true">{token.icon} </span>}
      {shownName(token.name)} · {squareName(token.at)}
    </span>
  );

  const setupColumn = !editing ? null : token ? (
    <div className="lonelog-battle-controls is-setup" role="group" aria-label={`Set up ${shownName(token.name)}`}>
      {mode === "menu" && (
        <>
          <button type="button" title="Move where they start" aria-label="Move start" onClick={() => setMode("move")}>
            <Move size={13} />
          </button>
          {!battle.rolled.includes(combatantKey(token.name)) && (
            <button
              type="button"
              title="Roll initiative"
              aria-label="Roll initiative"
              onClick={() => void rollFor([token.name])}
            >
              <Dices size={13} />
            </button>
          )}
          <button
            type="button"
            title="Emoji for this fight"
            aria-label="Emoji"
            onClick={() => {
              setEmoji(battle.icons[combatantKey(token.name)] ?? "");
              setMode("emoji");
            }}
          >
            <Smile size={13} />
          </button>
        </>
      )}
      {mode === "emoji" && (
        <button
          type="button"
          title="Set the emoji"
          aria-label="Set emoji"
          onClick={() => {
            const name = token.name;
            onSetup?.((body) => setIcon(body, battle.fight, name, emoji));
            done();
          }}
        >
          <Check size={13} />
        </button>
      )}
      <button
        type="button"
        title={mode === "menu" ? "Done" : "Cancel"}
        aria-label={mode === "menu" ? "Done" : "Cancel"}
        onClick={mode === "menu" ? done : () => setMode("menu")}
      >
        <X size={13} />
      </button>
    </div>
  ) : unrolled.length > 0 ? (
    <div className="lonelog-battle-controls is-setup" role="group" aria-label="Setup">
      <button
        type="button"
        title={`Roll initiative for ${unrolled.map((t) => shownName(t.name)).join(", ")}`}
        aria-label={`Roll initiative for ${unrolled.length}`}
        onClick={() => void rollFor(unrolled.map((t) => t.name))}
      >
        <Dices size={13} />
      </button>
    </div>
  ) : null;

  const step = (to: number) => {
    const f = frames[Math.max(0, Math.min(frames.length - 1, to))];
    if (f) onSeek(f.id);
  };
  const rounds = [...new Set(frames.map((f) => f.round))];

  const where = frame
    ? `${frame.round > 0 ? `Turn ${frame.round}` : "Setup"}${frame.actor ? ` · ${shownName(frame.actor)}` : ""}`
    : "";
  const controls = (
    <div className="lonelog-battle-controls" role="group" aria-label="Replay">
      <button type="button" aria-label="First turn" onClick={() => step(0)} disabled={index <= 0}>
        <SkipBack size={13} />
      </button>
      <button type="button" aria-label="Previous turn" onClick={() => step(index - 1)} disabled={index <= 0}>
        <ChevronLeft size={14} />
      </button>
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play the fight"}
        onClick={() => setPlaying((p) => !p)}
        disabled={index >= frames.length - 1 && !playing}
      >
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </button>
      <button
        type="button"
        aria-label="Next turn"
        onClick={() => step(index + 1)}
        disabled={index >= frames.length - 1}
      >
        <ChevronRight size={14} />
      </button>
      <button
        type="button"
        aria-label="Last turn"
        onClick={() => step(frames.length - 1)}
        disabled={index >= frames.length - 1}
      >
        <SkipForward size={13} />
      </button>
    </div>
  );

  // Behind the prose: the map faded under the text while the fight is read,
  // gone outside it. The chip keeps the round and the controls in reach; hovering
  // it brings the map up full, to look without leaving the page.
  if (variant === "backdrop") {
    return (
      <div
        className={`lonelog-battle-backdrop${inFight ? " is-in-fight" : ""}`}
        aria-label={`Battle map: ${shownName(battle.map)}`}
      >
        <div className="lonelog-battle-backdrop-map" aria-hidden="true">
          <SquareMapView map={map} tokens={tokens} arrows={arrows} cell={32} />
        </div>
        <div className="lonelog-battle-chip">
          <span className="lonelog-battle-where">{where}</span>
          {controls}
        </div>
      </div>
    );
  }

  // The map's title line: its own header — or, titled on another line (the
  // fight's), a part of that one.
  const headBody = (
    <>
      {headInto !== undefined && <MapIcon size={14} aria-hidden="true" className="lonelog-battle-head-icon" />}
      <span className="lonelog-battle-key">Map</span>
      {onOpenMap && /\[\[/.test(battle.map) ? (
        <button
          type="button"
          className="lonelog-battle-title lonelog-battle-title-link"
          title="Open the map's note"
          onClick={() => onOpenMap(battle.map)}
        >
          {map.title ?? shownName(battle.map)}
        </button>
      ) : (
        <span className="lonelog-battle-title">{map.title ?? shownName(battle.map)}</span>
      )}
      {setupWhere ?? (where && <span className="lonelog-battle-where">{where}</span>)}
    </>
  );
  const head =
    headInto !== undefined ? (
      <span className="lonelog-battle-head">{headBody}</span>
    ) : (
      <header className="lonelog-battle-head">{headBody}</header>
    );

  return (
    <aside
      className={`lonelog-battle-pane${inFight ? "" : " is-idle"}${headInto !== undefined ? " is-headless" : ""}`}
      aria-label={`Battle map: ${shownName(battle.map)}`}
    >
      {headInto !== undefined ? (
        headInto && createPortal(head, headInto)
      ) : (
        <>
          <span className="lonelog-battle-icon" aria-hidden="true">
            <MapIcon size={15} />
          </span>
          {head}
        </>
      )}

      <SquareMapView
        map={map}
        tokens={tokens}
        arrows={arrows}
        cell={24}
        {...(pictures ? { onTokenContextMenu: pictures.menu } : {})}
        // Choosing where to start, the whole map — anywhere can be picked.
        {...(zoom && !(token && mode === "move") ? { view: actionView(map, tokens, arrows) } : {})}
        {...(editing
          ? {
              onTokenClick: (name: string) => {
                setPicked((p) => (p === name ? null : name));
                setMode("menu");
              },
              ...(token ? { selected: token.name } : {}),
              ...(token && mode === "move" ? { onSquareClick: placeAt } : {}),
            }
          : {})}
      />

      {frames.length > 0 && (
        <div className="lonelog-battle-timeline">
          {token && setupColumn ? setupColumn : controls}
          {!token && setupColumn}
          <ol className="lonelog-battle-rounds">
            {rounds.map((r) => (
              <li key={r}>
                <span className="lonelog-battle-round">{r > 0 ? `T${r}` : "Setup"}</span>
                <span className="lonelog-battle-ticks">
                  {frames.map((f, i) =>
                    f.round === r ? (
                      <button
                        key={f.id}
                        type="button"
                        className={`lonelog-battle-tick${i === index ? " is-current" : ""}${f.actor ? "" : " is-quiet"}`}
                        title={f.actor ? shownName(f.actor) : "—"}
                        aria-label={`${r > 0 ? `Turn ${r}` : "Setup"}${f.actor ? `, ${shownName(f.actor)}` : ""}`}
                        aria-current={i === index ? "step" : undefined}
                        onClick={() => onSeek(f.id)}
                      />
                    ) : null
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
}
