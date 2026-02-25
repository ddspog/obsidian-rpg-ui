// Utility to convert a banner frontmatter value into a React style object.
// Accepts strings (URL, wikilink, or CSS color) and returns an object
// suitable for passing to a React `style` prop, or `undefined` when no banner
// is provided.
//
// The `BannerValue` type provides template-literal hints for common accepted
// forms to improve IDE autocompletion and developer intent.
export type BannerValue =
  | `#${string}`
  | `rgb(${string})`
  | `rgba(${string})`
  | `hsl(${string})`
  | `hsla(${string})`
  | `http://${string}`
  | `https://${string}`
  | `data:${string}`
  | string;

export function getBannerStyle(value: BannerValue): { backgroundImage: string } | { backgroundColor: string } {
  try {
    const banner = value.trim();

    // If banner looks like a URL or data URI or file path with image extension, use backgroundImage
    const looksLikeUrl = /^(data:|https?:|file:|vault:)?\/\//i.test(banner) || /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(banner);
    if (looksLikeUrl) {
      return { backgroundImage: `url(${banner})` };
    }

    // Otherwise treat as a CSS color string (hex, rgb(), or named color)
    return { backgroundColor: banner };
  } catch (e) {
    return { backgroundColor: 'black' };
  }
}

export default getBannerStyle;
