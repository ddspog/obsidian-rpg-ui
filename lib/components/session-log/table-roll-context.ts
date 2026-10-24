import * as React from "react";

/** What a table reference reads at a roll — `@[[03. Anglish]]#anglish-masculine` at 44 — or
 *  undefined when that table isn't loaded. Lets the Log show a table roll's result as soon
 *  as the die is rolled, before it is saved. */
export type TableRoll = (
  ref: string,
  roll: number,
  /** A name made of rows (`@pick(…)`): read one part of a row, or the name the rows make, taken by
   *  the second roll (none: every name there is). */
  pick?: { spec: string; part?: number; rolls?: number[]; roll?: number }
) => string | undefined;

export const TableRollContext = React.createContext<TableRoll | undefined>(undefined);
