import { EntityBlock, Pill } from "rpg-ui-toolkit";
import { ProficienciesProps } from "./proficiencies.types";
import { CharacterEntity } from "../../entities/character.types";

export const proficiencies: EntityBlock<ProficienciesProps, CharacterEntity> = ({ self, blocks, lookup, system }) => {
  const fromBlocks = (blocks as any).proficiencies;
  if (fromBlocks) {
    return (
      <article aria-label="Proficiencies">
        <dl className="rpg-proficiencies-dl">
          {fromBlocks.weapons?.length > 0 && (
            <>
              <dt>WEAPONS:</dt>
              <dd>
                <ul className="rpg-proficiencies-list--inline">{fromBlocks.weapons.map((w: string, i: number) => <li key={i}><Pill link={w}>{w}</Pill></li>)}</ul>
              </dd>
            </>
          )}
          {fromBlocks.armor?.length > 0 && (
            <>
              <dt>ARMOR:</dt>
              <dd>
                <ul className="rpg-proficiencies-list--inline">{fromBlocks.armor.map((a: string, i: number) => <li key={i}><Pill link={a}>{a}</Pill></li>)}</ul>
              </dd>
            </>
          )}
          {fromBlocks.tools?.length > 0 && (
            <>
              <dt>TOOLS:</dt>
              <dd>
                <ul className="rpg-proficiencies-list--inline">{fromBlocks.tools.map((t: string, i: number) => <li key={i}><Pill link={t}>{t}</Pill></li>)}</ul>
              </dd>
            </>
          )}
          {fromBlocks.languages?.length > 0 && (
            <>
              <dt>LANGUAGES:</dt>
              <dd>
                <ul className="rpg-proficiencies-list--inline">{fromBlocks.languages.map((l: string, i: number) => <li key={i}>{l}</li>)}</ul>
              </dd>
            </>
          )}
        </dl>
      </article>
    );
  }

  const list = Array.isArray((self as any).proficiencies) ? (self as any).proficiencies : [];
  return (
    <article aria-label="Proficiencies">
      <ul className="rpg-proficiencies-list">
        {list.map((p: any, i: number) => (
          <li key={i} className="rpg-proficiency-item">
            {typeof p === "string" ? <Pill link={p}>{p}</Pill> : <Pill link={p.file ?? p.name ?? String(p)}>{p.name ?? p.label ?? String(p)}</Pill>}
          </li>
        ))}
      </ul>
    </article>
  );
};

export default proficiencies;
