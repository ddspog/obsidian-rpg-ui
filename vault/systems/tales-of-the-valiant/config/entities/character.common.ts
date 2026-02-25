/**
 * Detailed types for the character entity blocks, defining the shape of the data for each block and its subcomponents.
 */
export type PillDetails = {
      /** File name for pulling data, and serving as link for the pill. */
      file: string;
      /** Label for showing on the pill, if you do not want solely the file name. */
      text?: string
}

/**
 * Types for the Health block of the Character Entity, defining the shape of its data and subcomponents.
 */
export type SkillDetails = {
  /** Current skill proficiency */
  proficiency: number;
  /** Current skill vantage */
  vantage: number;
  /** Current skill bonus */
  bonus: number;
}
