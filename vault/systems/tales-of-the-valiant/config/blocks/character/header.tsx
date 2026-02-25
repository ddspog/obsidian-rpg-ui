import { EntityBlock, InspirationalLevel, Pill, ProgressBar, TitleAnchor, TriggerButton } from "rpg-ui-toolkit";
import { CharacterEntity } from "../../entities/character.types";
import { HeaderProps } from "./header.types";

export const header: EntityBlock<HeaderProps, CharacterEntity> = ({ self, lookup, expressions, trigger }) => {
  // determine if the banner value is an image URL/data URL or a plain color string
  // be defensive: self.banner may be undefined when the block isn't present
  const rawBanner = self?.banner ?? "";
  const banner = typeof rawBanner === "string" ? rawBanner.trim() : String(rawBanner ?? "");
  const looksLikeImage = banner.length > 0 && (/^(data:|https?:)?\/\//i.test(banner) || /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(banner));
  const style = banner.length === 0 ? undefined : (looksLikeImage ? { backgroundImage: `url(${banner})` } : { backgroundColor: banner });

  const cls = "rpg-entity-header" + (banner.length > 0 && !looksLikeImage ? " rpg-entity-header--solid" : "");

  // Debug log to help troubleshoot runtime rendering when previewing in Obsidian
  // (temporary — can be removed once verified)
  // eslint-disable-next-line no-console
  console.debug("rpg.header banner ->", { rawBanner, banner, looksLikeImage, style, cls });

  return (
    <header
      aria-label="Sheet Header"
      className={cls}
      style={style}
    >
      <hgroup aria-label="Name & Summary" className="rpg-entity-header__identity">
        <TitleAnchor />
        <menu aria-label="Character Summary" className="rpg-entity-header__pills">
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
