import * as React from "react";
import { EntityBlock } from "rpg-ui-toolkit";
import type { UnlockBlock } from "../../../../../../lib/domains/features/types";

export const unlock: EntityBlock<UnlockBlock> = ({ self }) => (
  <aside className="rpg-feature-card rpg-feature-card-unlock" aria-label="Feature Unlock">
    <small>Unlocks {self.kind} at Lv. {self.level}</small>
  </aside>
);

export default unlock;
