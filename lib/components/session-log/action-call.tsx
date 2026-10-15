/**
 * An action called on its actor's page — `@[[Kobold, Elite]].action("Mining
 * Pick")` — as the Log shows it: the actor once, in a squircle with the `@`
 * that marks it as theirs (a link to their page), then the action, whose
 * description (as that creature has it) shows on hover.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import type { App } from "obsidian";
import { Markdown } from "lib/components/markdown";
import type { ActionCall } from "lib/domains/session-log/action-call";
import { describeAction } from "lib/services/action-describer";

const appOf = (): App | undefined => (globalThis as unknown as { app?: App }).app;

export function ActionCallView({
  call,
  sourcePath,
  showActor = true,
}: {
  call: ActionCall;
  sourcePath: string;
  /** Show the actor's squircle — off for a second action of theirs on a line. */
  showActor?: boolean;
}) {
  const nameRef = React.useRef<HTMLSpanElement>(null);
  const tipId = React.useId();
  const [tip, setTip] = React.useState<{ text: string | null; style: React.CSSProperties } | null>(null);

  // Open just below the name — or above it, when there's more room there — and
  // stay inside the window however wide the card turns out: the shift is worked
  // out by CSS from the card's own width (a translate's `%`), so it holds while
  // the description is still arriving.
  const show = () => {
    const el = nameRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    const gap = 4;
    const above = window.innerHeight - r.bottom < 220 && r.top > window.innerHeight - r.bottom;
    const roomRight = window.innerWidth - r.left - margin;
    const style: React.CSSProperties = {
      left: Math.max(margin, r.left),
      top: above ? r.top - gap : r.bottom + gap,
      maxWidth: `min(20rem, ${window.innerWidth - 2 * margin}px)`,
      transform: `translate(min(0px, calc(${roomRight}px - 100%)), ${above ? "-100%" : "0"})`,
    };
    setTip({ text: null, style });
    void describeAction(call.page, call.name, sourcePath).then((text) => setTip((t) => (t ? { ...t, text } : t)));
  };
  const hide = () => setTip(null);

  return (
    <span className="lonelog-action-call">
      {showActor && (
        <>
          <ActorPill label={call.label} page={call.page} sourcePath={sourcePath} />{" "}
        </>
      )}
      <span
        ref={nameRef}
        className="lonelog-action-name"
        tabIndex={0}
        aria-describedby={tip ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {call.name}
      </span>
      {tip &&
        // Drawn on the page itself, not inside the Log: a pane's containment
        // would otherwise measure `fixed` from the pane, not the window.
        createPortal(
          <span id={tipId} role="tooltip" className="lonelog-action-tip" style={tip.style}>
            {tip.text == null ? (
              <span className="lonelog-action-tip-wait">…</span>
            ) : tip.text ? (
              <Markdown source={tip.text} sourcePath={sourcePath} className="lonelog-action-tip-text" />
            ) : (
              <span className="lonelog-action-tip-wait">No description on {call.label}'s page.</span>
            )}
          </span>,
          document.body
        )}
    </span>
  );
}

/**
 * The actor of an action, once: the `@` that marks the action as theirs and
 * their name, in a squircle — a link to their page when it's known (click
 * opens it, hover previews it, as any internal link).
 */
export function ActorPill({ label, page, sourcePath }: { label: string; page?: string; sourcePath: string }) {
  const body = (
    <>
      <span className="lonelog-action-at" aria-hidden="true">
        @
      </span>
      {label}
    </>
  );
  if (!page) return <span className="lonelog-action-actor">{body}</span>;
  const openPage = (e: React.MouseEvent) => {
    e.preventDefault();
    void appOf()?.workspace.openLinkText(page, sourcePath, e.metaKey || e.ctrlKey);
  };
  const previewPage = (e: React.MouseEvent) => {
    appOf()?.workspace.trigger("hover-link", {
      event: e.nativeEvent,
      source: "preview",
      hoverParent: { hoverPopover: null },
      targetEl: e.currentTarget,
      linktext: page,
      sourcePath,
    });
  };
  return (
    <a
      className="lonelog-action-actor internal-link"
      href={page}
      data-href={page}
      onClick={openPage}
      onMouseOver={previewPage}
    >
      {body}
    </a>
  );
}
