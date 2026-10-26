/**
 * A frame as it will be drawn, around stand-in art with a sample name — what
 * the settings show beside each kind's frame, as the image studio does for a
 * new picture.
 */

import * as React from "react";
import { CardFrame } from "./CardFrame";
import { FRAME_KINDS, type FrameKind, type FrameNameMode, type FrameSource } from "lib/services/card-frame-config";

interface CardFramePreviewProps {
  kind: FrameKind;
  /** The name mode being tried, over the saved one. */
  name?: FrameNameMode;
  /** Which frame to show, over the one the settings chose. */
  source?: FrameSource;
}

export function CardFramePreview({ kind, name, source }: CardFramePreviewProps) {
  const wide = FRAME_KINDS[kind].aspect === "16:9";
  // The art's shape where the frame is drawn: a banner's, a spell card's picture, or a tall portrait.
  const art = wide ? 4 : kind === "spell" ? 1.705 : 0.75;
  return (
    <div
      className="rpg-card-frame-preview"
      style={{ maxWidth: wide ? "26rem" : art < 1 ? "8.5rem" : "13rem", width: "100%" }}
    >
      <CardFrame
        kind={kind}
        title="Sample name"
        aspect={art}
        {...(name ? { name } : {})}
        {...(source ? { source } : {})}
      >
        <div className="rpg-card-frame-sample" />
      </CardFrame>
    </div>
  );
}
