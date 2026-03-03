import * as React from "react";
import { EntityBlock, Level, Pill, Progress, Title, Button, Header, Line, Lucide } from "rpg-ui-toolkit";
import { CharacterEntity } from "../../entities/character.types";
import { HeaderProps } from "./header.types";

export const header: EntityBlock<HeaderProps, CharacterEntity> = ({ self, lookup, expressions, trigger }) => (
  <Header.Banner background={self.banner} distribution="2 1">
    <hgroup aria-details="Name & Summary">
      <Title />
      <Line.Pills>
        {self.classes && self.classes.map((cls, i) => (
          <React.Fragment key={`class-${i}`}>
            <Pill.Link link={cls.name}>
              {cls.name} {cls.level}
            </Pill.Link>
            {cls.subclass && (
              <Pill.Link link={cls.subclass}>
                {cls.subclass}
              </Pill.Link>
            )}
          </React.Fragment>
        ))}

        {/* lineage / heritage / background are single objects in this system */}
        {self.lineage && (
          <Pill.Link link={self.lineage.file}>
            {self.lineage.text || self.lineage.file}
          </Pill.Link>
        )}

        {self.heritage && (
          <Pill.Link link={self.heritage.file}>
            {self.heritage.text || self.heritage.file}
          </Pill.Link>
        )}

        {self.background && (
          <Pill.Link link={self.background.file}>
            {self.background.text || self.background.file}
          </Pill.Link>
        )}
      </Line.Pills>
    </hgroup>
    <fieldset aria-details="Leveling">
      <Line.BigElements>
        <Line.Buttons>
          <Button.Trigger onClick={() => trigger('short-rest')} aria-label="Short Rest"><Lucide.UtensilsCrossed size={28} strokeWidth={1}/></Button.Trigger>
          <Button.Trigger onClick={() => trigger('long-rest')} aria-label="Long Rest"><Lucide.FlameKindling size={28} strokeWidth={1}/></Button.Trigger>
        </Line.Buttons>
        <Level.Inspirational
          level={expressions.CharacterLevel()}
          inspiration={self.luck}
          maxPoints={5}
          onUpdateInspiration={(value: number) => self.setLuck(value)} />
      </Line.BigElements>
      <Progress.Bar value={self.xp} max={lookup.table.xp[expressions.CharacterLevel() - 1]} />
    </fieldset>
  </Header.Banner>
);

export default header;
