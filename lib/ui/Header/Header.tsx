import BannerHeader, { BannerHeaderProps } from "./BannerHeader";

export const Header = {
  Banner: BannerHeader,
} as const;

// Merge a type namespace onto the Header value so consumers can access
// Header.BannerProps as a type (e.g. `type Props = Header.BannerProps`).
export namespace Header {
  export type BannerProps = BannerHeaderProps;
}

export type HeaderType = typeof Header;

export default Header;
