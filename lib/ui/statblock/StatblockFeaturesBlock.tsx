/**
 * StatblockFeaturesBlock placeholder component
 *
 * Displays creature actions, bonus actions, reactions, and legendary actions.
 * Placeholder for the `rpg statblock.features` block in statblock notes.
 */

interface ActionItem {
  name?: string;
  $name?: string;
  description?: string;
  $contents?: string;
}

function ActionSection({ title, items }: { title: string; items: ActionItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rpg-ui-statblock-features-block__section">
      <div className="rpg-ui-statblock-features-block__section-title">{title}</div>
      {items.map((item, idx) => {
        const itemName = item.$name ?? item.name ?? `${title} ${idx + 1}`;
        const description = item.$contents ?? item.description;
        return (
          <div key={itemName} className="rpg-ui-statblock-features-block__action">
            <strong className="rpg-ui-statblock-features-block__action-name">{itemName}.</strong>
            {description && (
              <span className="rpg-ui-statblock-features-block__action-description"> {description}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function StatblockFeaturesBlock(props: Record<string, unknown>) {
  const actions = (props.actions ?? []) as ActionItem[];
  const bonusActions = (props.bonus_actions ?? props.bonusActions ?? []) as ActionItem[];
  const reactions = (props.reactions ?? []) as ActionItem[];
  const legendaryActions = (props.legendary_actions ?? props.legendaryActions ?? []) as ActionItem[];

  return (
    <div className="rpg-ui-block rpg-ui-statblock-features-block">
      <ActionSection title="Actions" items={actions} />
      <ActionSection title="Bonus Actions" items={bonusActions} />
      <ActionSection title="Reactions" items={reactions} />
      <ActionSection title="Legendary Actions" items={legendaryActions} />
    </div>
  );
}
