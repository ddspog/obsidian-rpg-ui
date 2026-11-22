/**
 * `rpg sim` — the encounter simulator's entry: wires the sim's own strict flag
 * parse and dispatch to the vault boot and the commands (run, suggest, plan, catalog).
 */

import { boot, findVault } from "../app";
import { simCatalog } from "./catalog";
import { simMain, type SimIo } from "./dispatch";
import { simBuild } from "./build";
import { simHomebrew } from "./homebrew";
import { simPlan } from "./plan";
import { simEquivalents, simRoles } from "./roles";
import { simRun } from "./run";
import { simSuggest } from "./suggest";
import { simCalibrate } from "./calibrate";
import { simLineages } from "./lineages";
import { simTemplates } from "./templates";

export type { SimIo };

/** Runs `rpg sim …` over the tokens after `sim`; resolves to the process exit code. */
export function simEntry(tokens: string[], io: SimIo): Promise<number> {
  return simMain(tokens, io, {
    context: (vault) => boot(findVault(vault)),
    run: simRun,
    suggest: simSuggest,
    catalog: simCatalog,
    plan: simPlan,
    roles: simRoles,
    equivalents: simEquivalents,
    build: simBuild,
    homebrew: simHomebrew,
    templates: simTemplates,
    lineages: simLineages,
    calibrate: simCalibrate,
  });
}
