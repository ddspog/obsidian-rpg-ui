import type { Ctx } from "../app";
import { briefJson } from "./brief";
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
  /** `rpg sim catalog …` (optional so a harness for run and suggest need not supply it). */
  catalog?: SimHandler;
  /** `rpg sim plan …` (optional, as catalog). */
  plan?: SimHandler;
  /** `rpg sim roles …` and `rpg sim equivalents …` (optional, as catalog). */
  roles?: SimHandler;
  equivalents?: SimHandler;
  /** `rpg sim build …`. */
  build?: SimHandler;
  /** `rpg sim homebrew …`. */
  homebrew?: SimHandler;
  /** `rpg sim templates …`. */
  templates?: SimHandler;
  /** `rpg sim lineages …`. */
  lineages?: SimHandler;
  /** `rpg sim calibrate …`. */
  calibrate?: SimHandler;
  /** `rpg sim spells …`. */
  spells?: SimHandler;
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
    if (subcommand === "catalog" && options.action === "help") {
      io.out(SIM_HELP);
      return 0;
    }
    const handler =
      subcommand === "run"
        ? deps.run
        : subcommand === "suggest"
          ? deps.suggest
          : subcommand === "catalog"
            ? deps.catalog
            : subcommand === "plan"
              ? deps.plan
              : subcommand === "roles"
                ? deps.roles
                : subcommand === "equivalents"
                  ? deps.equivalents
                  : subcommand === "build"
                    ? deps.build
                    : subcommand === "homebrew"
                      ? deps.homebrew
                      : subcommand === "templates"
                        ? deps.templates
                        : subcommand === "lineages"
                          ? deps.lineages
                          : subcommand === "calibrate"
                            ? deps.calibrate
                            : subcommand === "spells"
                              ? deps.spells
                              : undefined;
    if (!handler) {
      return usage(
        `Unknown subcommand "${subcommand}" (use run, suggest, plan, build, homebrew, templates, lineages, calibrate, spells, catalog, roles or equivalents).`
      );
    }
    validateForSubcommand(subcommand, options);
    const { doc } = await handler(deps.context(options.vault), options);
    // `plan` and the --brief forms are read by a model: laid out to spend fewer tokens.
    io.out(
      options.brief || subcommand === "plan" || subcommand === "build" || subcommand === "templates"
        ? briefJson(doc)
        : JSON.stringify(doc, null, 2)
    );
    return 0;
  } catch (err) {
    if (err instanceof UsageError) return usage(err.message);
    throw err;
  }
}
