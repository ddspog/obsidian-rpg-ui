// Provide a minimal declaration for HTMLFigureElement for TS libs that
// don't include it (older TS lib.dom versions). This enables
// React.HTMLAttributes<HTMLFigureElement> to be used safely.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- global interface merge
  interface HTMLFigureElement extends HTMLElement {}
}

export {};
