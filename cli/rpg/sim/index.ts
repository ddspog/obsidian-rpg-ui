/**
 * `rpg sim` — the encounter simulator's entry: wires the sim's own strict flag
 * parse and dispatch to the vault boot and the two commands.
 */

import { boot, findVault } from "../app";
import { simMain, type SimIo } from "./dispatch";
import { simRun } from "./run";
import { simSuggest } from "./suggest";

export type { SimIo };

/** Runs `rpg sim …` over the tokens after `sim`; resolves to the process exit code. */
export function simEntry(tokens: string[], io: SimIo): Promise<number> {
  return simMain(tokens, io, {
    context: (vault) => boot(findVault(vault)),
    run: simRun,
    suggest: simSuggest,
  });
}
