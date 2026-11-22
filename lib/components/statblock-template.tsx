/**
 * The template sheet (`rpg stat.template`): a creature template shown as a
 * statblock of changes (what it applies to, each change, the features it adds,
 * what it takes away), and **Try on**: the template applied to any creature of
 * the bestiary, the values it changed marked and the old ones struck, with
 * "Save as homebrew" to keep the result as a draft note.
 */

import * as React from "react";
import { templateFits } from "../domains/statblocks/monster-template";
import { homebrewNoteText, homebrewPath } from "../domains/statblocks/homebrew-note";
import { resolveStatFeatures } from "../domains/statblocks/resolve-features";
import {
  applyTemplateBlock,
  choosesHumanoid,
  describeChange,
  type ApplyTemplateResult,
  type TemplateBlock,
  type TemplateChange,
} from "../domains/statblocks/template-block";
import type { ResolvedStatFeature, StatFeatureRef } from "../domains/statblocks/types";
import { mapMonster } from "../domains/statblocks/monster-fields";
import {
  bestiaryOf,
  createNote,
  lineagesOf,
  loadTemplateBlock,
  loadCreature,
  openNote,
  systemRootOf,
  type LoadedCreature,
} from "../services/creature-notes";
import { FeatureSections, groupFeatures } from "./statblock-shared";
import { StatblockMonster } from "./statblock-monster";

export interface StatblockTemplateProps {
  block: TemplateBlock;
  /** The note the block lives in. */
  sourcePath?: string;
}

/** What the template calls the creature: "Skeleton (Dragon)" → "dragon skeleton". */
export function templateNoun(name: string): string {
  const m = name.match(/^(.+?)\s*\((.+)\)$/);
  return (m ? `${m[2]} ${m[1]}` : name).toLowerCase();
}

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

export function StatblockTemplate({ block, sourcePath = "" }: StatblockTemplateProps) {
  const [view, setView] = React.useState<"changes" | "try">("changes");
  const [choice, setChoice] = React.useState<string | undefined>(block.choose?.[0]?.key);
  const [picks, setPicks] = React.useState<string[]>([]);
  const noun = templateNoun(block.name);

  // The features the template gives, as the features note words them (formulas as the book's brackets).
  const [features, setFeatures] = React.useState<ResolvedStatFeature[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    const refs: StatFeatureRef[] = block.features.map((f) => ({ ref: `@[[${block.featureNote}]]#${f.id}` }));
    void resolveStatFeatures(refs, sourcePath, { name: noun }).then((r) => {
      if (!cancelled) setFeatures(r);
    });
    return () => {
      cancelled = true;
    };
  }, [block, sourcePath, noun]);

  const changes = block.changes.filter((c) => c.stat !== "abilities" && c.stat !== "note");
  const abilities = block.changes.find((c) => c.stat === "abilities");
  const notes = block.changes.filter((c) => c.stat === "note");
  const appliesTo = block.applies.anyLineage
    ? "Humanoid (Any Lineage) NPCs"
    : [
        block.applies.types.length
          ? block.applies.types.map((t) => t[0].toUpperCase() + t.slice(1)).join(" · ")
          : "Any creature",
        ...block.applies.other,
      ].join(", ");

  return (
    <article className="rpg-statblock rpg-statblock-monster rpg-statblock-template">
      <header className="rpg-statblock-header">
        <h3>{block.name}</h3>
        <span className="rpg-statblock-header-meta">
          <span className="rpg-statblock-kind">{block.kind === "lineage" ? "Lineage" : "Template"}</span>
        </span>
      </header>
      <p className="rpg-statblock-subtitle">
        <em>{appliesTo}</em>
      </p>

      <div className="rpg-sheet-bar" role="group" aria-label="Template sheet">
        <span className="rpg-sheet-seg">
          <button type="button" aria-pressed={view === "changes"} onClick={() => setView("changes")}>
            Changes
          </button>
          <button type="button" aria-pressed={view === "try"} onClick={() => setView("try")}>
            Try on
          </button>
        </span>
        {block.choose?.length ? (
          <span className="rpg-sheet-seg" role="group" aria-label="Choose">
            {block.choose.map((c) => (
              <button
                type="button"
                key={c.key}
                className="is-option"
                aria-pressed={choice === c.key}
                title={c.damage.join(" or ")}
                onClick={() => setChoice(c.key)}
              >
                {c.key}
              </button>
            ))}
          </span>
        ) : null}
      </div>

      {view === "changes" ? (
        <>
          <dl className="rpg-statblock-stats">
            {[
              ...changes,
              // A Resilience trait is named on the defence line it grants.
              ...block.features
                .filter((f) => f.defence)
                .map((f): TemplateChange => ({ stat: f.defence!, conditions: [f.name] })),
            ].map((c, i) => {
              const w = describeChange(c);
              return (
                <div key={i}>
                  <dt>{w.label}</dt>
                  <dd className={`rpg-sheet-change is-${w.tone}`}>
                    {w.text}
                    {w.note ? <span className="rpg-sheet-note"> {w.note}</span> : null}
                  </dd>
                </div>
              );
            })}
          </dl>
          {abilities ? (
            <table className="rpg-statblock-abilities">
              <thead>
                <tr>
                  {ABILITY_KEYS.map((k) => (
                    <th key={k}>{k.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {ABILITY_KEYS.map((k) => {
                    const map =
                      abilities.stat === "abilities"
                        ? (abilities.plus ?? abilities.atLeast ?? abilities.atMost ?? {})
                        : {};
                    const v = map[k];
                    const op =
                      abilities.stat === "abilities" && abilities.plus
                        ? ""
                        : abilities.stat === "abilities" && abilities.atLeast
                          ? "≥"
                          : "≤";
                    return (
                      <td key={k} className={v === undefined ? "rpg-sheet-same" : "rpg-sheet-change"}>
                        {v === undefined ? "—" : `${op}${op ? " " : ""}${v >= 0 ? `+${v}` : `−${-v}`}`}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          ) : null}
          <TemplateFeatures block={block} features={features} />
          <ByHand
            items={[
              ...(block.loses ? [{ label: "Loses", text: block.loses }] : []),
              ...notes.map((n) => describeChange(n)).map((w) => ({ label: w.label, text: w.text })),
              ...(block.alters ?? []).map((a) => ({
                label: a.name,
                text: a.text.replace(/\{\{ self\.name\(\) \}\}/g, noun),
              })),
              ...(block.rules ?? []).map((r) => ({ label: "Rule", text: r })),
            ]}
          />
        </>
      ) : (
        <TryOn block={block} sourcePath={sourcePath} choice={choice} picks={picks} setPicks={setPicks} />
      )}
    </article>
  );
}

/** The features it gives, by kind; a list to choose from and a choice's own marked. */
function TemplateFeatures({ block, features }: { block: TemplateBlock; features: ResolvedStatFeature[] }) {
  const byId = new Map(block.features.map((f, i) => [f.id, features[i]]));
  const given = block.features.filter((f) => !f.optional);
  const optional = block.features.filter((f) => f.optional);
  const shown = (list: typeof block.features) =>
    list.map((f) => {
      const r = byId.get(f.id);
      const name = `${r?.name ?? f.name}${f.choice ? ` (${f.choice})` : ""}`;
      return { ...(r ?? { text: "" }), name, type: f.type === "trait" ? undefined : f.type };
    });
  const { traits, sections } = groupFeatures(shown(given));
  return (
    <>
      <FeatureSections traits={traits} sections={sections} />
      {optional.length ? (
        <section className="rpg-statblock-section">
          <h4>Choose from</h4>
          <FeatureSections traits={shown(optional).map((f) => ({ ...f, type: undefined }))} sections={{}} />
        </section>
      ) : null}
    </>
  );
}

function ByHand({ items }: { items: Array<{ label: string; text: string }> }) {
  if (!items.length) return null;
  return (
    <details className="rpg-sheet-byhand">
      <summary>{items.length === 1 ? "1 thing to do by hand" : `${items.length} things to do by hand`}</summary>
      <ul>
        {items.map((it, i) => (
          <li key={i}>
            <strong>{it.label}.</strong> {it.text}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The template on a creature of the bestiary. */
function TryOn({
  block,
  sourcePath,
  choice,
  picks,
  setPicks,
}: {
  block: TemplateBlock;
  sourcePath: string;
  choice?: string;
  picks: string[];
  setPicks: (p: string[]) => void;
}) {
  const creatures = React.useMemo(() => bestiaryOf(sourcePath), [sourcePath]);
  // "Choose a Humanoid" (the Lycanthrope): a lineage to choose.
  const humanoid = choosesHumanoid(block);
  const lineages = React.useMemo(() => (humanoid ? lineagesOf(sourcePath) : []), [humanoid, sourcePath]);
  const [lineagePath, setLineagePath] = React.useState("");
  const [lineage, setLineage] = React.useState<TemplateBlock | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    if (!lineagePath) {
      setLineage(null);
      return;
    }
    void loadTemplateBlock(lineagePath, sourcePath).then((b) => {
      if (!cancelled) setLineage(b);
    });
    return () => {
      cancelled = true;
    };
  }, [lineagePath, sourcePath]);
  const [query, setQuery] = React.useState("");
  const [base, setBase] = React.useState<LoadedCreature | null>(null);
  const [result, setResult] = React.useState<ApplyTemplateResult | null>(null);
  const [resolved, setResolved] = React.useState<ResolvedStatFeature[]>([]);
  const [saveName, setSaveName] = React.useState("");
  const [saved, setSaved] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const listId = React.useId();

  const pickBase = async (name: string) => {
    setQuery(name);
    const entry = creatures.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!entry) return;
    setError(null);
    setSaved(null);
    const loaded = await loadCreature(entry.path);
    if (!loaded) {
      setError(`${entry.name} has no stat.monster block.`);
      return;
    }
    setBase(loaded);
    // A lineage goes before the NPC ("Dwarf Guard"), a template after the creature ("Owlbear Zombie").
    const label = block.name.replace(/\s*\(.*\)$/, "").replace(/\s*ᴷ$/, "");
    setSaveName(block.kind === "lineage" ? `${label} ${loaded.name}` : `${loaded.name} ${label}`);
  };

  React.useEffect(() => {
    if (!base) return;
    const cr = crOf(base.data.cr);
    const r = applyTemplateBlock(base.data, block, {
      choice,
      picks,
      lineage: lineage ?? undefined,
      baseName: base.name,
      baseFeatures: base.features.map((f) => ({ name: f.name ?? "", text: f.text })),
      cr,
    });
    setResult(r);
    let cancelled = false;
    const refs = (r.data.features as StatFeatureRef[]) ?? [];
    const baseCount = Array.isArray(base.data.features) ? base.data.features.length : 0;
    void resolveStatFeatures(refs, base.path, {
      name: String(r.data.name ?? base.name).toLowerCase(),
      cr: r.data.cr,
      abilities: r.data.abilities,
      stats: r.data.stats,
    }).then((list) => {
      if (!cancelled) setResolved(list.map((f, i) => (i >= baseCount ? { ...f, added: true } : f)));
    });
    return () => {
      cancelled = true;
    };
  }, [base, block, choice, picks, lineage]);

  const fit = base
    ? templateFits(block.applies, {
        name: base.name,
        type: String(base.data.type ?? ""),
        cr: crOf(base.data.cr),
        int: Number((base.data.abilities as Record<string, unknown> | undefined)?.int ?? 0) || 0,
      })
    : null;

  const save = async () => {
    if (!base || !result || !saveName.trim()) return;
    try {
      const path = homebrewPath(systemRootOf(base.path), saveName);
      const text = homebrewNoteText({
        name: saveName.trim(),
        basePath: base.path,
        baseName: base.name,
        templates: [block.name],
        data: { ...result.data, name: saveName.trim() },
        rest: base.rest,
      });
      setSaved(await createNote(path, text));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const data = result ? mapMonster({ ...result.data }) : null;
  const was: Record<string, unknown> = base
    ? {
        ...((base.data.stats as Record<string, unknown>) ?? {}),
        ...Object.fromEntries(
          Object.entries((base.data.abilities as Record<string, unknown>) ?? {}).map(([k, v]) => [`abilities.${k}`, v])
        ),
      }
    : {};
  const optional = block.features.filter((f) => f.optional);

  return (
    <div className="rpg-sheet-tryon">
      <div className="rpg-sheet-bar">
        <label className="rpg-sheet-pick">
          <span>On</span>
          <input
            type="search"
            list={listId}
            value={query}
            placeholder="a creature of the bestiary"
            onChange={(e) => void pickBase(e.target.value)}
          />
        </label>
        <datalist id={listId}>
          {creatures.map((c) => (
            <option key={c.path} value={c.name} />
          ))}
        </datalist>
        {fit ? (
          <span className={fit.fits ? "rpg-sheet-fit" : "rpg-sheet-unfit"}>
            {fit.fits ? "fits" : `for ${fit.unmet.join("; ")}`}
            {fit.unchecked.length ? ` · check: ${fit.unchecked.join(", ")}` : ""}
          </span>
        ) : null}
      </div>
      {humanoid ? (
        <div className="rpg-sheet-bar">
          <label className="rpg-sheet-check">
            <span>Humanoid</span>
            <select className="dropdown" value={lineagePath} onChange={(e) => setLineagePath(e.target.value)}>
              <option value="">—</option>
              {lineages.map((l) => (
                <option key={l.path} value={l.path.replace(/\.md$/, "")}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {optional.length ? (
        <div className="rpg-sheet-bar" role="group" aria-label="Features to choose">
          {optional.map((f) => (
            <label key={f.id} className="rpg-sheet-check">
              <input
                type="checkbox"
                checked={picks.includes(f.name)}
                onChange={(e) => setPicks(e.target.checked ? [...picks, f.name] : picks.filter((p) => p !== f.name))}
              />
              {f.name}
            </label>
          ))}
        </div>
      ) : null}
      {error ? <p className="rpg-sheet-error">{error}</p> : null}
      {!base ? <p className="rpg-sheet-hint">Pick a creature to see the template on it.</p> : null}
      {base && result && data ? (
        <>
          <StatblockMonster
            name={saveName || data.name}
            type={data.type}
            cr={data.cr}
            stats={data.stats}
            abilities={data.abilities}
            unknownAbilities={data.unknownAbilities}
            features={resolved}
            sourcePath={base.path}
            role={data.role}
            subrole={data.subrole}
            marks={{ changed: result.changed, was }}
          />
          <ByHand items={result.manual.map((m) => ({ label: "", text: m }))} />
          <div className="rpg-sheet-bar">
            <label className="rpg-sheet-pick">
              <span>Name</span>
              <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
            </label>
            <button type="button" className="mod-cta" onClick={() => void save()} disabled={!saveName.trim()}>
              {block.kind === "lineage" ? "Save as NPC" : "Save as homebrew"}
            </button>
            {saved ? (
              <a className="rpg-sheet-saved" onClick={() => openNote(saved)}>
                Saved: {saved.split("/").pop()?.replace(/\.md$/, "")}
              </a>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function crOf(v: unknown): number {
  const s = String(v ?? "0").trim();
  const f = s.match(/^(\d+)\/(\d+)$/);
  if (f) return Number(f[1]) / Number(f[2]);
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export default StatblockTemplate;
