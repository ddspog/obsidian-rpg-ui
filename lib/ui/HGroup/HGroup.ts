import { HGroupRow } from "./HGroupRow";
import type { HGroupRowProps } from "./HGroupRow";

export const HGroup = {
  Row: HGroupRow,
} as const;

export namespace HGroup {
  export type RowProps = HGroupRowProps;
}

export type HGroupType = typeof HGroup;

export default HGroup;
