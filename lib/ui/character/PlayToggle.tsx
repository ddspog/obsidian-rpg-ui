import * as React from "react";

const KEY = "rpg-ui:play-mode";
const CLASS = "rpg-play-mode";

function pane(from: Element | null): HTMLElement | null {
  // The reading pane itself, not a code block's own `.markdown-rendered` wrapper.
  return (
    from?.closest<HTMLElement>(".markdown-preview-view") ?? from?.closest<HTMLElement>(".markdown-rendered") ?? null
  );
}

/**
 * Phone-only switch between the whole sheet and just what a fight needs (the
 * banner, vitals, ability and save hexes, and attacks). It sets a class on the
 * reading pane; the CSS in `play-toggle.css` does the hiding, so the other
 * blocks need no knowledge of it. Remembered per device.
 */
export function PlayToggle() {
  const nav = React.useRef<HTMLElement>(null);
  const [play, setPlay] = React.useState(() => {
    try {
      return window.localStorage.getItem(KEY) === "play";
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    const el = pane(nav.current);
    el?.classList.toggle(CLASS, play);
    return () => el?.classList.remove(CLASS);
  }, [play]);

  const choose = (next: boolean) => {
    setPlay(next);
    try {
      window.localStorage.setItem(KEY, next ? "play" : "sheet");
    } catch {
      // Nowhere to keep it: the sheet opens whole next time.
    }
  };

  return (
    <nav ref={nav} aria-details="Play Toggle" aria-label="Sheet view">
      <button type="button" aria-pressed={play} onClick={() => choose(true)}>
        Play
      </button>
      <button type="button" aria-pressed={!play} onClick={() => choose(false)}>
        Sheet
      </button>
    </nav>
  );
}
