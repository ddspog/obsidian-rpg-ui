import * as React from "react";
import type { App } from "obsidian";
import { getFileTitle } from "../../utils/getFileTitle";

// aria-label or other attributes may be passed through
export type TitleProps = React.HTMLAttributes<HTMLFigureElement>;

/**
 * Title
 * Small helper component that reserves a prominent heading area and
 * displays the current file's title (vault basename) when available.
 */
export function Title(props: TitleProps) {
  const { children, ...rest } = props;

  const app = (globalThis as any).app as App | undefined;
  const title = getFileTitle(app) || "";

  return (
    <figure {...rest} aria-details="Page Title">
      {title || children || null}
    </figure>
  );
}

export default Title;
