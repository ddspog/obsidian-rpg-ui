import * as React from "react";

/** What a table reference reads at a roll — `@[[03. Anglish]]#anglish-masculine` at 44 — or
 *  undefined when that table isn't loaded. Lets the Log show a table roll's result as soon
 *  as the die is rolled, before it is saved. */
export type TableRoll = (
  ref: string,
  roll: number,
  /** A second roll on the same row: the columns it chooses among, and what it rolled. */
  pick?: { spec: string; roll: number }
) => string | undefined;

export const TableRollContext = React.createContext<TableRoll | undefined>(undefined);
