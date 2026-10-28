export type CheckboxProps = {
  id: string;
  checked: boolean;
  onChange: () => void;
  className?: string;
  /** What the box is for, for a screen reader (`Sneak Attack, use 2 of 3`). */
  label?: string;
};

export function Checkbox({ id, checked, onChange, className, label }: CheckboxProps) {
  return (
    <button
      id={id}
      className={`checkbox-button clickable-icon ${className || ""}`}
      onClick={onChange}
      aria-pressed={checked}
      {...(label ? { "aria-label": label } : {})}
      type="button"
    />
  );
}
