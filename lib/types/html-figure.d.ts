// Provide a minimal declaration for HTMLFigureElement for TS libs that
// don't include it (older TS lib.dom versions). This enables
// React.HTMLAttributes<HTMLFigureElement> to be used safely.

declare global {
  interface HTMLFigureElement extends HTMLElement {}
}

export {};
