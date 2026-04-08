import { SectionRow } from "./SectionRow";
import type { SectionRowProps } from "./SectionRow";

export const Section = {
  Row: SectionRow,
} as const;

export namespace Section {
  export type RowProps = SectionRowProps;
}

export type SectionType = typeof Section;

export default Section;
