/**
 * StatblockAttributesBlock placeholder component
 *
 * Displays the six core attribute scores for a creature in a columnar layout.
 * Placeholder for the `rpg statblock.attributes` block in statblock notes.
 */

const DEFAULT_ATTRIBUTES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const DEFAULT_ALIASES: Record<string, string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

export function StatblockAttributesBlock(props: Record<string, unknown>) {
  const scores = (props.scores ?? props) as Record<string, number>;
  const attributes = (props.attributes as string[] | undefined) ?? DEFAULT_ATTRIBUTES;

  return (
    <div className="rpg-ui-block rpg-ui-statblock-attributes-block">
      <div className="rpg-ui-statblock-attributes-block__grid">
        {attributes.map((attr) => {
          const score = Number(scores[attr] ?? 10);
          const modifier = Math.floor((score - 10) / 2);
          const sign = modifier >= 0 ? "+" : "";
          const alias = DEFAULT_ALIASES[attr] ?? attr.slice(0, 3).toUpperCase();
          return (
            <div key={attr} className="rpg-ui-statblock-attributes-block__col">
              <div className="rpg-ui-statblock-attributes-block__label">{alias}</div>
              <div className="rpg-ui-statblock-attributes-block__score">
                {score} ({sign}{modifier})
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
