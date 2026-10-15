/**
 * A picture drawn in the card frame — the art alone, the frame and the name
 * plaque made here, once, not painted into every picture by the model. The
 * frame is CSS (gold filigree on deep violet) unless the settings hold a
 * generated one, which goes over the art with its window cut out.
 */

import * as React from "react";
import { TFile } from "obsidian";
import { cardFrameSettings, FRAME_KINDS, type FrameKind, type FrameNameMode } from "lib/services/card-frame-config";

/** A vault path as a URL, through the app the plugin runs in. */
function vaultUrl(path: string): string | undefined {
  const app = (
    globalThis as { app?: { vault: { getAbstractFileByPath(p: string): unknown; getResourcePath(f: TFile): string } } }
  ).app;
  const f = app?.vault.getAbstractFileByPath(path);
  return f instanceof TFile ? app!.vault.getResourcePath(f) : undefined;
}

interface CardFrameProps {
  /** The art — an `<img>`, or anything that draws it. */
  children: React.ReactNode;
  /** The name on the plaque; none: no plaque. */
  title?: string;
  /** Which frame: a spell's, a character's… (a character's by default). */
  kind?: FrameKind;
  /** How the name shows, over the kind's own: `none` hides it. */
  name?: FrameNameMode;
  /** The art's shape, width / height, when the frame has no shape of its own. */
  aspect?: number;
  /** Resolves a vault path to a URL (the generated frame's picture); the vault's, by default. */
  resolveUrl?: (path: string) => string | undefined;
  className?: string;
}

export function CardFrame({ children, title, kind = "portrait", name, aspect, resolveUrl, className }: CardFrameProps) {
  const settings = cardFrameSettings(kind);
  const image = settings?.image;
  const mode = name ?? settings?.name ?? FRAME_KINDS[kind].name;
  // A character's card is tall unless the art says otherwise.
  const artAspect = aspect ?? (kind === "portrait" ? 0.75 : undefined);
  const shown = mode === "none" ? undefined : title;
  const url = image ? (resolveUrl ?? vaultUrl)(image.path) : undefined;
  if (image && url) {
    const w = image.window;
    return (
      <figure
        className={`rpg-card-frame is-image is-${kind} ${className ?? ""}`}
        style={{ aspectRatio: String(image.aspect) }}
      >
        <div
          className="rpg-card-frame-window"
          style={{ top: `${w.top}%`, right: `${w.right}%`, bottom: `${w.bottom}%`, left: `${w.left}%` }}
        >
          {children}
        </div>
        <img className="rpg-card-frame-overlay" src={url} alt="" draggable={false} />
        {shown && mode === "band" && (
          // On a generated frame the name sits in the middle of its bottom band.
          <figcaption className="rpg-card-frame-plaque is-on-frame" style={{ bottom: `${w.bottom / 2}%` }}>
            {shown}
          </figcaption>
        )}
        {shown && mode === "plaque" && (
          // Over the foot of the art, inside the window, centred on it.
          <figcaption
            className="rpg-card-frame-plaque is-on-art"
            style={{
              bottom: `calc(${w.bottom}% + 0.4rem)`,
              left: `${w.left + (100 - w.left - w.right) / 2}%`,
              maxWidth: `${(100 - w.left - w.right) * 0.9}%`,
            }}
          >
            {shown}
          </figcaption>
        )}
      </figure>
    );
  }
  return (
    <figure className={`rpg-card-frame is-${kind} ${className ?? ""}`}>
      <div className="rpg-card-frame-inner">
        <div className="rpg-card-frame-art" style={artAspect ? { aspectRatio: String(artAspect) } : undefined}>
          {children}
        </div>
      </div>
      {shown && <figcaption className="rpg-card-frame-plaque">{shown}</figcaption>}
    </figure>
  );
}
