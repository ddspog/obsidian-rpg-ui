import * as React from "react";
import { useSourceFile } from "../source-file";

// aria-label or other attributes may be passed through
export type TitleProps = React.HTMLAttributes<HTMLFigureElement>;

/**
 * Title
 * Small helper component that reserves a prominent heading area and
 * displays the title (vault basename) of the note the block is rendered from, when available.
 */
export function Title(props: TitleProps) {
  const { children, ...rest } = props;

  const title = useSourceFile()?.basename ?? "";

  return (
    <figure {...rest} aria-details="Page Title">
      {title || children || null}
    </figure>
  );
}

export default Title;
