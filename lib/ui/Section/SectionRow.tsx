import * as React from "react";

export interface SectionRowProps {
  label: string;
  /** Space-separated flex weights for each child, e.g. "1 2" — mirrors BannerHeader.distribution */
  distribution?: string;
  children?: React.ReactNode;
}

export function SectionRow({ label, distribution = "1 1", children }: SectionRowProps) {
  const weights = distribution
    .split(/\s+/)
    .map(s => Number(s.trim()))
    .filter(n => !Number.isNaN(n) && n > 0);

  const childArray = React.Children.toArray(children);

  const elems = childArray.map((child, idx) => {
    const weight = weights.length ? (weights[idx] ?? 1) : 1;
    const flexStyle: React.CSSProperties = { flex: `${weight} 1 auto` };

    if (React.isValidElement(child)) {
      const existing = (child.props as any).style || {};
      return React.cloneElement(child as React.ReactElement<any>, { style: { ...existing, ...flexStyle }, key: idx });
    }

    return <div key={idx} style={flexStyle}>{child}</div>;
  });

  return (
    <section aria-details={`${label} Row`}>
      {elems}
    </section>
  );
}
