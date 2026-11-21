import type { Ctx } from "../app";
import { parseSimArgv, SIM_HELP, type SimOptions, UsageError, validateForSubcommand } from "./flags";

export type SimHandler = (ctx: Ctx, options: SimOptions) => Promise<{ doc: unknown }>;

export interface SimIo {
  out(s: string): void;
  err(s: string): void;
}

export interface SimDeps {
  /** Boots the vault; called only when a subcommand is about to run. */
  context(vault?: string): Ctx;
  run: SimHandler;
  suggest: SimHandler;
}

/**
 * Runs `rpg sim <tokens>` and returns the exit code: 0 for help and a printed document,
 * 1 for a usage error. Any other error propagates (the caller exits 2).
 */
export async function simMain(tokens: string[], io: SimIo, deps: SimDeps): Promise<number> {
  const usage = (message: string): number => {
    io.err(`rpg sim: ${message}\n\n${SIM_HELP}`);
    return 1;
  };
  try {
    const { subcommand, help, options } = parseSimArgv(tokens);
    if (help || subcommand === undefined || subcommand === "help") {
      io.out(SIM_HELP);
      return 0;
    }
    const handler = subcommand === "run" ? deps.run : subcommand === "suggest" ? deps.suggest : undefined;
    if (!handler) return usage(`Unknown subcommand "${subcommand}" (use run or suggest).`);
    validateForSubcommand(subcommand, options);
    const { doc } = await handler(deps.context(options.vault), options);
    io.out(JSON.stringify(doc, null, 2));
    return 0;
  } catch (err) {
    if (err instanceof UsageError) return usage(err.message);
    throw err;
  }
}
