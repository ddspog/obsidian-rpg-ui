/**
 * The summon sheet (`rpg stat.summon`): a statblock whose numbers are worked out
 * for whoever calls it. A bar under the type line sets the summoner (a
 * character, whose PB, level and modifiers fill the formulas), the parameters
 * (a spell's circle) and the form; each worked-out number shows its formula on
 * a tap. A thrall (`apply:`) is a creature of the bestiary with a template
 * applied (a Necromancer's skeleton or zombie), plus what its summoner adds.
 */

import * as React from "react";
import { evaluate, type FormulaVars } from "../domains/statblocks/formula";
import { mapMonster } from "../domains/statblocks/monster-fields";
import { templateFits } from "../domains/statblocks/monster-template";
import { resolveStatFeatures } from "../domains/statblocks/resolve-features";
import { crValue, fillSummon, ordinal, summonVars, type SummonBlock } from "../domains/statblocks/summon";
import { applyTemplateBlock, type TemplateBlock } from "../domains/statblocks/template-block";
import type { ResolvedStatFeature, StatFeatureRef } from "../domains/statblocks/types";
import {
  activePath,
  bestiaryOf,
  characterNumbers,
  charactersOf,
  loadCreature,
  loadTemplateBlock,
  type CharacterEntry,
  type LoadedCreature,
} from "../services/creature-notes";
import { StatblockMonster } from "./statblock-monster";

export interface StatblockSummonProps {
  block: SummonBlock;
  sourcePath?: string;
}

/** A tap on a worked-out number shows its formula (a phone has no hover). */
function toggleFormula(e: React.MouseEvent | React.KeyboardEvent) {
  const el = (e.target as HTMLElement).closest?.(".rpg-formula");
  if (!el) return;
  if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  el.classList.toggle("is-open");
}

export function StatblockSummon({ block, sourcePath = "" }: StatblockSummonProps) {
  const [characters, setCharacters] = React.useState<CharacterEntry[]>([]);
  const [summoner, setSummoner] = React.useState<string>("");
  const [numbers, setNumbers] = React.useState<FormulaVars>({});
  const [set, setSet] = React.useState<Record<string, number>>({});
  const [form, setForm] = React.useState<string | undefined>(block.forms[0]?.name);

  React.useEffect(() => {
    let cancelled = false;
    void charactersOf(sourcePath).then((list) => {
      if (cancelled) return;
      setCharacters(list);
      // Opened from a character's note: that character calls it.
      const here = activePath();
      if (here && list.some((c) => c.path === here)) setSummoner(here);
    });
    return () => {
      cancelled = true;
    };
  }, [sourcePath]);

  React.useEffect(() => {
    let cancelled = false;
    if (!summoner) {
      setNumbers({});
      return;
    }
    void characterNumbers(summoner).then((n) => {
      if (!cancelled) setNumbers(n);
    });
    return () => {
      cancelled = true;
    };
  }, [summoner]);

  const vars = React.useMemo(() => summonVars(block, set, numbers), [block, set, numbers]);

  const controls = (
    <div className="rpg-sheet-bar" role="group" aria-label="Summoned with">
      {characters.length ? (
        <label className="rpg-sheet-check">
          <span>By</span>
          <select value={summoner} onChange={(e) => setSummoner(e.target.value)} className="dropdown">
            <option value="">—</option>
            {characters.map((c) => (
              <option key={c.path} value={c.path}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {block.params.map((p) => {
        const v = vars[p.name];
        const range = p.min !== undefined && p.max !== undefined && p.max - p.min <= 6;
        const label = p.label ?? p.name;
        if (range) {
          const values = Array.from({ length: (p.max ?? 0) - (p.min ?? 0) + 1 }, (_, i) => (p.min ?? 0) + i);
          return (
            <span key={p.name} className="rpg-sheet-check">
              <span>{label}</span>
              <span className="rpg-sheet-seg">
                {values.map((n) => (
                  <button type="button" key={n} aria-pressed={v === n} onClick={() => setSet({ ...set, [p.name]: n })}>
                    {p.ordinal ? ordinal(n) : n}
                  </button>
                ))}
              </span>
            </span>
          );
        }
        const derived = p.from && set[p.name] === undefined && evaluate(p.from, numbers) !== undefined;
        return (
          <label key={p.name} className="rpg-sheet-check" title={p.from ? `from the summoner: ${p.from}` : undefined}>
            <span>{label}</span>
            <input
              type="number"
              className={derived ? "is-derived" : undefined}
              value={v ?? ""}
              min={p.min}
              max={p.max}
              style={{ width: "4.5em" }}
              onChange={(e) => setSet({ ...set, [p.name]: Number(e.target.value) })}
            />
          </label>
        );
      })}
      {block.forms.length ? (
        <span className="rpg-sheet-seg" role="group" aria-label="Form">
          {block.forms.map((f) => (
            <button type="button" key={f.name} aria-pressed={form === f.name} onClick={() => setForm(f.name)}>
              {f.name}
            </button>
          ))}
        </span>
      ) : null}
    </div>
  );

  return (
    <div className="rpg-statblock-summon" onClick={toggleFormula} onKeyDown={toggleFormula}>
      {block.apply ? (
        <Thrall block={block} sourcePath={sourcePath} vars={vars} controls={controls} />
      ) : (
        <Filled block={block} sourcePath={sourcePath} vars={vars} form={form} controls={controls} />
      )}
    </div>
  );
}

function Filled({
  block,
  sourcePath,
  vars,
  form,
  controls,
}: {
  block: SummonBlock;
  sourcePath: string;
  vars: FormulaVars;
  form?: string;
  controls: React.ReactNode;
}) {
  const filled = React.useMemo(() => fillSummon(block, vars, form), [block, vars, form]);
  const [features, setFeatures] = React.useState<ResolvedStatFeature[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    void resolveStatFeatures(filled.refs, sourcePath, { name: block.name.toLowerCase(), ...vars }).then((resolved) => {
      if (cancelled) return;
      // In the block's order: refs and written features as they come.
      const out: ResolvedStatFeature[] = [];
      let r = 0;
      let w = 0;
      const chosen = block.forms.find((f) => f.name === form);
      for (const f of [...block.features, ...(chosen?.features ?? [])]) {
        if (f.ref) out.push(resolved[r++]);
        else {
          const x = filled.features[w++];
          out.push({ name: x.name, type: x.type, text: x.text });
        }
      }
      setFeatures(out.filter(Boolean));
    });
    return () => {
      cancelled = true;
    };
  }, [filled, sourcePath, block, vars, form]);

  const data = mapMonster({ name: block.name, type: block.type, stats: filled.stats, abilities: block.abilities });
  return (
    <StatblockMonster
      name={block.name}
      type={block.type}
      kind="Summon"
      controls={controls}
      stats={data.stats}
      abilities={data.abilities}
      features={features}
      body={block.text}
      sourcePath={sourcePath}
      hideRole
    />
  );
}

/** A creature of the bestiary with one of the templates applied, and the summoner's bonuses. */
function Thrall({
  block,
  sourcePath,
  vars,
  controls,
}: {
  block: SummonBlock;
  sourcePath: string;
  vars: FormulaVars;
  controls: React.ReactNode;
}) {
  const apply = block.apply!;
  const creatures = React.useMemo(() => bestiaryOf(sourcePath), [sourcePath]);
  const [templateLink, setTemplateLink] = React.useState(apply.templates[0] ?? "");
  const [template, setTemplate] = React.useState<TemplateBlock | null>(null);
  const [query, setQuery] = React.useState("");
  const [base, setBase] = React.useState<LoadedCreature | null>(null);
  const [features, setFeatures] = React.useState<ResolvedStatFeature[]>([]);
  const listId = React.useId();
  const label = (l: string) =>
    l
      .replace(/^\[\[|\]\]$/g, "")
      .split("|")
      .pop()!
      .split("/")
      .pop()!;

  React.useEffect(() => {
    let cancelled = false;
    void loadTemplateBlock(templateLink, sourcePath).then((t) => {
      if (!cancelled) setTemplate(t);
    });
    return () => {
      cancelled = true;
    };
  }, [templateLink, sourcePath]);

  const result = React.useMemo(() => {
    if (!template || !base) return null;
    const r = applyTemplateBlock(base.data, template, {
      cr: crValue(base.data.cr),
      baseFeatures: base.features.map((f) => ({ name: f.name ?? "", text: f.text })),
    });
    const ac = apply.ac ? evaluate(apply.ac, vars) : undefined;
    const stats = { ...(r.data.stats as Record<string, unknown>) };
    if (ac) stats.ac = String(stats.ac ?? "").replace(/^\s*(\d+)/, (_, n: string) => String(Number(n) + ac));
    return { ...r, data: { ...r.data, stats } as Record<string, unknown> };
  }, [template, base, apply.ac, vars]);

  React.useEffect(() => {
    if (!result || !base) return;
    let cancelled = false;
    void resolveStatFeatures((result.data.features as StatFeatureRef[]) ?? [], base.path, {
      name: base.name.toLowerCase(),
      cr: result.data.cr,
      abilities: result.data.abilities,
      stats: result.data.stats,
    }).then((f) => {
      if (!cancelled) setFeatures(f);
    });
    return () => {
      cancelled = true;
    };
  }, [result, base]);

  const pick = async (name: string) => {
    setQuery(name);
    const entry = creatures.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (entry) setBase(await loadCreature(entry.path));
  };

  const fit =
    template && base
      ? templateFits(
          { ...template.applies, types: apply.types?.length ? apply.types : template.applies.types },
          {
            name: base.name,
            type: String(base.data.type ?? ""),
            cr: crValue(base.data.cr),
            int: Number((base.data.abilities as Record<string, unknown> | undefined)?.int ?? 0) || 0,
          }
        )
      : null;
  const damage = apply.damage ? evaluate(apply.damage, vars) : undefined;
  const temp = apply.tempHp ? evaluate(apply.tempHp, vars) : undefined;
  const bonuses: ResolvedStatFeature[] = [
    ...(damage
      ? [{ name: `${block.summoner ?? "Summoner"}'s Thrall`, text: `It adds ${damage} to its damage rolls.` }]
      : []),
    ...(temp ? [{ name: "Raised", text: `When it is made, it gains ${temp} temporary hit points.` }] : []),
  ];
  const data = result ? mapMonster({ ...result.data }) : null;

  const thrallControls = (
    <>
      {controls}
      <div className="rpg-sheet-bar" role="group" aria-label="Thrall">
        {apply.templates.length > 1 ? (
          <span className="rpg-sheet-seg">
            {apply.templates.map((t) => (
              <button type="button" key={t} aria-pressed={templateLink === t} onClick={() => setTemplateLink(t)}>
                {label(t)}
              </button>
            ))}
          </span>
        ) : null}
        <label className="rpg-sheet-pick">
          <span>Of</span>
          <input
            type="search"
            list={listId}
            value={query}
            placeholder={apply.types?.length ? `a ${apply.types.join(" or ")}` : "a creature"}
            onChange={(e) => void pick(e.target.value)}
          />
        </label>
        <datalist id={listId}>
          {creatures.map((c) => (
            <option key={c.path} value={c.name} />
          ))}
        </datalist>
        {fit && !fit.fits ? <span className="rpg-sheet-unfit">for {fit.unmet.join("; ")}</span> : null}
      </div>
    </>
  );

  return (
    <StatblockMonster
      name={data ? `${base?.name} ${label(templateLink).replace(/\s*\(.*\)$/, "")}` : block.name}
      type={data ? data.type : block.type}
      cr={data?.cr}
      kind="Summon"
      controls={thrallControls}
      stats={data ? data.stats : {}}
      abilities={data ? data.abilities : { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }}
      features={data ? [...features, ...bonuses] : []}
      body={data ? undefined : (block.text ?? "Pick the creature it raises.")}
      sourcePath={base?.path ?? sourcePath}
      hideRole
    />
  );
}

export default StatblockSummon;
