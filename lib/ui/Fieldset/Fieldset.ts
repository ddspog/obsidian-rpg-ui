import { FieldsetHealth } from "./FieldsetHealth";
import type { FieldsetHealthProps } from "./FieldsetHealth";

export const Fieldset = {
  Health: FieldsetHealth,
} as const;

export namespace Fieldset {
  export type HealthProps = FieldsetHealthProps;
}

export type FieldsetType = typeof Fieldset;

export default Fieldset;
