/**
 * The PARTY's cards, before they write: a form for what the group does
 * together — a rest, a loot, a stage on the road, the weather, a group check,
 * Luck handed out, a trade, the session's end. Its choices become the card's
 * lines (`party-cards.ts`), which then play as any card: previewed, rolled, an
 * outcome to add.
 */

import * as React from "react";
import { useMemo, useState } from "react";
import type { SessionFeatureCard } from "../../domains/session-log/card-types";
import {
  endSession,
  groupCheck,
  longRest,
  loot,
  luck,
  shop,
  shortRest,
  travel,
  weather,
  lootPaths,
  type ItemPrice,
  type LootRow,
  type LootTarget,
  type PartyMember,
  type ShopRow,
  type TravelRole,
} from "../../domains/session-log/party-cards";
import type { LootDestination } from "../../domains/session-log/loot-destinations";
import { NoteCombobox, type NoteOption } from "./note-combobox";

export type PartyCardKind =
  | "short-rest"
  | "long-rest"
  | "loot"
  | "travel"
  | "weather"
  | "group-check"
  | "luck"
  | "shop"
  | "end-session";

/** What the last fight left to take: its fallen's gear, and the party's spent ammunition. */
export interface LootSource {
  items: Array<{ name: string; link: boolean; from: string; qty?: number }>;
  ammo: Array<{ who: string; item: string; link: boolean; fired: number }>;
}

export interface PartyPopoverProps {
  card: SessionFeatureCard;
  kind: PartyCardKind;
  members: PartyMember[];
  /** Where loot can go: each member, and the containers they carry. */
  destinations: LootDestination[];
  /** Whether a thing found can hold things (a Pouch) — so loot can go in it. */
  holdsThings?: (name: string) => boolean;
  lootSource?: LootSource;
  /** The vault's item notes, to find as you type. */
  itemNotes?: () => NoteOption[];
  /** An item note's price in gp — to fill a shop row with. */
  itemCost?: (name: string) => Promise<ItemPrice | undefined>;
  /** Hours since the party's last long rest, when it had one in this log. */
  sinceLongRest?: number;
  /** The clock now (`Day 2, 08:00`). */
  clock?: string;
  onCompose: (text: string, summary?: string) => void;
  onCancel: () => void;
}

const SKILLS = [
  "Acrobatics",
  "Animal Handling",
  "Arcana",
  "Athletics",
  "Deception",
  "History",
  "Insight",
  "Intimidation",
  "Investigation",
  "Medicine",
  "Nature",
  "Perception",
  "Performance",
  "Persuasion",
  "Religion",
  "Sleight of Hand",
  "Stealth",
  "Survival",
];

const WEATHER = {
  season: ["Spring", "Summer", "Autumn", "Winter"],
  temperature: ["freezing", "cold", "cool", "mild", "warm", "hot"],
  wind: ["calm", "breezy", "windy", "strong winds", "gale"],
  sky: ["clear", "cloudy", "overcast", "fog", "rain", "heavy rain", "storm", "snow"],
} as const;

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/** A member's check box, for cards that ask who's in. */
function Members({
  names,
  picked,
  onChange,
}: {
  names: string[];
  picked: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  return (
    <fieldset className="placeholder-party-members">
      <legend className="placeholder-label">Who</legend>
      {names.map((n) => (
        <label key={n} className="placeholder-rider">
          <input
            type="checkbox"
            checked={picked.has(n)}
            onChange={(e) => {
              const next = new Set(picked);
              if (e.target.checked) next.add(n);
              else next.delete(n);
              onChange(next);
            }}
          />
          <span className="placeholder-rider-name">{n}</span>
        </label>
      ))}
    </fieldset>
  );
}

const num = (v: string, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function PartyPopover({
  card,
  kind,
  members,
  destinations,
  holdsThings,
  lootSource,
  itemNotes,
  itemCost,
  sinceLongRest,
  clock,
  onCompose,
  onCancel,
}: PartyPopoverProps) {
  const items = useMemo(() => itemNotes?.() ?? [], [itemNotes]);
  const names = members.map((m) => m.name);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(names));
  const chosen = members.filter((m) => picked.has(m.name));

  // Short rest: hit dice to spend, by member and size.
  const [dice, setDice] = useState<Record<string, Record<string, number>>>({});
  const [hours, setHours] = useState(kind === "long-rest" ? "8" : "1");
  // Long rest.
  const [fed, setFed] = useState(true);
  const [interrupted, setInterrupted] = useState(false);
  // Loot.
  // Each row goes somewhere of its own — `d:` a destination, `f:` a container
  // found with it, blank: left behind. Spent ammunition goes back to whoever
  // shot it; the rest to the party's shared container, when one is carried
  // (Kowyn's Bag), else the first member.
  const destIndex = (who: string) => destinations.findIndex((d) => d.path.length === 1 && d.path[0] === who);
  const shared = destinations.findIndex((d) => d.path.length === 1 && !names.includes(d.path[0]));
  const fallback = shared >= 0 ? `d:${shared}` : destinations.length > 0 ? "d:0" : undefined;
  // A row put inside a container found (`inside`: that row's id) goes where
  // the container goes; `holds` flags one the vault doesn't know holds things.
  type FoundRow = LootRow & { id: number; to?: string; from?: string; inside?: number; holds?: boolean };
  const nextId = React.useRef(0);
  const newId = () => nextId.current++;
  const [lootRows, setLootRows] = useState<FoundRow[]>(() => [
    ...(lootSource?.items ?? []).map((i) => ({
      id: newId(),
      name: i.name,
      link: i.link,
      qty: i.qty ?? 1,
      to: fallback,
      from: i.from,
    })),
    ...(lootSource?.ammo ?? [])
      .filter((a) => a.fired > 1)
      .map((a) => ({
        id: newId(),
        name: a.item,
        link: a.link,
        qty: Math.floor(a.fired / 2),
        to: destIndex(a.who) >= 0 ? `d:${destIndex(a.who)}` : fallback,
        from: `${a.who}'s spent ammunition`,
      })),
  ]);
  const [coinsTo, setCoinsTo] = useState(names[0] ?? "");
  const [coins, setCoins] = useState<Record<string, string>>({ gp: "", sp: "", cp: "" });
  const [split, setSplit] = useState(false);
  // (How it went is the card's outcome, asked once it plays.)
  const note = "";
  // Travel.
  const [destination, setDestination] = useState("");
  const [miles, setMiles] = useState("");
  const [terrain, setTerrain] = useState("");
  const [pace, setPace] = useState<"fast" | "normal" | "slow">("normal");
  const [dc, setDc] = useState("14");
  const [roles, setRoles] = useState<TravelRole[]>(() => [
    { role: "Leader", who: names[0] ?? "", skill: "Persuasion" },
    { role: "Outrider", who: names[1] ?? "", skill: "Survival" },
    { role: "Quartermaster", who: names[2] ?? "", skill: "Survival" },
    { role: "Sentry", who: names[3] ?? "", skill: "Perception" },
  ]);
  const [encounterUnder, setEncounterUnder] = useState("25");
  // Weather.
  const [sky, setSky] = useState<Record<keyof typeof WEATHER, string>>({
    season: "Autumn",
    temperature: "mild",
    wind: "calm",
    sky: "clear",
  });
  // Group check.
  const [what, setWhat] = useState("");
  const [skill, setSkill] = useState("Stealth");
  // Luck, end of session.
  const [amount, setAmount] = useState(kind === "end-session" ? "" : "1");
  // Shop.
  const [buyer, setBuyer] = useState(names[0] ?? "");
  const [at, setAt] = useState("");
  const [shopRows, setShopRows] = useState<ShopRow[]>([{ item: "", qty: 1, price: 0 }]);

  // A row's target, from its `d:`/`f:` value.
  const targetOf = (to?: string): LootTarget | undefined => {
    const m = to?.match(/^([df]):(\d+)$/);
    if (!m) return undefined;
    const n = Number(m[2]);
    if (m[1] === "f") return { to: "found", row: n };
    return destinations[n] ? { to: "dest", path: destinations[n].path } : undefined;
  };
  // Whether a found thing holds others: its note says so (a Pouch), or it's flagged.
  const isHolder = (r: FoundRow) => !!r.name.trim() && (!!r.holds || !!holdsThings?.(r.name));
  const setRow = (id: number, patch: Partial<FoundRow>) =>
    setLootRows((all) => all.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  // Gone, with whatever was put inside it.
  const dropRow = (id: number) => setLootRows((all) => all.filter((x) => x.id !== id && x.inside !== id));
  const putInside = (id: number) =>
    setLootRows((all) => [...all, { id: newId(), name: "", qty: 1, link: true, inside: id }]);

  // A find's count, its name (found as you type), and a way to drop it.
  const findLine = (r: FoundRow) => (
    <>
      <input
        type="number"
        min={0}
        className="placeholder-input placeholder-party-qty"
        value={r.qty}
        aria-label={`How many ${r.name || ""}`}
        onChange={(e) => setRow(r.id, { qty: num(e.target.value) })}
      />
      <NoteCombobox
        value={r.name}
        options={items}
        placeholder="Find an item…"
        // Linked when it's a note's name; kept as typed when not.
        onChange={(name, note) => setRow(r.id, { name, link: !!note })}
      />
      <button
        type="button"
        className="placeholder-party-drop"
        aria-label={`Drop ${r.name || "this row"}`}
        onClick={() => dropRow(r.id)}
      >
        ×
      </button>
    </>
  );

  const compose = (): { text: string; summary?: string } | undefined => {
    switch (kind) {
      case "short-rest":
        return {
          text: shortRest(
            chosen.map((m) => ({ member: m, dice: dice[m.name] ?? {} })),
            num(hours, 1)
          ),
        };
      case "long-rest": {
        const { text, skipped } = longRest(chosen, { fed, interrupted, hours: num(hours, 8) });
        return {
          text,
          ...(skipped.length
            ? { summary: `No benefit for ${skipped.map((s) => `${s.name} (${s.why})`).join(", ")}.` }
            : {}),
        };
      }
      case "loot": {
        // What's inside a container found goes where it goes; a row inside one
        // no longer holding things goes nowhere.
        const paths = lootPaths(
          lootRows,
          lootRows.map((r): LootTarget | undefined => {
            if (r.inside == null) return targetOf(r.to);
            const at = lootRows.findIndex((x) => x.id === r.inside);
            return at >= 0 && isHolder(lootRows[at]) ? { to: "found", row: at } : undefined;
          })
        );
        return {
          text: loot({
            items: lootRows.map((r, i) => ({ ...r, ...(paths[i] ? { path: paths[i] } : {}) })),
            coins: Object.fromEntries(Object.entries(coins).map(([k, v]) => [k, num(v)])),
            coinsTo,
            ...(split ? { split: chosen.map((m) => m.name) } : {}),
            note,
          }),
        };
      }
      case "travel":
        return {
          text: travel({
            destination: destination || "the next stop",
            ...(miles ? { miles: num(miles) } : {}),
            ...(terrain ? { terrain } : {}),
            pace,
            dc: num(dc, 14),
            roles,
            ...(encounterUnder ? { encounterUnder: num(encounterUnder) } : {}),
          }),
        };
      case "weather":
        return { text: weather({ ...sky, note }) };
      case "group-check":
        return { text: groupCheck({ what, skill, dc: num(dc, 10), members: chosen.map((m) => m.name) }) };
      case "luck":
        return { text: luck({ members: chosen.map((m) => m.name), amount: num(amount, 1), why: note }) };
      case "shop":
        return { text: shop({ who: buyer, at, rows: shopRows }) };
      case "end-session":
        return { text: endSession({ members: chosen.map((m) => m.name), xp: num(amount), why: note }) };
    }
  };

  const field = (label: string, input: React.ReactNode, hint?: string) => (
    <label className="placeholder-field">
      <span className="placeholder-label">{label}</span>
      {input}
      {hint && <small className="placeholder-hint">{hint}</small>}
    </label>
  );
  const text = (value: string, set: (v: string) => void, placeholder = "", type = "text") => (
    <input
      type={type}
      className="placeholder-input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => set(e.target.value)}
    />
  );
  const select = (value: string, options: readonly string[], set: (v: string) => void) => (
    <select className="placeholder-select" value={value} onChange={(e) => set(e.target.value)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );

  const restWarnings: string[] = [];
  if (kind === "long-rest") {
    if (sinceLongRest != null && sinceLongRest < 24)
      restWarnings.push(`The last long rest was ${Math.round(sinceLongRest)} hours ago — one a day.`);
    for (const m of chosen)
      if (m.hp && m.hp.current <= 0) restWarnings.push(`${m.name} is at 0 HP — a long rest needs at least 1.`);
  }

  return (
    <div className="lonelog-placeholder-popover" role="dialog" aria-label={`Play ${card.name}`}>
      <form
        className="placeholder-form"
        onSubmit={(e) => {
          e.preventDefault();
          const out = compose();
          if (out) onCompose(out.text, out.summary);
        }}
      >
        <header className="placeholder-head">
          <strong className="placeholder-title">{card.name}</strong>
          {card.summary && <p className="placeholder-summary">{card.summary}</p>}
          {clock && <p className="placeholder-hint">{clock}</p>}
        </header>

        {(kind === "short-rest" ||
          kind === "long-rest" ||
          kind === "group-check" ||
          kind === "luck" ||
          kind === "end-session" ||
          (kind === "loot" && split)) && <Members names={names} picked={picked} onChange={setPicked} />}

        {kind === "short-rest" && (
          <fieldset className="placeholder-party-rows">
            <legend className="placeholder-label">Hit dice to spend</legend>
            {chosen.map((m) => (
              <div key={m.name} className="placeholder-party-row">
                <span className="placeholder-strike-name">{m.name}</span>
                <small className="placeholder-hint">
                  {m.hp ? `${m.hp.current}/${m.hp.max} HP` : ""}
                  {m.con != null ? ` · CON ${m.con >= 0 ? "+" : ""}${m.con}` : ""}
                </small>
                {m.hitDice.map((d) => (
                  <label key={d.die} className="placeholder-party-die">
                    <input
                      type="number"
                      min={0}
                      max={d.left}
                      className="placeholder-input"
                      value={dice[m.name]?.[d.die] ?? 0}
                      onChange={(e) =>
                        setDice((all) => ({
                          ...all,
                          [m.name]: {
                            ...(all[m.name] ?? {}),
                            [d.die]: Math.max(0, Math.min(d.left, num(e.target.value))),
                          },
                        }))
                      }
                    />
                    <span>
                      {d.die} · {d.left} of {d.max} left
                    </span>
                  </label>
                ))}
                {m.hitDice.length === 0 && <small className="placeholder-hint">no hit dice known</small>}
              </div>
            ))}
            {field("hours", text(hours, setHours, "1", "number"))}
          </fieldset>
        )}

        {kind === "long-rest" && (
          <>
            <label className="placeholder-rider">
              <input type="checkbox" checked={fed} onChange={(e) => setFed(e.target.checked)} />
              <span className="placeholder-rider-name">Had food and drink</span>
              <small className="placeholder-hint">a level of exhaustion goes</small>
            </label>
            <label className="placeholder-rider">
              <input type="checkbox" checked={interrupted} onChange={(e) => setInterrupted(e.target.checked)} />
              <span className="placeholder-rider-name">Interrupted</span>
              <small className="placeholder-hint">an hour of fighting or walking — no benefit</small>
            </label>
            {field("hours", text(hours, setHours, "8", "number"))}
            {restWarnings.map((w) => (
              <p key={w} className="placeholder-warn">
                {w}
              </p>
            ))}
          </>
        )}

        {kind === "loot" && (
          <>
            <fieldset className="placeholder-party-rows">
              <legend className="placeholder-label">Found</legend>
              {lootRows
                .filter((r) => r.inside == null)
                .map((r) => {
                  const inside = lootRows.filter((x) => x.inside === r.id);
                  const holder = isHolder(r);
                  return (
                    <div key={r.id} className="placeholder-party-row placeholder-party-find">
                      {findLine(r)}
                      {/* Where it came from: the fallen it's taken off, whose ammunition. */}
                      {r.from && <small className="placeholder-hint placeholder-party-from">{r.from}</small>}
                      {/* A container found, and what's in it — stowed with it. */}
                      {holder && (
                        <div className="placeholder-party-inside">
                          <small className="placeholder-hint">Holding</small>
                          {inside.map((x) => (
                            <div key={x.id} className="placeholder-party-row">
                              {findLine(x)}
                            </div>
                          ))}
                          <button type="button" className="placeholder-party-add" onClick={() => putInside(r.id)}>
                            + put something in the {r.name}
                          </button>
                        </div>
                      )}
                      {!holder && r.name.trim() && (
                        <button
                          type="button"
                          className="placeholder-party-flag"
                          onClick={() => setRow(r.id, { holds: true })}
                        >
                          it holds things
                        </button>
                      )}
                      {/* Where it goes: a member, or a container one carries — or nowhere. */}
                      <label className="placeholder-party-to">
                        <span>→</span>
                        <select
                          className={`placeholder-select${r.to ? "" : " is-left"}`}
                          value={r.to ?? ""}
                          aria-label={`Where ${r.name || "it"} goes`}
                          onChange={(e) => setRow(r.id, { to: e.target.value || undefined })}
                        >
                          {[...new Set(destinations.map((d) => d.carrier))].map((carrier) => (
                            <optgroup key={carrier} label={`Carried by ${carrier}`}>
                              {destinations.map((d, k) =>
                                d.carrier === carrier ? (
                                  <option key={k} value={`d:${k}`}>
                                    {d.label}
                                  </option>
                                ) : null
                              )}
                            </optgroup>
                          ))}
                          <option value="">Leave behind</option>
                        </select>
                      </label>
                    </div>
                  );
                })}
              <button
                type="button"
                className="placeholder-party-add"
                onClick={() =>
                  setLootRows((all) => [
                    ...all,
                    { id: newId(), name: "", qty: 1, link: true, ...(fallback ? { to: fallback } : {}) },
                  ])
                }
              >
                + something else
              </button>
            </fieldset>
            <fieldset className="placeholder-party-coins">
              <legend className="placeholder-label">Coins</legend>
              {(["gp", "sp", "cp"] as const).map((c) => (
                <label key={c} className="placeholder-party-die">
                  <input
                    type="number"
                    min={0}
                    className="placeholder-input"
                    value={coins[c]}
                    onChange={(e) => setCoins((all) => ({ ...all, [c]: e.target.value }))}
                  />
                  <span>{c}</span>
                </label>
              ))}
              {/* Whose purse: one member's, or split evenly among those ticked. */}
              <div className="placeholder-party-coins-to">
                {!split && (
                  <label className="placeholder-party-die">
                    <span>to</span>
                    {select(coinsTo, names, setCoinsTo)}
                  </label>
                )}
                <label className="placeholder-rider">
                  <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />
                  <span className="placeholder-rider-name">Split evenly</span>
                </label>
              </div>
            </fieldset>
          </>
        )}

        {kind === "travel" && (
          <>
            {field("to", text(destination, setDestination, "Wisdom's Path"))}
            <div className="placeholder-party-inline">
              {field("miles", text(miles, setMiles, "12", "number"))}
              {field("terrain", text(terrain, setTerrain, "forest, hills"))}
              {field(
                "pace",
                select(pace, ["fast", "normal", "slow"], (v) => setPace(v as "fast" | "normal" | "slow"))
              )}
              {field("DC", text(dc, setDc, "14", "number"))}
            </div>
            <fieldset className="placeholder-party-rows">
              <legend className="placeholder-label">Roles</legend>
              {roles.map((r, i) => (
                <div key={i} className="placeholder-party-row">
                  <input
                    className="placeholder-input"
                    value={r.role}
                    onChange={(e) =>
                      setRoles((all) => all.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))
                    }
                  />
                  {select(r.who, ["", ...names], (v) =>
                    setRoles((all) => all.map((x, j) => (j === i ? { ...x, who: v } : x)))
                  )}
                  {select(r.skill, SKILLS, (v) =>
                    setRoles((all) => all.map((x, j) => (j === i ? { ...x, skill: v } : x)))
                  )}
                </div>
              ))}
            </fieldset>
            {field(
              "encounter on a d100 under",
              text(encounterUnder, setEncounterUnder, "25", "number"),
              "blank: no encounter roll"
            )}
          </>
        )}

        {kind === "weather" && (
          <>
            <div className="placeholder-party-inline">
              {(Object.keys(WEATHER) as Array<keyof typeof WEATHER>).map((k) => (
                <React.Fragment key={k}>
                  {field(
                    k,
                    select(sky[k], WEATHER[k], (v) => setSky((all) => ({ ...all, [k]: v })))
                  )}
                </React.Fragment>
              ))}
            </div>
            <button
              type="button"
              className="placeholder-party-add"
              onClick={() =>
                setSky({
                  season: sky.season,
                  temperature: pick(WEATHER.temperature),
                  wind: pick(WEATHER.wind),
                  sky: pick(WEATHER.sky),
                })
              }
            >
              🎲 roll the day's weather
            </button>
          </>
        )}

        {kind === "group-check" && (
          <>
            {field("what", text(what, setWhat, "Sneak past the camp"))}
            <div className="placeholder-party-inline">
              {field("skill", select(skill, SKILLS, setSkill))}
              {field("DC", text(dc, setDc, "10", "number"))}
            </div>
            <small className="placeholder-hint">Half the group or more succeeding, the group does.</small>
          </>
        )}

        {kind === "luck" && <>{field("each gets", text(amount, setAmount, "1", "number"))}</>}

        {kind === "shop" && (
          <>
            <div className="placeholder-party-inline">
              {field("who", select(buyer, names, setBuyer))}
              {field("where", text(at, setAt, "the market"))}
            </div>
            <fieldset className="placeholder-party-rows">
              <legend className="placeholder-label">Buys and sells</legend>
              {shopRows.map((r, i) => (
                <div key={i} className="placeholder-party-row">
                  <NoteCombobox
                    value={r.item}
                    options={items}
                    placeholder="Find an item…"
                    onChange={(item, note) => {
                      setShopRows((all) => all.map((x, j) => (j === i ? { ...x, item, link: !!note } : x)));
                      // A note picked brings its price.
                      if (note && itemCost)
                        void itemCost(note.name).then((cost) => {
                          if (cost == null) return;
                          setShopRows((all) =>
                            all.map((x, j) =>
                              j === i && x.item === item
                                ? {
                                    ...x,
                                    price: cost.price,
                                    ...(cost.bundle ? { bundle: cost.bundle } : { bundle: undefined }),
                                  }
                                : x
                            )
                          );
                        });
                    }}
                  />
                  <input
                    type="number"
                    min={0}
                    className="placeholder-input placeholder-party-qty"
                    value={r.qty}
                    onChange={(e) =>
                      setShopRows((all) => all.map((x, j) => (j === i ? { ...x, qty: num(e.target.value) } : x)))
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="placeholder-input placeholder-party-qty"
                    value={r.price}
                    title={r.bundle ? `price of a bundle of ${r.bundle}, in gp` : "price each, in gp"}
                    onChange={(e) =>
                      setShopRows((all) => all.map((x, j) => (j === i ? { ...x, price: num(e.target.value) } : x)))
                    }
                  />
                  <label className="placeholder-rider">
                    <input
                      type="checkbox"
                      checked={!!r.sell}
                      onChange={(e) =>
                        setShopRows((all) => all.map((x, j) => (j === i ? { ...x, sell: e.target.checked } : x)))
                      }
                    />
                    <span>sells</span>
                  </label>
                  {r.bundle && (
                    <small className="placeholder-hint placeholder-party-from">
                      bundles of {r.bundle} — writes {r.qty * r.bundle} pieces
                    </small>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="placeholder-party-add"
                onClick={() => setShopRows((all) => [...all, { item: "", qty: 1, price: 0 }])}
              >
                + another
              </button>
            </fieldset>
          </>
        )}

        {kind === "end-session" && (
          <>
            {field("XP each", text(amount, setAmount, "0", "number"), "a milestone, a great moment — blank for none")}
          </>
        )}

        <div className="placeholder-buttons">
          <button type="submit" className="placeholder-submit">
            Next
          </button>
          <button type="button" onClick={onCancel} className="placeholder-cancel">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
