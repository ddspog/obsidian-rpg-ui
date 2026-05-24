/**
 * Types for the Stats block of the Character Entity.
 *
 * Each attribute is just its starting (base) score. Save proficiency now
 * comes from the resolved features view's `Saves` trait, and ASI bumps
 * fold into the displayed value automatically — so there's no need to
 * carry per-attribute `save: { proficiency, vantage, bonus }` objects in
 * the YAML anymore.
 *
 * The expanded object form (`STR: { value: 14, save: {...} }`) still
 * works as an override for the rare case an author needs to set save
 * vantage/bonus by hand.
 */
type AttributeBase =
  | number
  | {
      value: number;
      save?: {
        proficiency?: number;
        vantage?: number;
        bonus?: number;
      };
    };

export type StatsProps = {
  /** Each core attribute — number shorthand for the starting score, or
   *  an object `{ value, save: {…} }` to author save overrides. */
  STR?: AttributeBase;
  DEX?: AttributeBase;
  CON?: AttributeBase;
  INT?: AttributeBase;
  WIS?: AttributeBase;
  CHA?: AttributeBase;
};
