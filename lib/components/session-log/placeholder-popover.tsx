import { useState } from "react";
import { parseLonelog } from "../../domains/lonelog/parser";
import { groupIntoProse } from "../../domains/session-log/prose-grouper";
import {
  buildSidebarItems,
  dieEditKey,
  withActorRefs,
  withCheckResults,
  type SidebarItem,
} from "../../domains/session-log/prose-model";
import type { FormulaVars } from "../../domains/session-log/formula";
import { applySwapsToBody, fillDerivedResults, pendingTermSwaps } from "../../domains/session-log/die-edits";
import { SidebarEntry, hasEditableValue, type SidebarEditContext } from "./sidebar-entry";
import { cardSummary } from "../../domains/session-log/card-summary";
import {
  parseLogTemplate,
  needsUserInput,
  requiredFilled,
  previewLogTemplate,
  resolveWithContext,
  ResolutionContext,
  ParsedPlaceholder,
} from "../../domains/session-log/template-resolver";
import { SessionFeatureCard } from "../../domains/session-log/card-types";
import { normalizeRoute, withMove, withMoveAfter } from "../../domains/battlemap/movement";
import { foldHealth, withTargetAc, withTargetHealth, type Health } from "../../domains/session-log/health";
import { onAMiss, withRiders } from "../../domains/session-log/riders";
import { ordinal, slotName, withCast, withInflict } from "../../domains/session-log/spellcasting";
import { composeMultiattack } from "../../domains/session-log/multiattack";
import { parseRange, rangeVerdict } from "../../domains/battlemap/ranges";
import { adviseRolls, withAdvice, type ConditionEffects } from "../../domains/session-log/roll-advice";
import { withXpAward } from "../../domains/session-log/xp-award";

interface PlaceholderPopoverProps {
  card: SessionFeatureCard;
  entities: string[];
  /** The note the log lives in, so links in the preview resolve. */
  sourcePath?: string;
  /** An actor's value for a `[[Name]]` roll term (`[[Insight]]` for Talon), so
   *  the preview's rolls carry their modifiers and checks can be judged. */
  resolveRef?: (actor: string, name: string) => number | undefined;
  /** The log's running values now (`CF` → 4), so an oracle in the preview
   *  answers against the current Chaos Factor. */
  vars?: FormulaVars;
  /** In a fight, the card can move its actor too: where they stand now, if
   *  the map knows. Absent outside a fight — no move is asked for. */
  movement?: {
    from?: string;
    /** The move read against the rules as it's typed: its feet, the round's
     *  feet of what may be walked, who it would provoke. */
    check?: (
      routes: string[]
    ) =>
      | { feet: number; spent: number; allowance?: number; provokes: string[]; granted?: string; offTurn?: boolean }
      | undefined;
  };
  /** Fields filled before the popup opens (a pick already made for you). */
  initialValues?: Record<string, string>;
  /** The fight as it stands — who bears which condition, who's a foe — so an
   *  attack's riders know whether the target is marked already. */
  fight?: {
    conditionsOf: (name: string) => string[];
    withCondition: (c: string) => string[];
    isFoe: (name: string) => boolean;
  };
  /** What a target's sheet or statblock says — its AC fills an attack's
   *  `Target AC`; its health (now) shows what the damage leaves it with. */
  defense?: { ac: (name: string) => number | undefined; health: (name: string) => Health | undefined };
  /** Where things stand on the map, for aiming: how far a target is from the
   *  actor once its routes are walked, and the hostiles next to it there. */
  aim?: {
    distanceTo: (target: string, routes: string[]) => number | undefined;
    crowding: (routes: string[]) => string[];
  };
  /** Everyone's conditions now, and what each does to rolls — to say what to
   *  roll with (advantage on a blinded target). */
  rollConditions?: {
    conditionsOf: (name: string) => string[];
    effectsOf: (condition: string) => ConditionEffects | undefined;
  };
  /** What the actor has spent now — this round's action and bonus action, its
   *  reaction since its round began — to warn before spending one again. */
  slotsUsed?: Record<"action" | "bonus" | "reaction", string[]>;
  onResolve: (resolvedText: string) => void;
  onCancel: () => void;
}

/** A row's place among the rows that carry a source line — a key that survives
 *  the line's text changing as fields fill (a roll made before the DC is typed
 *  stays put). */
function rowPositions(items: SidebarItem[]): Map<string, number> {
  const out = new Map<string, number>();
  let i = 0;
  for (const row of items.flatMap((it) => it.rows)) {
    if (row.source && !out.has(row.source)) out.set(row.source, i);
    if (row.source) i++;
  }
  return out;
}

export function PlaceholderPopover({
  card,
  entities,
  sourcePath = "",
  resolveRef,
  vars,
  movement,
  initialValues,
  defense,
  fight,
  slotsUsed,
  aim,
  rollConditions,
  onResolve,
  onCancel,
}: PlaceholderPopoverProps) {
  // The riders this attack can carry (Mystic Mark): on when picked — or, on a
  // target that already bears a rider's mark, on by itself, riding free.
  const [riderPicks, setRiderPicks] = useState<Record<string, boolean>>({});
  const placeholders = parseLogTemplate(card.logTemplate);
  const userInputs = needsUserInput(placeholders);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const p of userInputs) initial[p.kind] = initialValues?.[p.kind] ?? "";
    return initial;
  });
  const riders = card.riders ?? [];
  const pickedTarget = (values.target ?? "").trim();
  const riderFree = (mark?: string) =>
    !!mark && !!pickedTarget && (fight?.conditionsOf(pickedTarget) ?? []).includes(mark);
  // A spell attack takes a rider's mark, not its damage (Mystic Mark's die is
  // for weapon attacks).
  const spellAttack = card.attackForm === "spell";
  const plays = riders
    .filter((r) => riderPicks[r.name] ?? riderFree(r.mark))
    .map((r) => ({ rider: spellAttack ? { ...r, damage: undefined } : r, free: riderFree(r.mark) }));
  // A spell cast at a circle: that circle's damage, and the slot it spends —
  // spent hit or miss. What only a hit brings (riders, a condition) goes on top.
  const [castAt, setCastAt] = useState(card.cast?.circle ?? 0);
  const [inflictOn, setInflictOn] = useState(card.inflicts ? !card.inflicts.optional : false);
  const castTemplate = card.cast ? withCast(card.logTemplate, card.cast, castAt, card.actor) : card.logTemplate;
  const riderCtx = {
    actor: card.actor,
    targetIsFoe: fight ? fight.isFoe(pickedTarget) : true,
    markedNow: (m: string) =>
      (fight?.withCondition(m) ?? []).filter((n) => n.toLowerCase() !== pickedTarget.toLowerCase()),
  };
  const ridden = withRiders(castTemplate, plays, riderCtx);
  // A Multiattack: each of its attacks picked, and aimed — written under it.
  const multi = card.multiattack;
  const [strikes, setStrikes] = useState<Array<{ attack: string; target: string }>>(() =>
    // (Aimed already when the card opens on a target — an opportunity attack's mover.)
    Array.from({ length: multi?.count ?? 0 }, () => ({
      attack: multi?.attacks[0]?.name ?? "",
      target: initialValues?.target ?? "",
    }))
  );
  const strikeTemplate = (st: { attack: string }) =>
    multi?.attacks.find((a) => a.name === st.attack)?.logTemplate ?? `@({{actor}}) ${st.attack} → {{target}}`;
  const composed = multi
    ? composeMultiattack(
        card.logTemplate,
        strikes.map((st) => ({ template: strikeTemplate(st), target: st.target }))
      )
    : undefined;
  const template =
    composed ??
    (card.inflicts && inflictOn
      ? withInflict(ridden, card.inflicts.condition, fight ? fight.isFoe(pickedTarget) : true, card.name)
      : ridden);
  const onHitOnly = !composed && template !== castTemplate;

  // An attack's Target AC, left blank, is the target's own — read from its sheet
  // when the log is read, so it follows the sheet; the field shows what it is.
  const target = (values.target ?? "").trim();
  const targetAc = target && defense ? defense.ac(target) : undefined;
  const hints: Record<string, string> = targetAc != null ? { target_ac: `${targetAc} — from ${target}` } : {};

  // The move made as part of the action (`G4>F4`), in a fight; blank stays put.
  // A move before the action (on its line) and one after it (once it's done).
  const [move, setMove] = useState("");
  const [moveAfter, setMoveAfter] = useState("");
  const route = movement ? normalizeRoute(move) : "";
  const routeAfter = movement ? normalizeRoute(moveAfter) : "";
  const moved = (text: string) => {
    if (!movement) return text;
    // Just moving: the move is the entry (`@(Lilith) [Mv: N6>M10] Moves`), read as its MOVE.
    if (card.kind === "move") return routeAfter ? withMove(text, routeAfter) : text;
    const before = route ? withMove(text, route) : text;
    return routeAfter ? withMoveAfter(before, routeAfter) : before;
  };
  // Dice rolled (or typed) in the preview, keyed by row position + token + slot.
  const [rolls, setRolls] = useState<Record<string, string>>({});

  const ctx: ResolutionContext = { actor: card.actor, name: card.name, entities };

  /** The Log's reading of a text: entries, the actor's modifiers, judged checks. */
  const readLog = (text: string): SidebarItem[] => {
    const segments = groupIntoProse(parseLonelog(text));
    const built = buildSidebarItems(segments, undefined, undefined, vars);
    const refd = resolveRef ? withActorRefs(built, resolveRef) : built;
    // Attacks against the target's AC (a blank one is the target's own); then
    // what the damage leaves the target with, from where it stands now.
    const items = withCheckResults(defense ? withTargetAc(refd, defense.ac) : refd);
    const healthy = defense ? withTargetHealth(items, foldHealth(segments, defense.health, defense.ac).hits) : items;
    // An XP award, summed up as the Log will — the fight's worth, each one's part.
    return withXpAward(healthy, segments, () => card.xpWorth);
  };

  /** A text with the preview's rolls written in, and its checks' results filled. */
  const withRolls = (text: string): { text: string; items: SidebarItem[] } => {
    const base = readLog(text);
    const positions = rowPositions(base);
    const dieEdits: Record<string, string> = {};
    for (const [source, pos] of positions) {
      for (const [key, value] of Object.entries(rolls)) {
        const [p, raw, slot] = key.split("\u0000");
        if (Number(p) === pos) dieEdits[dieEditKey(source, raw, Number(slot))] = value;
      }
    }
    const rolled = applySwapsToBody(text, pendingTermSwaps(base, dieEdits));
    const items = readLog(rolled);
    return { text: fillDerivedResults(rolled, items), items };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rolled = withRolls(moved(resolveWithContext(advised(template), ctx, values)));
    /** What the first roll labelled so came to (`Miss`, `Success`), once judged. */
    const judged = (label: RegExp) =>
      rolled.items
        .flatMap((i) => i.rows)
        .find((r) => label.test(r.content.split("|")[0] ?? ""))
        ?.content.match(/(?:->|→)\s*(\w+)\s*$/)?.[1];
    // What only a hit brings (a rider, a condition) is dropped on a miss — the
    // slot it was cast with is spent all the same.
    if (onHitOnly && judged(/^\s*attack\b/i) === "Miss") {
      // A rider that's an action of its own (Wind Up) stays — spent all the same.
      const kept = withRiders(castTemplate, onAMiss(plays), riderCtx);
      onResolve(withRolls(moved(resolveWithContext(advised(kept), ctx, values))).text);
      return;
    }
    // A condition only a failed save brings on (Luminous Bolt's `blinded`) is
    // dropped when the target saves — the damage stands.
    if (card.inflicts?.on === "fail" && inflictOn && judged(/\bsave\b/i) === "Success") {
      onResolve(withRolls(moved(resolveWithContext(advised(ridden), ctx, values))).text);
      return;
    }
    // What only a success brings (Stabilize's `+stable`).
    // (The first check the card made, as it came out.)
    const firstResult = rolled.items
      .flatMap((i) => i.rows)
      .map((r) => r.content.match(/(?:->|→)\s*(Success|Failure|Hit|Miss)\s*$/i)?.[1])
      .find((x) => !!x);
    if (card.onSuccess && /^(success|hit)$/i.test(firstResult ?? "")) {
      onResolve(`${rolled.text.trimEnd()}\n${resolveWithContext(card.onSuccess, ctx, values)}`);
      return;
    }
    // A status shaken off: a successful save frees its bearer.
    if (card.status && judged(/\bsave\b/i) === "Success") {
      onResolve(`${rolled.text.trimEnd()}\n${resolveWithContext(card.status.onSuccess, ctx, values)}`);
      return;
    }
    onResolve(rolled.text);
  };

  const handleChange = (kind: string, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [kind]: value };
      // What depends on this pick (a style's kind of name) starts over.
      for (const p of userInputs) if (p.dependsOn === kind) next[p.kind] = "";
      return next;
    });
  };

  const allFilled =
    requiredFilled(userInputs, values) &&
    route !== null &&
    routeAfter !== null &&
    // A move card is its route: no route, nothing to write.
    (card.kind !== "move" || !!routeAfter) &&
    (!multi || strikes.some((st) => st.target.trim() !== ""));

  const summary = cardSummary(card);
  // Its range, and what a target's distance means for it — from where the
  // actor stands once its move before is walked. Advice, never a block: a
  // move may bring an out-of-range target in.
  const aimFrom = route ? [route] : [];
  const verdictFor = (target: string, rangeText?: string, melee?: boolean) => {
    const range = parseRange(rangeText, melee);
    const feet = target && aim ? aim.distanceTo(target, aimFrom) : undefined;
    if (!range || feet == null) return undefined;
    // A ranged attack roll with a hostile beside the attacker: disadvantage.
    const rangedAttack =
      range.kind === "ranged" && (card.attackForm === "ranged" || card.attackForm === "spell" || !melee);
    return rangeVerdict(range, feet, rangedAttack && card.bucket === "attack" ? (aim?.crowding(aimFrom) ?? []) : []);
  };
  const ownMelee = card.attackForm === "melee";
  const describeTarget = (name: string) => {
    const v = verdictFor(name, card.range, ownMelee);
    if (!v) return undefined;
    const feet = v.text.split(" — ")[0];
    return v.status === "out" ? `${feet} · out of range` : v.status === "long" ? `${feet} · long range` : feet;
  };
  const targetVerdict = target ? verdictFor(target, card.range, ownMelee) : undefined;
  // What the conditions in play do to its rolls: its attack (the actor's and
  // the target's conditions), the save its target makes — or the actor, shaking
  // off a status. Said, for the player to roll; not written in.
  const adviceFor = (aimAt: string | undefined, withAttack: boolean) => {
    if (!rollConditions && !card.grants) return [];
    const save = template.match(/^d(?:\([^)]*\))?:\s*(STR|DEX|CON|INT|WIS|CHA)\s+save\b/im)?.[1];
    const by = card.bucket === "status" ? card.actor : aimAt;
    const feet = aimAt && aim ? aim.distanceTo(aimAt, aimFrom) : undefined;
    return adviseRolls({
      attack: withAttack,
      ...(save && by ? { save: { ability: save, by } } : {}),
      actor: card.actor,
      ...(aimAt ? { target: aimAt } : {}),
      conditionsOf: rollConditions?.conditionsOf ?? (() => []),
      effectsOf: rollConditions?.effectsOf ?? (() => undefined),
      ...(card.grants ? { granted: card.grants } : {}),
      ...(feet != null ? { within5: feet <= 5 } : {}),
    });
  };
  const attacks = /^d(?:\([^)]*\))?:\s*attack\b/im.test(template);
  const advice = multi ? [] : adviceFor(target || undefined, attacks);
  const ADVICE_SAYS = {
    advantage: "written as 2d20kh1",
    disadvantage: "written as 2d20kl1",
    fails: "fails — no roll",
    cancels: "advantage and disadvantage cancel",
  } as const;
  // The lines it writes with the advice in them — each Multiattack attack
  // advised for its own target.
  function advised(t: string): string {
    if (!multi) return withAdvice(t, advice);
    return composeMultiattack(
      card.logTemplate,
      strikes.map((st) => ({
        template: withAdvice(strikeTemplate(st), st.target ? adviceFor(st.target, true) : []),
        target: st.target,
      }))
    );
  }
  // The move typed, read against the rules: feet, what's left of the round's
  // speed, and the opportunity attacks it would provoke — said, never stopped.
  const moveRead = (() => {
    const routes = [route, routeAfter].filter((r): r is string => !!r);
    const read = routes.length > 0 ? movement?.check?.(routes) : undefined;
    if (!read) return undefined;
    const over = read.allowance != null && read.spent > read.allowance;
    const parts = [
      `${read.feet} ft`,
      read.allowance != null
        ? read.granted
          ? `of ${read.allowance} ft ${read.granted} allows${over ? " — over it" : ""}`
          : `${read.spent}/${read.allowance} ft this round${over ? " — over speed" : ""}`
        : "",
      read.offTurn ? "outside its round — nothing grants this move" : "",
      read.provokes.length > 0 ? `provokes ${read.provokes.join(", ")}` : "",
    ].filter(Boolean);
    // What it sets off: the provoked creatures' opportunity attacks, ready in their hands.
    const next = read.provokes.length > 0 ? " Their Opportunity Attack is ready, aimed at the mover." : "";
    return { text: `${parts.join(" · ")}.${next}`, warn: over || !!read.offTurn || read.provokes.length > 0 };
  })();
  // A slot it spends that's spent already this round — said, not stopped (a
  // feature may allow a second).
  const SLOT_NAME = { action: "action", bonus: "bonus action", reaction: "reaction" } as const;
  // (Just moving spends no slot — only speed.)
  const justMoves = card.kind === "move";
  const ownSlot: "action" | "bonus" | "reaction" | undefined = justMoves
    ? undefined
    : (card.takes ??
      (card.bucket === "bonus" || card.bucket === "reaction"
        ? card.bucket
        : card.bucket === "attack" || card.bucket === "action"
          ? "action"
          : undefined));
  const spentAlready = (slot?: "action" | "bonus" | "reaction") => (slot ? (slotsUsed?.[slot] ?? []) : []);
  // What the card will add, kept current as the fields fill and the dice roll:
  // drawn the way the Log sidebar draws its entries — its dice clickable, as in
  // the Log — with the raw lonelog a click away.
  const preview = withRolls(moved(previewLogTemplate(advised(template), ctx, values)));
  const hasDice = hasEditableValue(preview.items.flatMap((i) => i.rows));

  // The preview's dice: a roll is stored by its row's position, so it stays on
  // the line as the line's text changes.
  const positions = rowPositions(preview.items);
  const edit: SidebarEditContext = {
    dieEdits: Object.fromEntries(
      [...positions].flatMap(([source, pos]) =>
        Object.entries(rolls)
          .filter(([key]) => Number(key.split("\u0000")[0]) === pos)
          .map(([key, value]) => {
            const [, raw, slot] = key.split("\u0000");
            return [dieEditKey(source, raw, Number(slot)), value];
          })
      )
    ),
    onDieChange: (source, raw, slot, value) => {
      const pos = positions.get(source);
      if (pos == null) return;
      setRolls((r) => ({ ...r, [`${pos}\u0000${raw}\u0000${slot}`]: value }));
    },
    onResultChange: () => {},
  };

  return (
    <div className="lonelog-placeholder-popover" role="dialog" aria-label={`Play ${card.name}`}>
      <form onSubmit={handleSubmit} className="placeholder-form">
        <header className="placeholder-head">
          <strong className="placeholder-title">{card.name}</strong>
          {summary && <p className="placeholder-summary">{summary}</p>}
          {/* What other features change on this card — Rage's +2, Archery's +2 to hit. */}
          {card.modifiedBy && card.modifiedBy.length > 0 && (
            <ul className="placeholder-modified" aria-label="Changed by">
              {card.modifiedBy.map((m, i) => (
                <li key={i}>
                  <b>{m.from}</b> {m.text}
                </li>
              ))}
            </ul>
          )}
          {card.bucket === "status" && card.text && <p className="placeholder-rules">{card.text}</p>}
          {ownSlot && !card.multiattack && spentAlready(ownSlot).length > 0 && (
            <p className="placeholder-warn">
              {SLOT_NAME[ownSlot][0].toUpperCase() + SLOT_NAME[ownSlot].slice(1)} already used this round —{" "}
              {spentAlready(ownSlot).join(", ")}.
            </p>
          )}
        </header>
        {multi && (
          <fieldset className="placeholder-strikes">
            <legend className="placeholder-label">
              {multi.count === 1 ? "Its attack" : `Its ${multi.count} attacks`}
            </legend>
            {strikes.map((st, i) => (
              <div key={i} className="placeholder-strike">
                <span className="placeholder-strike-n">{i + 1}</span>
                {multi.attacks.length > 1 ? (
                  <select
                    className="placeholder-select"
                    aria-label={`Attack ${i + 1}`}
                    value={st.attack}
                    onChange={(e) =>
                      setStrikes((all) => all.map((x, j) => (j === i ? { ...x, attack: e.target.value } : x)))
                    }
                  >
                    {multi.attacks.map((a) => (
                      <option key={a.name} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="placeholder-strike-name">{st.attack}</span>
                )}
                <span className="placeholder-strike-at" aria-hidden="true">
                  →
                </span>
                <select
                  className="placeholder-select"
                  aria-label={`Target of attack ${i + 1}`}
                  value={st.target}
                  onChange={(e) =>
                    setStrikes((all) => all.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))
                  }
                >
                  <option value="">Choose…</option>
                  {entities.map((t) => {
                    const a = multi.attacks.find((x) => x.name === st.attack);
                    const v = verdictFor(t, a?.range, a?.melee ?? /reach/i.test(a?.range ?? ""));
                    const note = v
                      ? ` — ${v.text.split(" — ")[0]}${v.status === "out" ? " · out of range" : v.status === "long" ? " · long range" : ""}`
                      : "";
                    return (
                      <option key={t} value={t}>
                        {t}
                        {note}
                      </option>
                    );
                  })}
                </select>
                {(() => {
                  const a = multi.attacks.find((x) => x.name === st.attack);
                  const v = st.target
                    ? verdictFor(st.target, a?.range, a?.melee ?? /reach/i.test(a?.range ?? ""))
                    : undefined;
                  return v && (v.status !== "in" || v.disadvantage) ? (
                    <small className="placeholder-warn placeholder-strike-verdict">{v.text}</small>
                  ) : null;
                })()}
                {st.target &&
                  adviceFor(st.target, true).map((a) => (
                    <small
                      key={a.roll}
                      className={`placeholder-strike-verdict placeholder-advice-line is-${a.verdict}`}
                    >
                      {a.roll}: {ADVICE_SAYS[a.verdict]} — {a.why}
                    </small>
                  ))}
              </div>
            ))}
          </fieldset>
        )}
        {userInputs.map((placeholder) => {
          // A pick that depends on another (a style's kinds of name) offers that pick's options,
          // and waits until there are some.
          const options = placeholder.dependsOn
            ? (placeholder.optionsBy?.[values[placeholder.dependsOn] ?? ""] ?? [])
            : undefined;
          if (options && options.length === 0) return null;
          return (
            <PlaceholderField
              key={placeholder.kind}
              placeholder={options ? { ...placeholder, options } : placeholder}
              value={values[placeholder.kind]}
              {...(hints[placeholder.kind] ? { hint: hints[placeholder.kind] } : {})}
              entities={entities}
              {...(placeholder.kind === "target" && aim ? { describe: describeTarget } : {})}
              onChange={(v) => handleChange(placeholder.kind, v)}
            />
          );
        })}
        {targetVerdict && (
          <p
            className={
              targetVerdict.status === "in" && !targetVerdict.disadvantage ? "placeholder-hint" : "placeholder-warn"
            }
          >
            {target}: {targetVerdict.text}
            {targetVerdict.status === "out" && route ? " — even after the move" : ""}.
          </p>
        )}
        {advice.length > 0 && (
          <ul className="placeholder-advice" aria-label="What to roll with">
            {advice.map((a) => (
              <li key={a.roll} className={`is-${a.verdict}`}>
                <strong>{a.roll}</strong>: {ADVICE_SAYS[a.verdict]} — {a.why}.
              </li>
            ))}
          </ul>
        )}
        {card.cast && Object.keys(card.cast.damage).length > 1 && (
          <label className="placeholder-field">
            <span className="placeholder-label">Cast at</span>
            <select className="placeholder-select" value={castAt} onChange={(e) => setCastAt(Number(e.target.value))}>
              {Object.entries(card.cast.damage)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([c, damage]) => (
                  <option key={c} value={c}>
                    {ordinal(Number(c))} circle — {damage}
                  </option>
                ))}
            </select>
            <small className="placeholder-hint">Spends a {slotName(castAt)}.</small>
          </label>
        )}
        {card.cast && Object.keys(card.cast.damage).length <= 1 && (
          <small className="placeholder-hint">Spends a {slotName(card.cast.circle)}.</small>
        )}
        {card.inflicts && (
          <label className="placeholder-rider">
            <input type="checkbox" checked={inflictOn} onChange={(e) => setInflictOn(e.target.checked)} />
            <span className="placeholder-rider-name">Leaves it {card.inflicts.condition}</span>
            <small className="placeholder-hint">
              {card.inflicts.note ? `${card.inflicts.note} — ` : ""}
              {card.inflicts.on === "fail" ? "on a hit, if it fails its save" : "only on a hit"}
            </small>
          </label>
        )}
        {riders.length > 0 && (
          <fieldset className="placeholder-riders">
            <legend className="placeholder-label">With the attack</legend>
            {riders.map((r) => {
              const free = riderFree(r.mark);
              const on = riderPicks[r.name] ?? free;
              // Who bears its mark now, besides the target — a new mark moves it.
              const marked =
                r.mark && !free
                  ? (fight?.withCondition(r.mark) ?? []).filter((n) => n.toLowerCase() !== pickedTarget.toLowerCase())
                  : [];
              const what = [
                r.hit ? `+${r.hit} to hit` : "",
                r.damage && !spellAttack ? `+${r.damage}${/^\d+$/.test(r.damage) ? " damage" : ""}` : "",
                r.damage && spellAttack ? "no extra damage on a spell" : "",
                !free && r.mark
                  ? marked.length > 0
                    ? `moves the mark from ${marked.join(", ")}`
                    : "marks the target"
                  : "",
                !free && r.cost ? `${r.cost.amount} use${r.cost.amount > 1 ? "s" : ""}` : "",
                r.takes ? `your ${SLOT_NAME[r.takes]}, hit or miss` : "free (no action)",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <label key={r.name} className="placeholder-rider">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => setRiderPicks((p) => ({ ...p, [r.name]: e.target.checked }))}
                  />
                  <span className="placeholder-rider-name">{r.name}</span>
                  <small className="placeholder-hint">
                    {free
                      ? `the target is ${r.mark}: ${r.damage && !spellAttack ? `+${r.damage}, ` : ""}no use spent`
                      : what}
                  </small>
                  {on && r.takes && spentAlready(r.takes).length > 0 && (
                    <small className="placeholder-warn">
                      {SLOT_NAME[r.takes]} already used — {spentAlready(r.takes).join(", ")}
                    </small>
                  )}
                </label>
              );
            })}
            {riders.some((r) => !r.takes) && (
              <small className="placeholder-hint">Only on a hit — a miss drops it.</small>
            )}
          </fieldset>
        )}
        {movement && (
          <div className="placeholder-moves">
            {!justMoves && (
              <label className="placeholder-field placeholder-move">
                <span className="placeholder-label">
                  move before
                  <span className="placeholder-optional"> (optional)</span>
                </span>
                <input
                  type="text"
                  value={move}
                  onChange={(e) => setMove(e.target.value)}
                  placeholder="E3, or a route: G4>F4"
                  className="placeholder-input"
                  aria-invalid={route === null}
                  aria-describedby={`${card.id}-move-hint`}
                />
                <small id={`${card.id}-move-hint`} className={`placeholder-hint${route === null ? " is-invalid" : ""}`}>
                  {route === null
                    ? "Squares like E3, or a route like G4>F4."
                    : movement.from
                      ? `Now at ${movement.from}${route ? ` — moves ${movement.from}>${route}, then acts` : ""}.`
                      : "Moves, then acts."}
                </small>
              </label>
            )}
            <label className="placeholder-field placeholder-move">
              <span className="placeholder-label">
                {justMoves ? "move to" : "move after"}
                {!justMoves && <span className="placeholder-optional"> (optional)</span>}
              </span>
              <input
                type="text"
                value={moveAfter}
                onChange={(e) => setMoveAfter(e.target.value)}
                placeholder="back into cover: J14"
                className="placeholder-input"
                aria-invalid={routeAfter === null}
                aria-describedby={`${card.id}-move-after-hint`}
              />
              <small
                id={`${card.id}-move-after-hint`}
                className={`placeholder-hint${routeAfter === null ? " is-invalid" : ""}`}
              >
                {routeAfter === null
                  ? "Squares like E3, or a route like G4>F4."
                  : justMoves
                    ? movement.from
                      ? `Now at ${movement.from}.`
                      : "Where they move to — a square, or a route."
                    : "Acts, then moves — from where the action left them."}
              </small>
            </label>
            {moveRead && (
              <p className={moveRead.warn ? "placeholder-warn" : "placeholder-hint"} aria-live="polite">
                {moveRead.text}
              </p>
            )}
          </div>
        )}
        {preview.text.trim() && (
          <section className="placeholder-preview" aria-label="Preview">
            <span className="placeholder-preview-label">
              Adds to the log{hasDice ? " — click a die to roll it, or type what you rolled" : ""}
            </span>
            <div className="lonelog-entries placeholder-preview-entries">
              {preview.items.map((item) => (
                <SidebarEntry key={item.id} item={item} sourcePath={sourcePath} edit={edit} />
              ))}
            </div>
            <details className="placeholder-preview-raw">
              <summary>Lonelog</summary>
              <pre>{preview.text}</pre>
            </details>
          </section>
        )}
        <div className="placeholder-buttons">
          <button
            type="submit"
            disabled={!allFilled}
            className="placeholder-submit"
            autoFocus={userInputs.length === 0}
          >
            {userInputs.length === 0 ? "Play card" : "Append"}
          </button>
          <button type="button" onClick={onCancel} className="placeholder-cancel">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/** Fields whose name doesn't read well as written. */
const FIELD_LABELS: Record<string, string> = { target_ac: "Target AC", kind: "Kind of name" };

interface PlaceholderFieldProps {
  placeholder: ParsedPlaceholder;
  value: string;
  /** What a blank field will be (`15 — from Talon`), shown in it. */
  hint?: string;
  entities: string[];
  /** A target's distance and range, shown with its name (`Kobold, Elite — 40 ft`). */
  describe?: (name: string) => string | undefined;
  onChange: (value: string) => void;
}

function PlaceholderField({ placeholder, value, hint, entities, describe, onChange }: PlaceholderFieldProps) {
  const isTarget = placeholder.kind === "target";

  return (
    <label className="placeholder-field">
      <span className="placeholder-label">
        {FIELD_LABELS[placeholder.kind] ?? placeholder.kind.replace(/_/g, " ")}
        {placeholder.optional && <span className="placeholder-optional"> (optional)</span>}
      </span>
      {placeholder.options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="placeholder-select">
          <option value="">Choose…</option>
          {placeholder.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : isTarget ? (
        <TargetSelector value={value} entities={entities} {...(describe ? { describe } : {})} onChange={onChange} />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hint ?? `Enter ${placeholder.kind}...`}
          className="placeholder-input"
        />
      )}
    </label>
  );
}

interface TargetSelectorProps {
  value: string;
  entities: string[];
  /** A target's distance and range, shown with its name. */
  describe?: (name: string) => string | undefined;
  onChange: (value: string) => void;
}

function TargetSelector({ value, entities, describe, onChange }: TargetSelectorProps) {
  const [isCustom, setIsCustom] = useState(false);

  if (isCustom || entities.length === 0) {
    return (
      <div className="target-custom-row">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Custom target..."
          className="placeholder-input"
        />
        {entities.length > 0 && (
          <button type="button" className="target-toggle" onClick={() => setIsCustom(false)}>
            List
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="target-select-row">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="placeholder-select">
        <option value="">Select target...</option>
        {entities.map((name) => {
          const note = describe?.(name);
          return (
            <option key={name} value={name}>
              {name}
              {note ? ` — ${note}` : ""}
            </option>
          );
        })}
      </select>
      <button type="button" className="target-toggle" onClick={() => setIsCustom(true)}>
        Custom
      </button>
    </div>
  );
}
