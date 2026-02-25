import * as React from "react";

export interface TriggerButtonProps {
  /** Callback fired when the button is clicked */
  onClick: () => void;
  /** Optional emoji or short string shown before the label */
  icon?: string;
  /** Button label text (children) */
  children?: React.ReactNode;
  /** Optional CSS class appended to the root element */
  className?: string;
  /** Accessible label, defaults to children text if omitted */
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
  icon,
  children,
  className,
  "aria-label": ariaLabel,
}: TriggerButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      className={["rpg-trigger-button", className].filter(Boolean).join(" ")}
      onClick={onClick}
      aria-label={ariaLabel ?? (typeof children === "string" ? children : undefined)}
    >
      {icon && <span className="rpg-trigger-button__icon" aria-hidden="true">{icon}</span>}
      {children && <span className="rpg-trigger-button__label">{children}</span>}
    </button>
  );
}
