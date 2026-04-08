/**
 * SpellsCollectorBlock placeholder component
 *
 * Displays a list of spells gathered for the character across all sources.
 * Placeholder for the `rpg character.spells` block in character notes.
 */

interface SpellItem {
  name: string;
  circle?: string;
  prepared?: boolean;
}

export function SpellsCollectorBlock(props: Record<string, unknown>) {
  const spells = (props.spells ?? []) as SpellItem[];
  const title = (props.title as string | undefined) ?? "Spells";

  const spellsByCircle = spells.reduce<Map<string, SpellItem[]>>((map, spell) => {
    const circle = spell.circle ?? "0";
    const group = map.get(circle) ?? [];
    map.set(circle, [...group, spell]);
    return map;
  }, new Map());

  return (
    <div className="rpg-ui-block rpg-ui-spells-collector-block">
      <div className="rpg-ui-block__title">{title}</div>
      {spells.length === 0 ? (
        <div className="rpg-ui-block__empty">No spells.</div>
      ) : (
        <div className="rpg-ui-spells-collector-block__circles">
          {Array.from(spellsByCircle.entries()).map(([circle, circleSpells]) => (
            <div key={circle} className="rpg-ui-spells-collector-block__circle">
              <div className="rpg-ui-spells-collector-block__circle-label">Circle {circle}</div>
              {circleSpells.map((spell) => (
                <div key={spell.name} className="rpg-ui-spells-collector-block__spell">
                  {spell.prepared !== undefined && (
                    <span
                      className={`rpg-ui-spells-collector-block__prepared${spell.prepared ? " rpg-ui-spells-collector-block__prepared--active" : ""}`}
                    />
                  )}
                  <span className="rpg-ui-spells-collector-block__spell-name">{spell.name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
