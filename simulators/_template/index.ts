/**
 * A starting point: copy it with `npm run sim:new <id>`, then replace the panel with the piece
 * of the plugin to try. `ctx.app` and `ctx.vault` are the vault copy; `ctx.notes` its notes by
 * path; `ctx.store` keeps settings between visits; `ctx.toast` and `ctx.copy` do what they say.
 */
import { mountShell, samplesList } from "../core/shell";
import { defineSimulator, type Sample } from "../core/types";

const samples: Sample[] = [{ title: "A first sample", about: "What to look for when it loads.", text: "Hello" }];

export default defineSimulator({
  start(ctx) {
    const shell = mountShell(ctx, [
      {
        id: "try",
        label: "Try it",
        note: "Say what this simulator is for.",
        build(el) {
          el.textContent = `${Object.keys(ctx.notes).length} notes are loaded.`;
        },
      },
      {
        id: "samples",
        label: "Samples",
        build(el) {
          samplesList(ctx, el, samples, (s) => {
            ctx.toast(`Loaded “${s.title}”`);
            shell.show("try");
          });
        },
      },
    ]);
  },
});
