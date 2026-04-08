import { BadgeShield } from "./BadgeShield";
import type { BadgeShieldProps } from "./BadgeShield";

export const Badge = {
  Shield: BadgeShield,
} as const;

export namespace Badge {
  export type ShieldProps = BadgeShieldProps;
}

export type BadgeType = typeof Badge;

export default Badge;
