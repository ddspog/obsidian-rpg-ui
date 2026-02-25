import { CreateEntity, FeatureEntry, TitleAnchor, Pill, ProgressBar, TriggerButton, InspirationalLevel, Stat, StatUL, SkillLI } from "rpg-ui-toolkit";
import { xpTable as xp } from './character.lookup';
import type { AttributeDetails, CharacterBlocks, CharacterExpressions, CharacterLookup } from "./character.types";

const character = CreateEntity<CharacterBlocks, CharacterLookup, CharacterExpressions>(async ({ wiki }) => ({
    lookup: { table: { xp } },
    blocks: {
        header: ({ self, lookup, expressions, trigger }) => (
            <header aria-label="Sheet Header">
                <hgroup aria-label="Name & Summary">
                    <TitleAnchor/>
                    <menu aria-label="Character Summary">
                        {self.classes && self.classes.map(cls => <>
                            <Pill link={cls.name}>
                                {cls.name} {cls.level}
                            </Pill>
                            {cls.subclass && <Pill link={cls.subclass}>
                                {cls.subclass}
                            </Pill>}
                        </>)}
                        {self.lineage && <Pill link={self.lineage.file}>{self.lineage.text || self.lineage.file}</Pill>}
                        {self.heritage && <Pill link={self.heritage.file}>{self.heritage.text || self.heritage.file}</Pill>}
                        {self.background && <Pill link={self.background.file}>{self.background.text || self.background.file}</Pill>}
                    </menu>
                </hgroup>
                <fieldset aria-label="Leveling">
                    <menu aria-label="Quick Adjustments">
                      <TriggerButton onClick={() => trigger('short-rest')} icon="🍴">Short Rest</TriggerButton>
                      <TriggerButton onClick={() => trigger('long-rest')} icon="⛺">Long Rest</TriggerButton>
                      <InspirationalLevel
                        level={expressions.CharacterLevel()}
                        inspiration={self.luck}
                        maxPoints={5}
                        onUpdateInspiration={(value: number) => self.setLuck(value)}/>
                    </menu>
                    <ProgressBar value={self.xp} max={lookup.table.xp[expressions.CharacterLevel() - 1]} />
                </fieldset>
            </header>
        ),
        health: ({ self, blocks, lookup, trigger }) => {
          const current = (self as any).hp?.current ?? (self as any).current_hp ?? (self as any).hp_current ?? 0;
          const max = (self as any).hp?.max ?? (self as any).max_hp ?? (self as any).hp_max ?? 0;
          const temp = (self as any).hp?.temp ?? (self as any).temp_hp ?? 0;
          const setHpFn = (self as any).setHp || (self as any).setCurrent_hp || (self as any).setCurrentHp;
          return (
            <article aria-label="Health">
              <div className="rpg-health-row">
                <div className="rpg-health-values">
                  <div className="rpg-health-values__hp">HP: {current} / {max}</div>
                  <div className="rpg-health-values__temp">Temp: {temp}</div>
                </div>
                <div className="rpg-health-controls">
                  {typeof setHpFn === "function" ? (
                    <>
                      <button type="button" onClick={() => setHpFn((p: any) => ({ ...(p || {}), current: Math.max((p?.current || 0) - 1, 0) }))}>Take 1</button>
                      <button type="button" onClick={() => setHpFn((p: any) => ({ ...(p || {}), current: (p?.current || 0) + 1 }))}>Heal 1</button>
                    </>
                  ) : (
                    <>
                      <TriggerButton onClick={() => trigger("damage-1")} icon="➖">-1</TriggerButton>
                      <TriggerButton onClick={() => trigger("heal-1")} icon="➕">+1</TriggerButton>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        },
        stats: ({ self }) => (
          <article aria-label="Character Stats">
            <Stat value={self.STR.value} save={self.STR.save}>STR</Stat>
            <Stat value={self.DEX.value} save={self.DEX.save}>DEX</Stat>
            <Stat value={self.CON.value} save={self.CON.save}>CON</Stat>
            <Stat value={self.INT.value} save={self.INT.save}>INT</Stat>
            <Stat value={self.WIS.value} save={self.WIS.save}>WIS</Stat>
            <Stat value={self.CHA.value} save={self.CHA.save}>CHA</Stat>
          </article>
        ),
        senses: ({ self, blocks, expressions }) => (
          <article aria-label="Character Senses">
            <Stat value={expressions.Passive({
              attribute: 'WIS',
              proficiency: blocks.skills.Insight.proficiency,
              vantage: blocks.skills.Insight.vantage,
              bonus: blocks.skills.Insight.bonus
            })}>P. Insight</Stat>
            <Stat value={expressions.Passive({
              attribute: 'INT',
              proficiency: blocks.skills.Investigation.proficiency,
              vantage: blocks.skills.Investigation.vantage,
              bonus: blocks.skills.Investigation.bonus
            })}>P. Investigation</Stat>
            <Stat value={expressions.Passive({
              attribute: 'WIS',
              proficiency: blocks.skills.Perception.proficiency,
              vantage: blocks.skills.Perception.vantage,
              bonus: blocks.skills.Perception.bonus
            })}>P. Perception</Stat>
            <StatUL title='Senses'>
              {self.senses_list.map((sense, i) => <li key={i}>{sense.type}{sense.range && ` ${sense.range}`}</li>)}
            </StatUL>
          </article>
        ),
        skills: ({ self, blocks, lookup, system }) => (
          <article aria-label="Character Skills">
            <ul aria-label='Skill List'>
              <SkillLI value={self.Acrobatics}>Acrobatics</SkillLI>
              <SkillLI value={self['Animal Handling']}>Animal Handling</SkillLI>
              <SkillLI value={self.Arcana}>Arcana</SkillLI>
              <SkillLI value={self.Athletics}>Athletics</SkillLI>
              <SkillLI value={self.Deception}>Deception</SkillLI>
              <SkillLI value={self.History}>History</SkillLI>
              <SkillLI value={self.Insight}>Insight</SkillLI>
              <SkillLI value={self.Intimidation}>Intimidation</SkillLI>
              <SkillLI value={self.Investigation}>Investigation</SkillLI>
              <SkillLI value={self.Medicine}>Medicine</SkillLI>
              <SkillLI value={self.Nature}>Nature</SkillLI>
              <SkillLI value={self.Perception}>Perception</SkillLI>
              <SkillLI value={self.Performance}>Performance</SkillLI>
              <SkillLI value={self.Persuasion}>Persuasion</SkillLI>
              <SkillLI value={self.Religion}>Religion</SkillLI>
              <SkillLI value={self['Sleight of Hand']}>Sleight of Hand</SkillLI>
              <SkillLI value={self.Stealth}>Stealth</SkillLI>
            </ul>
          </article>
        ),
        attacks: ({ self, blocks, lookup, trigger }) => (
          <article aria-label="Favorite Attacks">
            <table className="rpg-attacks-table">
              <tbody>
                {(Array.isArray(self.attacks) ? self.attacks : []).map((atk: any, i: number) => (
                  <tr key={i} className="rpg-attack-row">
                    <th className="rpg-attack-name" scope="row">{atk.name || atk.label || `Attack ${i + 1}`}</th>
                    <td className="rpg-attack-meta">
                      {atk.toHit !== undefined && <span className="rpg-attack-item__tohit">{atk.toHit >= 0 ? `+${atk.toHit}` : atk.toHit}</span>}
                      {atk.range && <span className="rpg-attack-item__range">{atk.range}</span>}
                      {atk.damage && <span className="rpg-attack-item__damage">{atk.damage}</span>}
                    </td>
                    <td className="rpg-attack-actions">
                      <TriggerButton onClick={() => trigger(`attack:${i}`)} icon="🎲">Roll</TriggerButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ),
        proficiencies: ({ self, blocks, lookup, system }) => {
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
        },
        features: ({ self, blocks, lookup, system }) => null,
        spells: ({ self, blocks, lookup, system }) => null,
        inventory: ({ self, blocks, lookup, system }) => null,
        description: ({ self, blocks, lookup, system }) => null,
    },
    features: [
        { $name: "Dash", type: "action", $contents: "Double your speed for the current turn." },
        {
            $name: "Disengage",
            type: "action",
            $contents: "Your movement doesn't provoke opportunity attacks for the rest of the turn.",
        },
        {
            $name: "Dodge",
            type: "action",
            $contents: "Attack rolls against you have disadvantage until your next turn.",
        },
        {
            $name: "Help",
            type: "action",
            $contents: "Give an ally advantage on their next ability check or attack roll.",
        },
        { $name: "Hide", type: "action", $contents: "Make a Dexterity (Stealth) check to hide." },
        {
            $name: "Ready",
            type: "action",
            $contents: "Prepare an action to trigger in response to a specified circumstance.",
        },
        {
            $name: "Search",
            type: "action",
            $contents: "Make a Wisdom (Perception) or Intelligence (Investigation) check to find something.",
        },
        {
            $name: "Use an Object",
            type: "action",
            $contents: "Interact with an object or the environment.",
        },
        {
            $name: "Opportunity Attack",
            type: "reaction",
            $contents: "Make a melee attack against a creature that leaves your reach.",
        },
        ...(await wiki.folder("compendium/entities/character/features") as unknown as FeatureEntry[])
    ],
    expressions: {
        CharacterLevel: (_, { blocks }) => {
            const { header } = blocks;
            return header.classes
                .map(c => c.level)
                .reduce((a, b) => a + b, 0);
        },
        ProficiencyBonus: (_, { expressions }) => {
            const level = expressions.CharacterLevel();
            return Math.floor((level - 1) / 4) + 2;
        },
        ModifierTotal: ([{ attribute, proficiency, bonus }], { blocks, expressions }) => {
          if (!(attribute in blocks.stats)) return 0;
          const attrValue = blocks.stats[attribute].value;
          const attrMod = Math.floor((attrValue - 10) / 2);
          const pb = expressions.ProficiencyBonus() * proficiency;
          return attrMod + pb + bonus;
        },
        Passive: ([{ attribute, proficiency, bonus, vantage }], { expressions }) => {
          return 10 + expressions.ModifierTotal({ attribute, proficiency, bonus }) + 5 * vantage;
        }
    },
}));

export default character;
