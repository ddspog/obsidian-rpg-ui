/**
 * Finding the grid in a battle-map picture: how many pixels a square is, and
 * where the first grid line falls — so a picture can be played on without
 * measuring it by hand.
 *
 * Grid lines are thin, straight and evenly spaced, so they show in the
 * picture's brightness averaged down each column (and along each row) as a
 * regular ripple over the art. Take the ripple (brightness less its local
 * average), find the spacing it repeats at (autocorrelation), then the exact
 * spacing and phase that land the most lines on it.
 */

export interface DetectedGrid {
  /** Pixels per square. */
  cell: number;
  /** Where the first grid line falls, in pixels (−cell/2 … cell/2). */
  offsetX: number;
  offsetY: number;
}

/** Brightness less its local average: what's left is the lines. */
function ripple(profile: number[], reach = 6): number[] {
  return profile.map((v, i) => {
    const from = Math.max(0, i - reach);
    const to = Math.min(profile.length, i + reach + 1);
    let sum = 0;
    for (let j = from; j < to; j++) sum += profile[j];
    return v - sum / (to - from);
  });
}

/** How strongly a signal repeats every `p` pixels. */
function repeatsAt(s: number[], p: number): number {
  let sum = 0;
  for (let i = 0; i + p < s.length; i++) sum += s[i] * s[i + p];
  return sum / Math.max(1, s.length - p);
}

/** The mean of a signal at the lines a spacing and phase put on it. */
function onLines(s: number[], cell: number, phase: number): number {
  let sum = 0;
  let n = 0;
  for (let x = phase; x < s.length - 1; x += cell) {
    const a = Math.floor(x);
    const f = x - a;
    sum += s[a] * (1 - f) + s[a + 1] * f;
    n++;
  }
  return n ? sum / n : 0;
}

/** The phase that lands the most line on a spacing, and how much. */
function bestPhase(s: number[], cell: number): { phase: number; score: number } {
  let best = { phase: 0, score: -Infinity };
  for (let phase = 0; phase < cell; phase += 0.25) {
    const score = onLines(s, cell, phase);
    if (score > best.score) best = { phase, score };
  }
  return best;
}

const std = (s: number[]) => {
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
};

/**
 * The grid in a picture, from its brightness averaged down each column and
 * along each row. Null when no grid stands out from the art.
 */
export function gridFromProfiles(columns: number[], rows: number[], minCell = 12, maxCell = 200): DetectedGrid | null {
  const sx = ripple(columns);
  const sy = ripple(rows);
  const top = Math.min(maxCell, Math.floor(Math.min(sx.length, sy.length) / 3));
  if (top < minCell) return null;

  // The spacing both directions repeat at. A grid repeats at every multiple
  // of its square too (2 squares, 3…), so of spacings that repeat nearly as
  // strongly as the strongest, the smallest is the square.
  const strength = (p: number) => repeatsAt(sx, p) / (std(sx) ** 2 || 1) + repeatsAt(sy, p) / (std(sy) ** 2 || 1);
  let coarse = minCell;
  let strongest = -Infinity;
  for (let p = minCell; p <= top; p++) {
    const r = strength(p);
    if (r > strongest) {
      strongest = r;
      coarse = p;
    }
  }
  // Smallest first: the most squares the strongest spacing could hold.
  for (let k = Math.floor(coarse / minCell); k >= 2; k--) {
    const p = Math.round(coarse / k);
    if (p < minCell) continue;
    // The best of the spacings around a fraction (it falls between pixels).
    const near = Math.max(strength(p - 1), strength(p), strength(p + 1));
    if (near >= 0.6 * strongest) {
      coarse = [p - 1, p, p + 1].reduce((a, b) => (strength(b) > strength(a) ? b : a));
      break;
    }
  }

  // Exactly: the spacing (and each direction's phase) that hits the most line.
  let found = { cell: coarse, x: 0, y: 0, score: -Infinity };
  for (let cell = coarse - 1; cell <= coarse + 1; cell += 0.02) {
    const x = bestPhase(sx, cell);
    const y = bestPhase(sy, cell);
    const score = x.score / (std(sx) || 1) + y.score / (std(sy) || 1);
    if (score > found.score) found = { cell, x: x.phase, y: y.phase, score };
  }
  // Lines that barely stand out from the art are no grid.
  if (found.score < 3) return null;

  const cell =
    Math.abs(found.cell - Math.round(found.cell)) < 0.06 ? Math.round(found.cell) : Math.round(found.cell * 100) / 100;
  const centre = (phase: number) => {
    const p = phase > cell / 2 ? phase - cell : phase;
    return Math.round(p * 2) / 2;
  };
  return { cell, offsetX: centre(found.x), offsetY: centre(found.y) };
}

/** Brightness averaged down each column and along each row of RGBA pixels. */
export function brightnessProfiles(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): { columns: number[]; rows: number[] } {
  const columns = new Array<number>(width).fill(0);
  const rows = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      columns[x] += v;
      rows[y] += v;
    }
  }
  return { columns: columns.map((c) => c / height), rows: rows.map((r) => r / width) };
}
