/**
 * How a card's form sits on the page, shared by every card form (the play form, the party's forms): in the
 * drawer it is the drawer's next section, as tall as the window leaves under the cards (`--card-room`); on a
 * phone it is a sheet over the story, with a drag handle, over a dimmed page that a tap closes it from.
 * Either way Escape closes it, Tab stays inside, and focus goes in to the first field and back after.
 */

import * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** The first field a card's form focuses as it opens (else its submit button). */
const FIRST_FIELD = ".placeholder-fields :is(input, select, textarea)";

export interface CardShell {
  /** Whether the form is the phone's sheet. */
  sheet: boolean;
  rootRef: React.RefObject<HTMLDivElement>;
  /** The root's own props: its class (with `is-sheet`), the dialog's role and the Tab trap. */
  rootProps: {
    className: string;
    role: "dialog";
    "aria-modal": "true";
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  };
  /** The sheet's drag handle (nothing in the drawer). */
  handle: React.ReactNode;
  /** The form as it shows: portalled over a scrim on a phone, in place in the drawer. */
  present: (popover: React.ReactElement) => React.ReactElement;
}

export function useCardShell(onCancel: () => void, className = ""): CardShell {
  const sheet = useIsPhone();
  const rootRef = useRef<HTMLDivElement>(null);
  // In the drawer the card is as tall as the window leaves under the cards above it (measured, so the drawer
  // still fits the pane and keeps to its foot), its fields scrolling inside past that.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (sheet || !el) return;
    const drawer = el.closest<HTMLElement>(".lonelog-bottom-drawer");
    const view = el.closest<HTMLElement>(".markdown-preview-view, .cm-scroller");
    // The drawer sticks to the pane's foot but can't rise above the log it belongs to.
    const zone = el.closest<HTMLElement>(".lonelog-dock-zone");
    if (!drawer) return;
    const fit = () => {
      const top = Math.max(view ? view.getBoundingClientRect().top : 0, zone ? zone.getBoundingClientRect().top : 0);
      const above = el.getBoundingClientRect().top - drawer.getBoundingClientRect().top;
      // the drawer's own foot and the status bar's corner, about 3rem
      const room = window.innerHeight - top - above - 48;
      el.style.setProperty("--card-room", `${Math.max(256, Math.round(room))}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [sheet]);
  // Escape closes it, on a phone or not.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  // Focus goes in, to the first field (or the submit button when there is none), and back to the card's tile after.
  useEffect(() => {
    const from = document.activeElement as HTMLElement | null;
    const el = rootRef.current;
    const first =
      el?.querySelector<HTMLElement>(FIRST_FIELD) ?? el?.querySelector<HTMLElement>("button.placeholder-submit");
    first?.focus({ preventScroll: true });
    return () => {
      if (from && from.isConnected && from !== document.body) from.focus({ preventScroll: true });
    };
  }, []);
  // On a phone the page behind the sheet holds still.
  useEffect(() => {
    if (!sheet) return;
    const scroller = document.querySelector<HTMLElement>(".workspace-leaf.mod-active .markdown-preview-view");
    const was = scroller?.style.overflow ?? "";
    if (scroller) scroller.style.overflow = "hidden";
    return () => {
      if (scroller) scroller.style.overflow = was;
    };
  }, [sheet]);
  // Drag the sheet's handle down to close it.
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);
  const onDragStart = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, t: e.timeStamp, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !rootRef.current) return;
    d.dy = Math.max(0, e.clientY - d.y);
    rootRef.current.style.setProperty("--drag", `${d.dy}px`);
  };
  const onDragEnd = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !rootRef.current) return;
    rootRef.current.style.removeProperty("--drag");
    if (d.dy > 60 || (d.dy > 12 && d.dy / Math.max(1, e.timeStamp - d.t) > 0.6)) onCancel();
  };
  // Tab stays inside the card while it is open.
  const onTrapKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const stops = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>(
        "input, select, textarea, button, summary, a[href], [tabindex]:not([tabindex='-1'])"
      ) ?? []
    ).filter((x) => !x.hasAttribute("disabled") && x.getClientRects().length > 0);
    if (stops.length === 0) return;
    const i = stops.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && i <= 0) {
      e.preventDefault();
      stops[stops.length - 1].focus();
    } else if (!e.shiftKey && i === stops.length - 1) {
      e.preventDefault();
      stops[0].focus();
    }
  };

  const handle = sheet ? (
    <div
      className="placeholder-handle"
      aria-hidden="true"
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
    />
  ) : null;

  // On a phone the card is a sheet over the story, outside the drawer's own scrolling and clipping, over a
  // dimmed page that a tap closes it from.
  const present = (popover: React.ReactElement): React.ReactElement =>
    sheet
      ? createPortal(
          <>
            <div
              className="placeholder-scrim"
              aria-hidden="true"
              onPointerDown={(e) => {
                e.preventDefault();
                onCancel();
              }}
            />
            {popover}
          </>,
          document.body
        )
      : popover;

  return {
    sheet,
    rootRef,
    rootProps: {
      className: ["lonelog-placeholder-popover", className, sheet ? "is-sheet" : ""].filter(Boolean).join(" "),
      role: "dialog",
      "aria-modal": "true",
      onKeyDown: onTrapKey,
    },
    handle,
    present,
  };
}

/** Whether the window is phone-width (the layout the sheet is for). */
export function useIsPhone(): boolean {
  const query = "(max-width: 600px)";
  const [phone, setPhone] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}
