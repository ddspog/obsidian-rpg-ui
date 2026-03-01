import * as React from "react";

export interface TriggerButtonProps {
  /** Callback fired when the button is clicked */
  onClick: () => void;
  /** Button label text (children) */
  children?: React.ReactNode;
  /** Accessible label string, defaults to children text if omitted */
  "aria-label"?: string;
}

/**
 * A small icon+label button intended to fire system events via `trigger(...)`.
 *
 * ```tsx
 * <TriggerButton onClick={() => trigger('short-rest')} icon="🍴">Short Rest</TriggerButton>
 * ```
 */
export function TriggerButton({
  onClick,
  children,
  "aria-label": ariaLabel,
}: TriggerButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? (typeof children === "string" ? children : undefined)}
      aria-details="Trigger Button"
    >
      {children}
    </button>
  );
}

// Convenience namespace import: allow usage like `Button.Trigger`
export const Button = {
  Trigger: TriggerButton,
};
