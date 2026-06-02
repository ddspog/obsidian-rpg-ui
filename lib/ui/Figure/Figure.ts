import { FigureColumn } from "./FigureColumn";
import type { FigureColumnProps } from "./FigureColumn";

export const Figure = {
  Column: FigureColumn,
} as const;

export namespace Figure {
  export type ColumnProps = FigureColumnProps;
}

export type FigureType = typeof Figure;

export default Figure;
