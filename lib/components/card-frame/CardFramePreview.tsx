/**
 * A frame as it will be drawn, around stand-in art with a sample name — what
 * the settings show beside each kind's frame, as the image studio does for a
 * new picture.
 */

import * as React from "react";
import { CardFrame } from "./CardFrame";
import { FRAME_KINDS, type FrameKind, type FrameNameMode } from "lib/services/card-frame-config";

interface CardFramePreviewProps {
  kind: FrameKind;
  /** The name mode being tried, over the saved one. */
  name?: FrameNameMode;
}

export function CardFramePreview({ kind, name }: CardFramePreviewProps) {
  const wide = FRAME_KINDS[kind].aspect === "16:9";
  return (
    <div className="rpg-card-frame-preview" style={{ maxWidth: wide ? "26rem" : "13rem" }}>
      <CardFrame kind={kind} title="Sample name" aspect={wide ? 4 : 1.705} {...(name ? { name } : {})}>
        <div className="rpg-card-frame-sample" />
      </CardFrame>
    </div>
  );
}
