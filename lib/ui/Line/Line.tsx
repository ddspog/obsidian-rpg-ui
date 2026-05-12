import * as React from "react";

export type LinePillsProps = {
  children?: React.ReactNode;
};

export const Pills: React.FC<LinePillsProps> = ({ children }) => {
  // Render a semantic menu element targeted by CSS via its aria-label
  return <menu aria-details="Line of Pills">{children}</menu>;
};

export type LineBigElementsProps = {
  children?: React.ReactNode;
};

export const BigElements: React.FC<LineBigElementsProps> = ({ children }) => {
  // Semantic menu targeted by aria-label for styling large action items
  return <menu aria-details="Line of Big Elements">{children}</menu>;
};

export type LineButtonsProps = {
  children?: React.ReactNode;
};

export const Buttons: React.FC<LineButtonsProps> = ({ children }) => {
  // Group small inline buttons; styled via menu[aria-label="Line Buttons"]
  return <menu aria-details="Line of Buttons">{children}</menu>;
};

export type LineControlProps = {
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

export const Control: React.FC<LineControlProps> = ({ children, style }) => {
  return (
    <menu aria-details="Line Control" style={style}>
      {children}
    </menu>
  );
};

export type LineStatsProps = {
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

export const Stats: React.FC<LineStatsProps> = ({ children, style }) => {
  return (
    <menu aria-details="Line Stats" style={style}>
      {children}
    </menu>
  );
};

export const Line = {
  Pills,
  BigElements,
  Buttons,
  Control,
  Stats,
} as const;

export namespace Line {
  export type PillsProps = LinePillsProps;
  export type BigElementsProps = LineBigElementsProps;
  export type ButtonsProps = LineButtonsProps;
  export type ControlProps = LineControlProps;
  export type StatsProps = LineStatsProps;
}

export type LineType = typeof Line;

export default Line;
