export type Vantage = "normal" | "adv" | "dis";

export interface D20Result {
  /** Every die rolled: one, or two with advantage / disadvantage. */
  dice: number[];
  /** The die that counts. */
  kept: number;
  modifier: number;
  total: number;
}

export interface DamageResult {
  dice: number[];
  bonus: number;
  total: number;
  crit: boolean;
}

export type Rng = () => number;

const rollDie = (sides: number, rng: Rng) => Math.floor(rng() * sides) + 1;

/** `1d8+3`, `2d6`, `1d10 - 1`, `4` → its parts; null when it isn't dice. */
export function parseDice(expr: string): { count: number; sides: number; bonus: number } | null {
  const m = expr.replace(/\s+/g, "").match(/^(\d+)d(\d+)([+−-]\d+)?$/i);
  if (!m) return null;
  const count = parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  if (count < 1 || sides < 2) return null;
  const bonus = m[3] ? parseInt(m[3].replace("−", "-"), 10) : 0;
  return { count, sides, bonus };
}

export function rollD20(modifier: number, vantage: Vantage = "normal", rng: Rng = Math.random): D20Result {
  const dice = vantage === "normal" ? [rollDie(20, rng)] : [rollDie(20, rng), rollDie(20, rng)];
  const kept = vantage === "adv" ? Math.max(...dice) : vantage === "dis" ? Math.min(...dice) : dice[0];
  return { dice, kept, modifier, total: kept + modifier };
}

/** Roll a damage expression; a critical hit doubles the dice, not the bonus. */
export function rollDamage(expr: string, crit = false, rng: Rng = Math.random): DamageResult | null {
  const parsed = parseDice(expr);
  if (!parsed) return null;
  const count = crit ? parsed.count * 2 : parsed.count;
  const dice = Array.from({ length: count }, () => rollDie(parsed.sides, rng));
  return { dice, bonus: parsed.bonus, total: dice.reduce((a, b) => a + b, 0) + parsed.bonus, crit };
}

export function formatModifier(n: number): string {
  return (n >= 0 ? "+" : "−") + Math.abs(n);
}
