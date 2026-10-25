import * as React from "react";
import { createPortal } from "react-dom";

const ITEMS: Array<{ mark: React.ReactNode; term: string; meaning: string }> = [
  {
    mark: <span data-mark="ring">+5</span>,
    term: "Gold ring on a save",
    meaning: "You are proficient in that saving throw.",
  },
  { mark: <span data-mark="adv">A</span>, term: "Green A", meaning: "Advantage: roll two d20 and keep the higher." },
  { mark: <span data-mark="dis">D</span>, term: "Red D", meaning: "Disadvantage: roll two d20 and keep the lower." },
  {
    mark: <span data-mark="dot-full" />,
    term: "Filled dot (skills)",
    meaning: "Proficient. A ringed dot is expertise; a half-filled one is half proficiency.",
  },
  {
    mark: <span data-mark="dot-empty" />,
    term: "Hollow dot (skills)",
    meaning: "Not proficient: the bonus is the ability modifier alone.",
  },
  {
    mark: <span data-mark="use">•</span>,
    term: "Dot after a proficiency",
    meaning: "In use now: equipped or carried.",
  },
  {
    mark: <span data-mark="death-fail" />,
    term: "Red circles by AC",
    meaning: "Death save failures. Three and the character dies.",
  },
  {
    mark: <span data-mark="death-ok" />,
    term: "Green circles by AC",
    meaning: "Death save successes. Three and the character stabilises.",
  },
  {
    mark: <span data-mark="roll">Roll</span>,
    term: "Roll button or a skill row",
    meaning: "Rolls a d20 with the modifier; an attack then rolls damage.",
  },
  { mark: <span data-mark="info">{"ⓘ"}</span>, term: "ⓘ beside a skill", meaning: "Opens that skill's note." },
];

/** A small "?" that opens a list of what the sheet's marks mean. */
export function SheetLegend() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        aria-details="Legend Button"
        aria-label="What do the marks on this sheet mean?"
        onClick={() => setOpen(true)}
      >
        ?
      </button>
      {open &&
        createPortal(
          <dialog aria-details="Sheet Legend" open aria-label="Sheet legend" onClick={() => setOpen(false)}>
            <article onClick={(e) => e.stopPropagation()}>
              <header>
                <h4>What the marks mean</h4>
                <button type="button" aria-label="Close" onClick={() => setOpen(false)}>
                  ✕
                </button>
              </header>
              <dl>
                {ITEMS.map((item) => (
                  <div key={item.term}>
                    <dt aria-hidden="true">{item.mark}</dt>
                    <dd>
                      <b>{item.term}</b>
                      <span>{item.meaning}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          </dialog>,
          document.body
        )}
    </>
  );
}
