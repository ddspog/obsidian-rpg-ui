import { StatusPanel } from "./StatusPanel";
import type { StatusPanelProps } from "./StatusPanel";

export const Panel = {
  Status: StatusPanel,
} as const;

export namespace Panel {
  export type StatusProps = StatusPanelProps;
}

export type PanelType = typeof Panel;

export default Panel;
