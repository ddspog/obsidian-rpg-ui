import * as React from "react";
import { EntityBlock, FeatureLevelAddition } from "rpg-ui-toolkit";

/**
 * feature.level — data-only block. Contributes per-level traits to the
 * preceding feature.details via the resolver; renders no visible UI.
 *
 * Implementation: on mount, remove the entire `.el-pre` wrapper from the
 * markdown-preview-section. Hiding via CSS `display:none` (whether inline or
 * via `:has()`) breaks Obsidian's reading-view virtualization — when the
 * collapsed block sits in the current viewport, Obsidian fails to render the
 * sections that should follow it. Removing the wrapper outright lets the
 * section's MutationObserver re-measure cleanly.
 */
export const level: EntityBlock<FeatureLevelAddition> = () => {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const wrapper = node.closest(".el-pre") ?? node.parentElement;
    wrapper?.remove();
  }, []);

  return <div ref={ref} aria-hidden="true" />;
};

export default level;
