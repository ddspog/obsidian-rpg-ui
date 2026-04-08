/**
 * StatblockHeaderBlock placeholder component
 *
 * Displays the header section of a creature stat block: name, type, AC, HP, speed.
 * Placeholder for the `rpg statblock.header` block in statblock notes.
 */

export function StatblockHeaderBlock(props: Record<string, unknown>) {
  const name = props.name as string | undefined;
  const sizeType = (props.size_type ?? props.sizeType) as string | undefined;
  const alignment = props.alignment as string | undefined;
  const ac = props.ac !== undefined ? Number(props.ac) : undefined;
  const acSource = (props.ac_source ?? props.acSource) as string | undefined;
  const hp = props.hp !== undefined ? Number(props.hp) : undefined;
  const hitDice = (props.hit_dice ?? props.hitDice) as string | undefined;
  const speed = props.speed as string | undefined;

  return (
    <div className="rpg-ui-block rpg-ui-statblock-header-block">
      {name && <div className="rpg-ui-block__title">{name}</div>}
      {(sizeType || alignment) && (
        <div className="rpg-ui-statblock-header-block__meta">
          {[sizeType, alignment].filter(Boolean).join(", ")}
        </div>
      )}
      <div className="rpg-ui-statblock-header-block__divider" />
      <div className="rpg-ui-statblock-header-block__basics">
        {ac !== undefined && (
          <div className="rpg-ui-statblock-header-block__basic">
            <strong>Armor Class</strong> {ac}
            {acSource && ` (${acSource})`}
          </div>
        )}
        {hp !== undefined && (
          <div className="rpg-ui-statblock-header-block__basic">
            <strong>Hit Points</strong> {hp}
            {hitDice && ` (${hitDice})`}
          </div>
        )}
        {speed && (
          <div className="rpg-ui-statblock-header-block__basic">
            <strong>Speed</strong> {speed}
          </div>
        )}
      </div>
    </div>
  );
}
