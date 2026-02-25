import { EntityBlock, TriggerButton } from "rpg-ui-toolkit";
import { HealthProps } from "./health.types";
import { CharacterEntity } from "../../entities/character.types";

export const health: EntityBlock<HealthProps, CharacterEntity> = ({ self, blocks, lookup, trigger }) => {
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
};

export default health;
