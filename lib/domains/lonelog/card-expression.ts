/**
 * Card Expression Parser
 * Recognizes and parses card notation from Lonelog Card Notation Add-on v1.0.0
 * Supports standard playing cards, Tarot (Major/Minor Arcana), and oracle decks.
 */

export type CardType = "standard" | "major_arcana" | "minor_arcana" | "joker" | "oracle";

export interface ParsedCard {
  type: CardType;
  raw: string;
  rank?: string;
  suit?: string;
  number?: number;
  name?: string;
  reversed: boolean;
}

export interface ParsedCardDraw {
  position?: string;
  card: ParsedCard;
}

export interface ParsedSpread {
  draws: ParsedCardDraw[];
  deckLabel?: string;
}

const STANDARD_SUITS: Record<string, string> = {
  h: "Hearts",
  d: "Diamonds",
  c: "Clubs",
  s: "Spades",
};

const STANDARD_RANKS: Record<string, string> = {
  A: "Ace",
  J: "Jack",
  Q: "Queen",
  K: "King",
};

const TAROT_SUITS: Record<string, string> = {
  Wa: "Wands",
  Cu: "Cups",
  Sw: "Swords",
  Pe: "Pentacles",
};

const TAROT_COURT: Record<string, string> = {
  Pg: "Page",
  Kn: "Knight",
  Q: "Queen",
  K: "King",
};

const MAJOR_ARCANA: Record<number, string> = {
  0: "The Fool",
  1: "The Magician",
  2: "The High Priestess",
  3: "The Empress",
  4: "The Emperor",
  5: "The Hierophant",
  6: "The Lovers",
  7: "The Chariot",
  8: "Strength",
  9: "The Hermit",
  10: "Wheel of Fortune",
  11: "Justice",
  12: "The Hanged Man",
  13: "Death",
  14: "Temperance",
  15: "The Devil",
  16: "The Tower",
  17: "The Star",
  18: "The Moon",
  19: "The Sun",
  20: "Judgement",
  21: "The World",
};

// Regex patterns
const MAJOR_RE = /^M(\d{1,2})(r)?$/;
const MINOR_RE = /^(A|[2-9]|10|Pg|Kn|Q|K)(Wa|Cu|Sw|Pe)(r)?$/;
const STANDARD_RE = /^(A|[2-9]|10|J|Q|K)([hdcs])$/;
const JOKER_RE = /^(R|B)?Jkr$/;

export function parseCard(raw: string): ParsedCard | null {
  // Major Arcana: M0-M21, optional r
  const majorMatch = raw.match(MAJOR_RE);
  if (majorMatch) {
    const num = parseInt(majorMatch[1], 10);
    if (num > 21) return null;
    return {
      type: "major_arcana",
      raw,
      number: num,
      name: MAJOR_ARCANA[num],
      reversed: majorMatch[2] === "r",
    };
  }

  // Minor Arcana: rank + tarot suit, optional r
  const minorMatch = raw.match(MINOR_RE);
  if (minorMatch) {
    const rank = minorMatch[1];
    const suit = minorMatch[2];
    const rankName = TAROT_COURT[rank] || STANDARD_RANKS[rank] || rank;
    return {
      type: "minor_arcana",
      raw,
      rank: rankName,
      suit: TAROT_SUITS[suit],
      reversed: minorMatch[3] === "r",
    };
  }

  // Joker
  const jokerMatch = raw.match(JOKER_RE);
  if (jokerMatch) {
    const color = jokerMatch[1] === "R" ? "Red" : jokerMatch[1] === "B" ? "Black" : undefined;
    return {
      type: "joker",
      raw,
      name: color ? `${color} Joker` : "Joker",
      reversed: false,
    };
  }

  // Standard playing card: rank + suit
  const stdMatch = raw.match(STANDARD_RE);
  if (stdMatch) {
    const rank = stdMatch[1];
    const suit = stdMatch[2];
    const rankName = STANDARD_RANKS[rank] || rank;
    return {
      type: "standard",
      raw,
      rank: rankName,
      suit: STANDARD_SUITS[suit],
      reversed: false,
    };
  }

  return null;
}

export function isCardDraw(rollText: string): boolean {
  // Card draws use "draw=" or "Position=" with recognizable card notation
  if (/\bdraw\s*=/.test(rollText)) return true;
  // Check if any =value matches card patterns
  const eqMatches = rollText.match(/=(\S+)/g);
  if (eqMatches) {
    return eqMatches.some((m) => {
      const val = m.slice(1);
      return parseCard(val) !== null;
    });
  }
  return false;
}

export function parseCardDraws(rollText: string): ParsedSpread {
  const spread: ParsedSpread = { draws: [] };

  // Extract deck label from // annotation
  const descMatch = rollText.match(/\s*\/\/\s*(.+?)(?==)/);
  if (descMatch) {
    spread.deckLabel = descMatch[1].trim();
  }

  // Parse position=card pairs (comma or newline separated)
  const pairRe = /(\w[\w\s]*?)\s*=\s*([^\s,]+)/g;
  let match;
  while ((match = pairRe.exec(rollText)) !== null) {
    const position = match[1].trim();
    const cardRaw = match[2].trim();

    const card = parseCard(cardRaw);
    if (card) {
      const pos = position.toLowerCase() === "draw" ? undefined : position;
      spread.draws.push({ position: pos, card });
    } else {
      // Oracle deck — free text card name
      spread.draws.push({
        position: position.toLowerCase() === "draw" ? undefined : position,
        card: { type: "oracle", raw: cardRaw, name: cardRaw, reversed: false },
      });
    }
  }

  return spread;
}

export function formatCard(card: ParsedCard): string {
  switch (card.type) {
    case "major_arcana":
      return `${card.name}${card.reversed ? " (reversed)" : ""}`;
    case "minor_arcana":
      return `${card.rank} of ${card.suit}${card.reversed ? " (reversed)" : ""}`;
    case "standard":
      return `${card.rank} of ${card.suit}`;
    case "joker":
      return card.name || "Joker";
    case "oracle":
      return card.name || card.raw;
    default:
      return card.raw;
  }
}

export function suitColor(card: ParsedCard): "red" | "black" | "neutral" {
  if (card.type === "standard") {
    return card.suit === "Hearts" || card.suit === "Diamonds" ? "red" : "black";
  }
  if (card.type === "minor_arcana") {
    return card.suit === "Cups" || card.suit === "Wands" ? "red" : "black";
  }
  return "neutral";
}
