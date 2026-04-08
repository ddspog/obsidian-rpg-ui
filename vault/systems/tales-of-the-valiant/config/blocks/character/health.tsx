import * as React from "react";
import { EntityBlock, Section, Article, HGroup, Figure, Line, Fieldset, Badge, Stat, DeathSaveDots, Progress, DiceTray, PortraitThumb, Panel, ConditionPill } from "rpg-ui-toolkit";
import { HealthProps } from "./health.types";
import { CharacterEntity } from "../../entities/character.types";

/** Extract display label and linkpath from any frontmatter condition value */
function parseCondition(raw: unknown): { label: string; linkpath: string | null } {
  if (Array.isArray(raw)) raw = raw[0];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    raw = obj.link ?? obj.path ?? obj.file ?? obj.src ?? "";
  }
  let val = typeof raw === "string" ? raw : String(raw ?? "");
  const aliasMatch = val.match(/^\[\[(.+?)\|(.+)\]\]$/);
  if (aliasMatch) return { linkpath: aliasMatch[1].trim(), label: aliasMatch[2].trim() };
  const wikiMatch = val.match(/^\[\[(.+)\]\]$/);
  if (wikiMatch) val = wikiMatch[1].trim();
  const segment = val.split(/[/\\]/).pop() ?? val;
  return { label: segment.replace(/\.[^.]+$/, "").trim(), linkpath: val || null };
}

export const health: EntityBlock<HealthProps, CharacterEntity> = ({ self, expressions }) => {
  const deathSaves = self.death_saves ?? { successes: 0, failures: 0 };
  const hitDice = self.hit_dice ?? {};
  const conditions = (self.conditions ?? []) as unknown[];
  const exhaustion = self.exhaustion ?? 0;
  const speeds = Array.isArray(self.speed) ? self.speed : self.speed ? [self.speed] : [{ value: 30, type: "Walk" }];

  const handleSpendDie = (dieType: string) => {
    const current = hitDice[dieType]?.current ?? 0;
    if (current <= 0) return;
    self.setHit_dice({ ...hitDice, [dieType]: { ...hitDice[dieType], current: current - 1 } });
  };

  return (
    <Section.Row label="Health Management" distribution="1 2">
      <PortraitThumb src={self.portrait} />
      <Article.Column label="Content">
        <Figure.Column label="Defense Stats">
          <Line.Control>
            <DeathSaveDots
              side="failures"
              count={3}
              filled={deathSaves.failures}
              onChange={(v) => self.setDeath_saves({ ...deathSaves, failures: v })}
            />
            <Badge.Shield value={self.natural_ac ?? 10} label="Armor" />
            <Badge.Shield value={(self.natural_ac ?? 10) + 2} label="Shield" />
            <DeathSaveDots
              side="successes"
              count={3}
              filled={deathSaves.successes}
              onChange={(v) => self.setDeath_saves({ ...deathSaves, successes: v })}
            />
          </Line.Control>
          <Line.Stats>
            <Stat.Diamond label="Initiative" value={self.initiative?.bonus ?? 0} format="bonus" />
            {speeds.map((s, i) => (
              <Stat.Diamond key={i} label={s.type ?? "Walk"} value={s.value ?? 30} format="unit" size="lg" />
            ))}
            <Stat.Diamond label="Proficiency" value={expressions.ProficiencyBonus()} format="bonus" />
          </Line.Stats>
        </Figure.Column>

        <HGroup.Row label="Health Management" style={{ alignItems: "stretch" }}>
          <Fieldset.Health label="Controller" style={{ flex: 3 }}>
            <div aria-details="HP Row">
              <Progress.Health label="HIT POINTS" value={self.current_hp ?? 0} max={self.max_hp ?? 0} secondary={self.temp_hp ?? 0} />
            </div>
            <DiceTray dice={hitDice} onSpend={handleSpendDie} />
          </Fieldset.Health>

          <Panel.Status label="Character" style={{ flex: 2 }}>
            <h6>Exhaustion</h6>
            <Progress.Numbered value={exhaustion} max={6} />
            <h6>Conditions</h6>
            <Line.Pills>
              {conditions.length === 0 ? (
                <span aria-details="No Conditions">—</span>
              ) : (
                conditions.map((raw, i) => {
                  const { label, linkpath } = parseCondition(raw);
                  return <ConditionPill key={i} value={raw} label={label} linkpath={linkpath} />;
                })
              )}
            </Line.Pills>
          </Panel.Status>
        </HGroup.Row>
      </Article.Column>
    </Section.Row>
  );
};

export default health;

