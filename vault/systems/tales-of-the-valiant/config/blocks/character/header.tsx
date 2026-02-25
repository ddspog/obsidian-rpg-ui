import * as React from "react";
import { EntityBlock, InspirationalLevel, Pill, ProgressBar, TitleAnchor, TriggerButton, getBannerStyle } from "rpg-ui-toolkit";
import { CharacterEntity } from "../../entities/character.types";
import { HeaderProps } from "./header.types";

export const header: EntityBlock<HeaderProps, CharacterEntity> = ({ self, lookup, expressions, trigger }) => {
  // Convert banner frontmatter into a style object via shared utility
  const style = getBannerStyle(self.banner);
  const cls = "rpg-entity-header" + (style && (style as any).backgroundColor ? " rpg-entity-header--solid" : "");
  return (
    <header
      aria-label="Sheet Header"
      className={cls}
      style={style}
    >
      <hgroup aria-label="Name & Summary" className="rpg-entity-header__identity">
        <TitleAnchor />
        <menu aria-label="Character Summary" className="rpg-entity-header__pills">
          {self.classes && self.classes.map((cls, i) => (
            <React.Fragment key={`class-${i}`}>
              <Pill link={cls.name}>
                {cls.name} {cls.level}
              </Pill>
              {cls.subclass && (
                <Pill link={cls.subclass}>
                  {cls.subclass}
                </Pill>
              )}
            </React.Fragment>
          ))}

          {/* lineage / heritage / background are single objects in this system */}
          {self.lineage && (
            <Pill link={self.lineage.file}>
              {self.lineage.text || self.lineage.file}
            </Pill>
          )}

          {self.heritage && (
            <Pill link={self.heritage.file}>
              {self.heritage.text || self.heritage.file}
            </Pill>
          )}

          {self.background && (
            <Pill link={self.background.file}>
              {self.background.text || self.background.file}
            </Pill>
          )}
        </menu>
      </hgroup>
      <fieldset aria-label="Leveling" className="rpg-entity-header__leveling">
        <menu aria-label="Quick Adjustments" className="rpg-entity-header__actions">
          <TriggerButton onClick={() => trigger('short-rest')} icon="🍴">Short Rest</TriggerButton>
          <TriggerButton onClick={() => trigger('long-rest')} icon="⛺">Long Rest</TriggerButton>
          <InspirationalLevel
            level={expressions.CharacterLevel()}
            inspiration={self.luck}
            maxPoints={5}
            onUpdateInspiration={(value: number) => self.setLuck(value)} />
        </menu>
        <ProgressBar value={self.xp} max={lookup.table.xp[expressions.CharacterLevel() - 1]} />
      </fieldset>
    </header>
  );

}

export default header;
