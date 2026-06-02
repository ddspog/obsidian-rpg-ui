import * as React from "react";

export type BannerHeaderProps = {
  label: string;
  background?: string;
  distribution?: string; // e.g. "2 1" — space-separated flex numbers matching children
  children?: React.ReactNode;
};

function parseBannerStyle(value?: string): React.CSSProperties | undefined {
  if (!value) return undefined;
  try {
    const banner = value.trim();
    const looksLikeUrl =
      /^(data:|https?:|file:|vault:)?\/\//i.test(banner) || /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(banner);
    if (looksLikeUrl) return { backgroundImage: `url(${banner})` };
    return { backgroundColor: banner };
  } catch (e) {
    return { backgroundColor: "black" };
  }
}

export const BannerHeader: React.FC<BannerHeaderProps> = ({ label, background, distribution = "1 1", children }) => {
  const style = parseBannerStyle(background);
  // We no longer apply a className on the header; styles target the header via its aria-label
  // so simply render the header with the computed style.

  // Parse distribution string into numeric weights
  const weights = distribution
    .split(/\s+/)
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n) && n > 0);

  const childArray = React.Children.toArray(children);

  // If weights are provided, apply them to matching children; otherwise default to equal flex
  const elems = childArray.map((child, idx) => {
    const weight = weights.length ? (weights[idx] ?? 1) : 1;
    const flexStyle: React.CSSProperties = { flex: `${weight} 1 auto` };

    if (React.isValidElement(child)) {
      // Merge any existing style prop
      const existing = (child.props as any).style || {};
      return React.cloneElement(child as React.ReactElement<any>, { style: { ...existing, ...flexStyle }, key: idx });
    }

    // For non-elements, wrap in a div but preserve semantic flow
    return (
      <div key={idx} style={flexStyle}>
        {child}
      </div>
    );
  });

  return (
    <header aria-details={`${label} Banner`} style={style}>
      {elems}
    </header>
  );
};

export default BannerHeader;
