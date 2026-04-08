/**
 * StatblockTraitsBlock placeholder component
 *
 * Displays special traits of a creature (passive abilities, senses, languages).
 * Placeholder for the `rpg statblock.traits` block in statblock notes.
 */

interface TraitItem {
  name?: string;
  $name?: string;
  description?: string;
  $contents?: string;
}

export function StatblockTraitsBlock(props: Record<string, unknown>) {
  const traits = (props.traits ?? []) as TraitItem[];
  const senses = props.senses as string | string[] | undefined;
  const languages = props.languages as string | string[] | undefined;

  const sensesStr = Array.isArray(senses) ? senses.join(", ") : senses;
  const languagesStr = Array.isArray(languages) ? languages.join(", ") : languages;

  return (
    <div className="rpg-ui-block rpg-ui-statblock-traits-block">
      {sensesStr && (
        <div className="rpg-ui-statblock-traits-block__sense">
          <strong>Senses</strong> {sensesStr}
        </div>
      )}
      {languagesStr && (
        <div className="rpg-ui-statblock-traits-block__languages">
          <strong>Languages</strong> {languagesStr}
        </div>
      )}
      {traits.length > 0 && (
        <>
          <div className="rpg-ui-statblock-traits-block__divider" />
          <div className="rpg-ui-statblock-traits-block__list">
            {traits.map((trait, idx) => {
              const traitName = trait.$name ?? trait.name ?? `Trait ${idx + 1}`;
              const description = trait.$contents ?? trait.description;
              return (
                <div key={traitName} className="rpg-ui-statblock-traits-block__item">
                  <strong className="rpg-ui-statblock-traits-block__name">{traitName}.</strong>
                  {description && (
                    <span className="rpg-ui-statblock-traits-block__description"> {description}</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
