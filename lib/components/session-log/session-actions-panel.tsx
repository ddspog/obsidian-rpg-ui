import { useEffect, useId, useLayoutEffect, useRef, useState, useContext } from "react";
import { createPortal } from "react-dom";
import { CardStack as CardStackData, SessionFeatureCard } from "../../domains/session-log/card-types";
import { SessionConsumableState } from "../../domains/session-log/consumable-state";
import type { IconTone } from "../../domains/image-studio/kinds";
import type { Loadout } from "../../domains/session-log/loadouts";
import { economyResources, type HotbarResource, type TileKind } from "../../domains/session-log/hotbar-model";
import { Hotbar } from "./hotbar";
import { castBlock } from "../../domains/session-log/casting";
import { DrawerContext } from "./bottom-drawer";
import { HudCharacter } from "./hud-character";
import { HudRoster } from "./hud-roster";
import { HudTurn } from "./hud-turn";
import { LucideIcon } from "./lucide-icon";
import type { HudInfo } from "../../domains/session-log/hud";
import { PassivePopover } from "./passive-popover";
import { PlaceholderPopover } from "./placeholder-popover";
import type { LootDestination } from "../../domains/session-log/loot-destinations";
import type { NoteOption } from "./note-combobox";
import type { ItemPrice } from "../../domains/session-log/party-cards";
import { PartyPopover, type LootSource, type PartyCardKind } from "./party-popover";
import type { PartyMember } from "../../domains/session-log/party-cards";
import { StartCombatPopover, type CreatureInfo } from "./start-combat-popover";
import type { FormulaVars } from "../../domains/session-log/formula";
import type { MapTools } from "../../domains/battlemap/map-tools";
import type { HeaderMap } from "../../domains/session-log";
import type { CombatClock } from "../../domains/session-log/turns";
import type { ConditionEffects } from "../../domains/session-log/roll-advice";
import type { Health } from "../../domains/session-log/health";

/** A move about to be made, read against the movement rules. */
export interface MovePreview {
  feet: number;
  /** Feet walked in the actor's round with it. */
  spent: number;
  /** What the actor may walk this round (its speed, doubled by a Dash). */
  allowance?: number;
  /** Hostile creatures whose reach it leaves. */
  provokes: string[];
  /** Granted by the card (Scurry) — held to its limit. */
  granted?: string;
  /** A plain move outside the actor's own round. */
  offTurn?: boolean;
}

interface SessionActionsPanelProps {
  pcStacks: Map<string, CardStackData[]>;
  /** The foes still in play, with their actions — their own tab, and gone
   *  once a foe is marked down. */
  foeStacks?: Map<string, CardStackData[]>;
  gmStacks: CardStackData[];
  /** Only the GM's cards (the draft block): no roster to pick from, no Rest. */
  gmOnly?: boolean;
  consumableState: SessionConsumableState;
  entities: string[];
  /** Append to the log — with a new map for its header, from Start Combat. */
  onAppendText: (text: string, headerMap?: HeaderMap) => void;
  onSpend: (cardId: string) => void;
  /** The note the log lives in — links in a card's preview resolve against it. */
  sourcePath?: string;
  /** An actor's value for a `[[Name]]` roll term, for the preview's rolls. */
  resolveRef?: (actor: string, name: string) => number | undefined;
  /** The log's running values now (`CF` → 4), for the preview's oracles. */
  vars?: FormulaVars;
  /** Look up a foe's statblock (HP, Initiative) — for Start Combat. */
  lookupCreature?: (link: string) => Promise<CreatureInfo>;
  /** Battle maps to choose from (and pictures to make one of) — for Start Combat. */
  mapTools?: MapTools;
  /** Present while the log is inside a fight: party and foe cards then offer
   *  a move with the action, starting from where the actor stands (if known). */
  combat?: {
    squareOf: (actor: string) => string | undefined;
    clock: CombatClock;
    /** A move about to be made, read against the rules: its feet, the round's
     *  feet with it of what the actor may walk, who it would provoke. */
    moveAhead?: (actor: string, routes: string[], grant?: SessionFeatureCard["grantsMove"]) => MovePreview | undefined;
    /** Who the log's last move provoked: the mover an actor's Opportunity Attack is aimed at. */
    provokedFor?: (actor: string) => string | undefined;
    /** How far a target is from the actor, once its routes are walked. */
    distanceTo?: (actor: string, target: string, routes?: string[]) => number | undefined;
    /** The hostiles within 5 ft of the actor there — a ranged attack's disadvantage. */
    crowding?: (actor: string, routes?: string[]) => string[];
    /** The fight's XP: its foes and what each is worth, and the party members who fought it. */
    xp?: { foes: Array<{ name: string; xp?: number }>; party: string[] };
  };
  /** The fight as it stands (who's marked, who's a foe) — for an attack's riders. */
  fight?: {
    conditionsOf: (name: string) => string[];
    withCondition: (c: string) => string[];
    isFoe: (name: string) => boolean;
  };
  /** A target's AC and its health now — for an attack card's Target AC and preview. */
  defense?: { ac: (name: string) => number | undefined; health: (name: string) => Health | undefined };
  /** What an actor has spent now (this round's action and bonus, its reaction
   *  since its round) — a card about to spend one again says so. */
  slotsUsed?: (actor: string) => Record<"action" | "bonus" | "reaction", string[]>;
  /** Everyone's conditions now, and what each does to rolls — a card says what
   *  to roll with (advantage on a blinded target). */
  rollConditions?: {
    conditionsOf: (name: string) => string[];
    effectsOf: (condition: string) => ConditionEffects | undefined;
  };
  /** Make a character's picture (a PC's portrait, a foe's image) in the image studio. */
  onMakePortrait?: (drawerName: string) => void;
  /** The page's left margin beside the prose, where the roster goes when it fits. */
  rosterHost?: HTMLElement | null;
  /** Flip a toggle (a Rage): its state is kept apart from the log. */
  onToggle?: (card: SessionFeatureCard) => void;
  /** The loadouts a character's sheet declares — what they can switch to at will. */
  loadoutsFor?: (actor: string) => Loadout[];
  /** Put a loadout in hand: the sheet's slots rewritten. */
  onEquip?: (actor: string, loadout: string) => void;
  /** Which loadout is in hand now, when one matches. */
  heldLoadoutOf?: (actor: string) => string | undefined;
  /** The HUD's face, hands and loadout icons for a character, by drawer name. */
  hudOf?: (drawerName: string) => HudInfo | undefined;
  /** Open a character's sheet (clicking their portrait). */
  onOpenSheet?: (path: string) => void;
  /** A card's own icon art, when the vault has some. */
  iconFor?: (name: string) => string | undefined;
  /** Make a card's icon in the image studio (a tile's right-click). */
  onMakeIcon?: (card: SessionFeatureCard, kind: TileKind) => void;
  /** Make an icon for a held item or a loadout. */
  onMakeNamedIcon?: (what: { name: string; text?: string; tone?: IconTone }) => void;
  /** An actor's slots and feature uses now, for the hotbar's pills. */
  resourcesFor?: (actor: string) => HotbarResource[];
  /** Whether a combatant is down now (0 HP, dead, fled) — off an attack's targets. */
  isDown?: (name: string) => boolean;
  /** Whether a PC is dying (0 HP, making death saves) — Stabilize's targets. */
  isDying?: (name: string) => boolean;
  /** The party as one: its members now, where loot can go, what the last fight
   *  left, and the day's clock — for the Party's cards. */
  party?: {
    members: PartyMember[];
    destinations: LootDestination[];
    holdsThings?: (name: string) => boolean;
    lootSource?: LootSource;
    sinceLongRest?: number;
    clock?: string;
    /** The vault's item notes, to find as you type; and an item's price in gp. */
    itemNotes?: () => NoteOption[];
    itemCost?: (name: string) => Promise<ItemPrice | undefined>;
  };
}

const GM = "Game Master";
/** The party as one — what the group does together (rests, loot, the road). */
const PARTY = "Party";

/** The Party's cards, in their stacks: Rest, Spoils, Road, Group. */
const PARTY_CARDS: Array<{ stack: string; kind: PartyCardKind; name: string; icon: string; summary: string }> = [
  {
    stack: "Rest",
    kind: "short-rest",
    name: "Short Rest",
    icon: "🔥",
    summary: "An hour's rest: spend hit dice (each its die + CON), and what recharges on a short rest comes back.",
  },
  {
    stack: "Rest",
    kind: "long-rest",
    name: "Long Rest",
    icon: "🌙",
    summary:
      "Eight hours: all HP back, half the hit dice, what recharges on a long rest, spell slots — once a day, and only from 1 HP.",
  },
  {
    stack: "Spoils",
    kind: "loot",
    name: "Loot",
    icon: "💰",
    summary:
      "Take what the fallen left — their gear, spent ammunition recovered, coins and treasure — into a pack or a shared bag.",
  },
  {
    stack: "Spoils",
    kind: "shop",
    name: "Shop",
    icon: "🛒",
    summary: "Buy and sell: items in and out of a pack, coins the other way.",
  },
  {
    stack: "Road",
    kind: "travel",
    name: "Travel",
    icon: "🧭",
    summary: "A stage of the journey: where, how far, the pace — each role's check, and whether something finds them.",
  },
  {
    stack: "Road",
    kind: "weather",
    name: "Weather",
    icon: "⛅",
    summary: "The day's weather — season, temperature, wind, sky — set or rolled, carried on until it changes.",
  },
  {
    stack: "Group",
    kind: "group-check",
    name: "Group Check",
    icon: "🤝",
    summary: "A check the whole group makes: half or more succeeding, the group does.",
  },
  {
    stack: "Group",
    kind: "luck",
    name: "Luck",
    icon: "🍀",
    summary: "Hand out Luck — after a hard fight survived, a great moment.",
  },
  {
    stack: "Group",
    kind: "end-session",
    name: "End of Session",
    icon: "📕",
    summary: "Close the session: its milestone XP, and how it ended.",
  },
];

/**
 * A side of the table: who it holds, each with their card stacks. The drawer
 * shows one side at a time — Party (the GM and the PCs) and Foes today; an
 * NPCs side is one more entry here.
 */
interface Side {
  id: string;
  label: string;
  actors: string[];
  stacksFor: (actor: string) => CardStackData[];
  /** Chips on this side read as opponents. */
  foe?: boolean;
}

export function SessionActionsPanel({
  pcStacks,
  foeStacks = new Map(),
  gmStacks,
  gmOnly = false,
  consumableState,
  entities,
  onAppendText,
  onSpend,
  sourcePath,
  resolveRef,
  vars,
  lookupCreature,
  mapTools,
  combat,
  defense,
  fight,
  slotsUsed,
  rollConditions,
  isDown,
  resourcesFor,
  onEquip,
  hudOf,
  onOpenSheet,
  rosterHost,
  onMakePortrait,
  onToggle,
  iconFor,
  onMakeIcon,
  onMakeNamedIcon,
  isDying,
  party,
}: SessionActionsPanelProps) {
  const foes = [...foeStacks.keys()];
  // A side with nobody on it isn't offered — outside a fight there is no Foes tab.
  // In a fight, anyone can just move — no action, only speed — and a move can
  // set things off (an opportunity attack). Not a card of its own: a button by
  // whoever's picked, opening the same popup as a card.
  const moveCard = (who: string): SessionFeatureCard => ({
    id: `move:${who}`,
    name: "Move",
    bucket: "action",
    kind: "move",
    logTemplate: "@({{actor}}) Moves\n=> {{outcome?}}",
    summary: "Move without acting — no action spent, only speed. The Log says what it costs and what it provokes.",
    icon: "👣",
    source: "move",
    actor: who,
  });
  // Switching what's in hand is a plain switch, not a card: a button by whoever's
  // picked, when their sheet declares loadouts, listing them — one click puts
  // one in hand on the sheet. Nothing is logged.
  const partyStacks: CardStackData[] = ["Rest", "Spoils", "Road", "Group"].map((stack) => ({
    actor: PARTY,
    actorType: "pc" as const,
    bucket: `party-${stack.toLowerCase()}`,
    label: stack,
    cards: PARTY_CARDS.filter((c) => c.stack === stack).map((c) => ({
      id: `party:${c.kind}`,
      name: c.name,
      bucket: "action" as const,
      kind: "party" as const,
      partyKind: c.kind,
      logTemplate: "",
      summary: c.summary,
      icon: c.icon,
      source: "party",
      actor: PARTY,
    })),
  }));
  const allSides: Side[] = [
    {
      id: "party",
      label: "Party",
      // The GM's cards and the party's together, as one: the table.
      actors: [GM, ...pcStacks.keys()],
      stacksFor: (a: string) =>
        a === GM ? [...gmCards, ...(party && party.members.length > 0 ? partyStacks : [])] : (pcStacks.get(a) ?? []),
    },
    { id: "foes", label: "Foes", actors: foes, stacksFor: (a: string) => foeStacks.get(a) ?? [], foe: true },
  ];
  const sides = allSides.filter((s) => s.actors.length > 0);
  // The turn, round and end cards only mean something in a fight; starting one
  // only outside it.
  const isFightCard = (c: SessionFeatureCard) =>
    c.kind === "next-turn" || c.kind === "next-round" || c.kind === "end-combat";
  const gmCards = gmStacks
    .map((s) => ({ ...s, cards: s.cards.filter((c) => (combat ? c.kind !== "start-combat" : !isFightCard(c))) }))
    .filter((s) => s.cards.length > 0);

  const radioName = useId();
  const drawer = useContext(DrawerContext);
  // The roster takes the page's left margin beside the prose, as the Log
  // sidebar takes the right, when there's room for it; else it stays above the
  // cards. Re-measured as the pane resizes and the Log opens and closes.
  const panelRef = useRef<HTMLDivElement>(null);
  const [inMargin, setInMargin] = useState(false);
  useLayoutEffect(() => {
    if (!rosterHost) {
      setInMargin(false);
      return;
    }
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const view = rosterHost.closest(".markdown-preview-view, .markdown-source-view, .cm-sizer") as HTMLElement | null;
    const layout = rosterHost.closest(".lonelog-prose-layout") as HTMLElement | null;
    const measure = () => {
      const rail = rosterHost.parentElement?.getBoundingClientRect();
      if (!rail) return;
      const edge = view ? view.getBoundingClientRect().left + (parseFloat(getComputedStyle(view).paddingLeft) || 0) : 0;
      // The rail sits just left of the prose: its left edge must clear the page's.
      setInMargin(rail.left - edge >= 0.5 * rem);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (layout) ro.observe(layout);
    if (view) ro.observe(view);
    return () => ro.disconnect();
  }, [rosterHost]);
  // The side and actor last picked, kept per note — a reload (or the log
  // redrawing) comes back to them, not to the GM.
  const memoryKey = `rpg-ui:drawer:${sourcePath ?? ""}`;
  const remembered = (() => {
    try {
      return JSON.parse(window.localStorage.getItem(memoryKey) ?? "{}") as {
        side?: string;
        picked?: Record<string, string>;
      };
    } catch {
      return {};
    }
  })();
  const [sideId, setSideId] = useState(remembered.side ?? sides[0]?.id ?? "party");
  // The actor last picked on each side, so switching tabs and back keeps it.
  const [picked, setPicked] = useState<Record<string, string>>(remembered.picked ?? {});
  useEffect(() => {
    try {
      window.localStorage.setItem(memoryKey, JSON.stringify({ side: sideId, picked }));
    } catch {
      // Nowhere to keep it: it starts on the first side next time.
    }
  }, [memoryKey, sideId, picked]);
  const [activeCard, setActiveCard] = useState<SessionFeatureCard | null>(null);

  // The chosen side may have emptied (the last foe went down): fall back to the first.
  const side = sides.find((s) => s.id === sideId) ?? sides[0];
  // Likewise an actor who left the side: fall back to its first actor.
  const actor = side && side.actors.includes(picked[side.id]) ? picked[side.id] : side?.actors[0];
  // The folded drawer names who is acting.
  useEffect(() => {
    drawer?.reportActor?.(actor);
  }, [actor, drawer]);
  const currentStacks = side && actor ? side.stacksFor(actor) : [];

  // Who a card can target: a foe aims at the PCs; anyone else at the foes in
  // play (falling back to the PCs when no foe is in the fight).
  // A heal is aimed at the party, the healer first (it can be themself); an
  // attack, at the other side.
  // Targets leave out whoever's out of the fight — dead. A dying PC stays: it
  // can still be struck, and it's who a heal is for.
  const standing = (names: string[]) => (isDown ? names.filter((n) => !isDown(n)) : names);
  const targetsFor = (card: SessionFeatureCard): string[] =>
    card.targets === "dying"
      ? // Stabilize: the party's dying, only.
        entities.filter((e) => e !== card.actor && !!isDying?.(e))
      : card.targets === "allies"
        ? // A heal: the party, the healer first — the dying among them, not the dead.
          foeStacks.has(card.actor)
          ? standing([card.actor, ...foes.filter((f) => f !== card.actor)])
          : standing([card.actor, ...entities.filter((e) => e !== card.actor)])
        : foeStacks.has(card.actor)
          ? standing(entities)
          : foes.length > 0
            ? standing(foes)
            : standing(entities);

  // In a fight, a party member's or a foe's card can move them as it plays;
  // the GM's cards don't (nobody of the GM's stands on the map).
  const movementFor = (
    card: SessionFeatureCard
  ): { from?: string; check?: (routes: string[]) => MovePreview | undefined } | undefined => {
    // (A card acts under its log name — `Talon`, where the drawer says `Talon
    // Pallton` — so it's told apart by whose stack holds it, not by name.)
    if (!combat || gmStacks.some((s) => s.cards.some((c) => c.id === card.id))) return undefined;
    const from = combat.squareOf(card.actor);
    const check = combat.moveAhead
      ? (routes: string[]) => combat.moveAhead!(card.actor, routes, card.grantsMove)
      : undefined;
    return { ...(from ? { from } : {}), ...(check ? { check } : {}) };
  };

  // The turn and round cards write from the fight's state — no fields, no
  // outcome. A TURN is a pass through the initiative order: Next Turn starts
  // the next one (`T3`). Each creature's slot in it is their ROUND: Next Round
  // names whose it is (`R(Talon)`), the next in initiative picked already,
  // anyone else a choice.
  const fightCard = (card: SessionFeatureCard): { card: SessionFeatureCard; initial?: Record<string, string> } => {
    // The fight's end: its marker, then how it ended — the aftermath.
    // The fight's XP, every foe's worth added up and shared out evenly among
    // the party members who fought it (rounded down) — tagged for their sheets.
    if (card.kind === "end-combat") {
      const foes = combat?.xp?.foes ?? [];
      const party = combat?.xp?.party ?? [];
      const total = foes.reduce((n, f) => n + (f.xp ?? 0), 0);
      const each = party.length > 0 ? Math.floor(total / party.length) : 0;
      // The shares ride on the line saying how it ended — its one outcome; the
      // Log sums them up (`XP 350 — 87 each`).
      const award = each > 0 ? ` ${party.map((p) => `[${p}/XP+${each}]`).join(" ")}` : "";
      const worth = foes.map((f) => `${f.name} ${f.xp ?? "?"}`).join(" · ");
      const summary =
        each > 0
          ? `End the fight. XP: ${worth} = ${total}, shared by ${party.join(", ")} — ${each} each.`
          : card.summary;
      return {
        card: {
          ...card,
          logTemplate: `[/COMBAT]\n=> {{how_it_ended?}}${award}`,
          ...(summary ? { summary } : {}),
          ...(total > 0 ? { xpWorth: total } : {}),
        },
      };
    }
    if (card.kind === "next-turn") {
      return { card: { ...card, logTemplate: `T${(combat?.clock.round ?? 0) + 1}` } };
    }
    if (card.kind === "next-round") {
      const everyone = [
        ...(combat?.clock.next ?? []),
        ...[...pcStacks.values(), ...foeStacks.values()].flatMap((stacks) => stacks[0]?.cards[0]?.actor ?? []),
      ];
      const options = [...new Set(everyone)];
      return {
        card: { ...card, logTemplate: `R({{round:${options.join("|")}}})` },
        ...(options[0] ? { initial: { round: options[0] } } : {}),
      };
    }
    // An opportunity attack is one melee attack — the creature's own (a
    // weapon, a statblock's `reach` attack) — answering the move just made:
    // aimed at the mover when the log's last entry provoked it.
    if (/opportunity attack/i.test(card.name)) {
      const own = [...pcStacks.values(), ...foeStacks.values()]
        .flat()
        .flatMap((st) => st.cards)
        .filter(
          (c) =>
            c.actor === card.actor &&
            c.bucket === "attack" &&
            (c.attackForm === "melee" || /reach/i.test(c.range ?? ""))
        );
      const mover = combat?.provokedFor?.(card.actor);
      if (own.length > 0) {
        return {
          card: {
            ...card,
            multiattack: {
              count: 1,
              attacks: own.map((c) => ({
                name: c.name,
                logTemplate: c.logTemplate,
                ...(c.range ? { range: c.range } : {}),
                melee: true,
              })),
            },
          },
          ...(mover ? { initial: { target: mover } } : {}),
        };
      }
      if (mover) return { card, initial: { target: mover } };
    }
    return { card };
  };

  // Every card confirms before it plays: the popup says what it does (and asks
  // for any slots it needs), so a mis-click never writes into the log.
  // A passive is read, not played: its popup says what it is and changes, and
  // can note in the log that it applied. A toggle is played — it flips.
  const [readCard, setReadCard] = useState<SessionFeatureCard | null>(null);
  const handleCardClick = (card: SessionFeatureCard) => {
    if (card.toggle && onToggle) {
      // A switch: flipped at once, kept in the state — no popup, nothing logged.
      setActiveCard(null);
      setReadCard(null);
      onToggle(card);
    } else if (card.bucket === "passive" && !card.toggle) {
      setActiveCard(null);
      setReadCard(card);
    } else {
      setReadCard(null);
      setActiveCard(card);
    }
  };

  // The actor's pills: the action, bonus action and reaction (spent only in a
  // fight, each round's); their spell slots and features' uses.
  const logActor = currentStacks[0]?.cards[0]?.actor;
  const creature = !!logActor && actor !== GM && actor !== PARTY;
  // The HUD's face and hands for whoever's picked; the turn column's cards.
  const hud = creature && actor ? hudOf?.(actor) : undefined;
  // Spells that can't be cast with what's in hand — no free hand, no focus — are put away.
  const awayWhy: string[] = [];
  let awayCount = 0;
  const castable: CardStackData[] = hud?.casting
    ? currentStacks
        .map((st) => ({
          ...st,
          cards: st.cards.filter((c) => {
            const why = castBlock(c.components, c.spellSources ?? [], hud.casting!);
            if (why) {
              awayCount++;
              if (!awayWhy.includes(why)) awayWhy.push(why);
            }
            return !why;
          }),
        }))
        .filter((st) => st.cards.length > 0)
    : currentStacks;
  const awayNote = awayCount
    ? `${awayCount} spell${awayCount === 1 ? "" : "s"} put away — ${awayWhy.join(", ")}`
    : undefined;
  const endTurnCard = gmStacks.flatMap((x) => x.cards).find((c) => c.kind === "next-round");
  const oaCard = currentStacks.flatMap((x) => x.cards).find((c) => /^opportunity attack$/i.test(c.name));
  const [warnOA, setWarnOA] = useState(() => {
    try {
      return window.localStorage.getItem("rpg-ui:oa-warn") !== "0";
    } catch {
      return true;
    }
  });
  const resourcesNow: HotbarResource[] = creature
    ? [
        // Out of a fight there are no rounds to spend them in: always all there.
        ...economyResources(
          combat && slotsUsed ? slotsUsed(logActor) : { action: [], bonus: [], reaction: [] },
          !combat
        ),
        ...(resourcesFor?.(logActor) ?? []),
      ]
    : [];

  const handleResolve = (resolvedText: string, headerMap?: HeaderMap) => {
    onAppendText(resolvedText + "\n", headerMap);

    if (activeCard?.maxUses != null) onSpend(activeCard.id);
    setActiveCard(null);
  };

  const rosterNode = (
    <HudRoster
      sides={sides.map((x) => ({ id: x.id, label: x.label, count: x.actors.length, ...(x.foe ? { foe: true } : {}) }))}
      sideId={side?.id ?? ""}
      onSide={(id) => {
        setSideId(id);
        setReadCard(null);
        setActiveCard(null);
      }}
      foe={!!side?.foe}
      // GM and Party are there on whichever side is shown: they belong to the side that has them.
      specials={[GM]
        .filter((n) => sides.some((x) => x.actors.includes(n)))
        .map((n) => ({ name: n, label: "GM · Party" }))}
      actors={(side?.actors ?? [])
        .filter((n) => n !== GM && n !== PARTY)
        .map((n) => ({ name: n, log: side?.stacksFor(n)[0]?.cards[0]?.actor ?? n }))}
      active={actor}
      onPick={(name) => {
        drawer?.expand();
        // GM or Party: on the side that holds it, whichever is shown now.
        const owner = name === GM || name === PARTY ? sides.find((x) => x.actors.includes(name)) : side;
        if (!owner) return;
        if (owner.id !== side?.id) setSideId(owner.id);
        setPicked((p) => ({ ...p, [owner.id]: name }));
        setReadCard(null);
        setActiveCard(null);
      }}
      hudOf={(n) => hudOf?.(n)}
      hpOf={(log) => defense?.health(log)}
      order={combat?.clock.next ?? []}
      radioName={radioName}
      {...(onMakePortrait ? { onStudio: onMakePortrait } : {})}
    />
  );

  // The switch (Move) goes with the character at the left when there is one; else with the pills.
  const showCharacter = !!(creature && hud && actor);
  const switches =
    creature && logActor ? (
      <>
        {combat && (
          <button
            type="button"
            className="rpg-hotbar-mini"
            title="Move without acting — only speed spent"
            onClick={() => setActiveCard(moveCard(logActor))}
          >
            <LucideIcon name="Footprints" size="0.9rem" strokeWidth={1.7} />
            <span>Move</span>
          </button>
        )}
      </>
    ) : null;

  return (
    <div
      ref={panelRef}
      className={`lonelog-actions-panel${inMargin ? " is-in-margin" : ""}${gmOnly ? " is-gm-only" : ""}`}
    >
      {gmOnly ? null : inMargin && rosterHost ? createPortal(rosterNode, rosterHost) : rosterNode}
      <div className="hud-main">
        {showCharacter && (
          <HudCharacter
            name={actor}
            info={hud}
            hp={defense?.health(logActor ?? actor)}
            ac={defense?.ac(logActor ?? actor)}
            onOpenSheet={() => hud.sheetPath && onOpenSheet?.(hud.sheetPath)}
            onEquip={(l) => logActor && onEquip?.(logActor, l)}
            foe={!!side?.foe}
            {...(onMakeNamedIcon ? { onMakeIcon: onMakeNamedIcon } : {})}
            {...(switches ? { extras: switches } : {})}
          />
        )}
        <Hotbar
          key={`${side?.id}:${actor}`}
          stacks={castable}
          {...(awayNote ? { awayNote } : {})}
          resources={resourcesNow}
          {...(iconFor ? { iconFor } : {})}
          {...(onMakeIcon ? { onMakeIcon } : {})}
          consumableState={consumableState}
          onPlay={handleCardClick}
          {...(!showCharacter && switches ? { extras: switches } : {})}
        />
        {!gmOnly && (
          <HudTurn
            inCombat={!!combat}
            canRest={!side?.foe}
            {...(endTurnCard ? { onEndTurn: () => handleCardClick(endTurnCard) } : {})}
            onRest={(kind) => {
              const rest = partyStacks.flatMap((x) => x.cards).find((c) => c.partyKind === kind);
              if (rest) handleCardClick(rest);
            }}
            provoked={creature && logActor ? combat?.provokedFor?.(logActor) : undefined}
            {...(oaCard ? { onOpportunity: () => handleCardClick(oaCard) } : {})}
            warn={warnOA}
            onWarn={(on) => {
              setWarnOA(on);
              try {
                window.localStorage.setItem("rpg-ui:oa-warn", on ? "1" : "0");
              } catch {
                // Nowhere to keep it: back on next time.
              }
            }}
          />
        )}
      </div>
      {readCard && (
        <PassivePopover
          card={readCard}
          {...(sourcePath ? { sourcePath } : {})}
          onClose={() => setReadCard(null)}
          onNote={() => {
            // Played like any card, once asked: `@(Talon) Heightened Senses applies`.
            const name = readCard.name.replace(/\s*[ᴬᴮᴰᴴᴷᴺº]+$/u, "").trim();
            setActiveCard({
              ...readCard,
              id: `${readCard.id}:note`,
              bucket: "action",
              logTemplate: `@({{actor}}) ${name} applies\n=> {{outcome?}}`,
            });
            setReadCard(null);
          }}
        />
      )}
      {activeCard?.kind === "start-combat" && (
        <StartCombatPopover
          card={activeCard}
          party={entities}
          resolveRef={resolveRef}
          lookupCreature={lookupCreature}
          mapTools={mapTools}
          sourcePath={sourcePath}
          onResolve={handleResolve}
          onCancel={() => setActiveCard(null)}
        />
      )}
      {activeCard?.kind === "party" && party && (
        <PartyPopover
          key={activeCard.id}
          card={activeCard}
          kind={activeCard.partyKind as PartyCardKind}
          members={party.members}
          destinations={party.destinations}
          {...(party.holdsThings ? { holdsThings: party.holdsThings } : {})}
          {...(party.lootSource ? { lootSource: party.lootSource } : {})}
          {...(party.itemNotes ? { itemNotes: party.itemNotes } : {})}
          {...(party.itemCost ? { itemCost: party.itemCost } : {})}
          {...(party.sinceLongRest != null ? { sinceLongRest: party.sinceLongRest } : {})}
          {...(party.clock ? { clock: party.clock } : {})}
          onCompose={(text, summary) =>
            // Its lines, played as any card: previewed, rolled, an outcome to add.
            setActiveCard({
              ...activeCard,
              id: `${activeCard.id}:play`,
              kind: undefined,
              logTemplate: text,
              ...(summary ? { summary } : {}),
            })
          }
          onCancel={() => setActiveCard(null)}
        />
      )}
      {activeCard && activeCard.kind !== "start-combat" && activeCard.kind !== "party" && (
        <PlaceholderPopover
          key={activeCard.id}
          card={fightCard(activeCard).card}
          {...(fightCard(activeCard).initial ? { initialValues: fightCard(activeCard).initial } : {})}
          {...(defense ? { defense } : {})}
          {...(fight ? { fight } : {})}
          {...(slotsUsed ? { slotsUsed: slotsUsed(activeCard.actor) } : {})}
          {...(rollConditions ? { rollConditions } : {})}
          {...(combat?.distanceTo && combat.crowding
            ? {
                aim: {
                  distanceTo: (target: string, routes: string[]) =>
                    combat.distanceTo!(activeCard.actor, target, routes),
                  crowding: (routes: string[]) => combat.crowding!(activeCard.actor, routes),
                },
              }
            : {})}
          entities={targetsFor(activeCard)}
          sourcePath={sourcePath}
          resolveRef={resolveRef}
          vars={vars}
          {...(movementFor(activeCard) ? { movement: movementFor(activeCard) } : {})}
          onResolve={handleResolve}
          onCancel={() => setActiveCard(null)}
        />
      )}
    </div>
  );
}
