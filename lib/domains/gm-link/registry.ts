/**
 * How a view asks about the GM link without knowing the plugin: the plugin
 * registers what answers, the Log asks for its own note.
 */

export interface GmLinkBar {
  /** The turn is with the GM. */
  waiting: boolean;
  onHandOver: () => void;
  onCheck: () => void;
}

let provider: ((path: string) => GmLinkBar | undefined) | null = null;

export function setGmLinkProvider(p: ((path: string) => GmLinkBar | undefined) | null): void {
  provider = p;
}

/** For the Log of a linked session: whose turn it is, and the two moves. */
export const gmLinkFor = (path: string): GmLinkBar | undefined => provider?.(path);

let reword: ((path: string) => void) | null = null;

export function setRewordProvider(p: ((path: string) => void) | null): void {
  reword = p;
}

/** For a Log: opens "Improve the wording" on its note, when the plugin offers it. */
export const rewordFor = (path: string): (() => void) | undefined => (reword ? () => reword?.(path) : undefined);
