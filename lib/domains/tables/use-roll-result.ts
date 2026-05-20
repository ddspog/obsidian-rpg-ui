import { useCallback, useEffect, useState } from "react";
import type { TableDef, FooterCell } from "./types";
import { rollCell } from "./roll";
import { getRollResult, setRollResult, subscribeRollResult } from "./roll-store";

export function useRollResult(
  key: string,
  def: TableDef,
  cell: FooterCell
): { values: string[] | undefined; reroll: () => void } {
  const [values, setValues] = useState<string[] | undefined>(() => {
    const stored = getRollResult(key);
    if (stored) return stored;
    const hasRoll = cell.segments.some((s) => s.kind === "roll");
    if (hasRoll) {
      const rolled = rollCell(def, cell);
      setRollResult(key, rolled);
      return rolled;
    }
    return undefined;
  });

  useEffect(() => {
    const unsubscribe = subscribeRollResult(key, () => {
      setValues(getRollResult(key));
    });
    return unsubscribe;
  }, [key]);

  const reroll = useCallback(() => {
    const rolled = rollCell(def, cell);
    setRollResult(key, rolled);
  }, [key, def, cell]);

  return { values, reroll };
}
