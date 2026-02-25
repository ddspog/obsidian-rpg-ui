/**
 * Types for the Senses block of the Character Entity, defining the shape of its props.
 */
export type SensesProps = {
    /** List of senses with their type and range (if any) */
    senses_list: {
      /* Range in feet, if applicable (e.g. darkvision), otherwise null (e.g. blindsight) */
      range?: number;
      /* Type of sense, e.g. "darkvision", "blindsight", "tremorsense", "truesight", etc. */
      type: string;
    }[];
}
