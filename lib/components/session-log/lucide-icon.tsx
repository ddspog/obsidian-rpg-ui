/**
 * A Lucide icon by NAME, as authored in YAML: kebab-case (`help-circle`, the
 * form Obsidian's own icon fields use) or PascalCase (`HelpCircle`). An unknown
 * name renders nothing, so a typo leaves a card plain rather than broken.
 */

import * as React from "react";
import * as Lucide from "lucide-react";

type IconComponent = React.ComponentType<{ size?: number | string; strokeWidth?: number; className?: string }>;

const toPascal = (name: string) =>
  name
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");

/** The Lucide component for a name, or null when there is none. */
export function lucideComponent(name: string | undefined): IconComponent | null {
  if (!name) return null;
  const icons = Lucide as unknown as Record<string, IconComponent | undefined>;
  return icons[name] ?? icons[toPascal(name)] ?? null;
}

export function LucideIcon({
  name,
  size,
  strokeWidth,
  className,
}: {
  name?: string;
  size?: number | string;
  strokeWidth?: number;
  className?: string;
}) {
  const Comp = lucideComponent(name);
  return Comp ? <Comp size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" /> : null;
}
