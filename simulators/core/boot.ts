/** Starts a simulator's page: the Obsidian stand-ins, the vault copy, then the simulator itself. */
import type { App } from "obsidian";
import { KeyValueStore } from "lib/services/kv/kv";
import { installDomHelpers } from "./dom";
import { makeApp } from "./fake-app";
import type { Manifest, Simulator, SimulatorContext, Store } from "./types";

function makeStore(id: string): Store {
  const k = (key: string) => `simulator:${id}:${key}`;
  return {
    get: (key) => {
      try {
        return localStorage.getItem(k(key));
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(k(key), value);
      } catch {
        /* storage blocked: the setting just isn't kept */
      }
    },
  };
}

/** Obsidian's body classes, which its CSS and themes key on: light or dark by the device, mobile on a phone. */
function markAsObsidian(): void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    const forced = document.documentElement.dataset.theme;
    const dark = forced ? forced === "dark" : media.matches;
    document.body.classList.toggle("theme-dark", dark);
    document.body.classList.toggle("theme-light", !dark);
  };
  apply();
  media.addEventListener?.("change", apply);
  const phone = window.matchMedia("(max-width: 600px)").matches;
  document.body.classList.add(
    "obsidian-app",
    "mod-" + (/iPhone|iPad|Mac/.test(navigator.userAgent) ? "macos" : "windows")
  );
  if (phone) document.body.classList.add("is-mobile", "is-phone");
}

export function boot(sim: Simulator, manifest: Manifest): void {
  const start = async () => {
    installDomHelpers();
    markAsObsidian();
    const notes: Record<string, string> = JSON.parse(document.getElementById("vault-data")?.textContent ?? "{}");
    const { app, vault } = makeApp(notes);

    const toast = (message: string) => {
      const host = document.querySelector(".sim-toasts");
      if (!host) return;
      const el = document.createElement("div");
      el.className = "sim-toast";
      el.textContent = message;
      host.appendChild(el);
      window.setTimeout(() => el.remove(), 2500);
    };

    const ctx: SimulatorContext = {
      ...manifest,
      root: document.body,
      app: app as unknown as App,
      vault,
      notes,
      kv: new KeyValueStore({ loadData: async () => ({ state: {} }), saveData: async () => {} }),
      store: makeStore(manifest.id),
      toast,
      async copy(text) {
        try {
          await navigator.clipboard.writeText(text);
          toast("Copied");
        } catch {
          const ta = document.querySelector<HTMLTextAreaElement>("textarea.sim-source");
          if (ta) {
            ta.value = text;
            ta.select();
          }
          toast("Select all and copy");
        }
      },
    };

    try {
      await sim.start(ctx);
      (window as unknown as { __simulatorReady?: boolean }).__simulatorReady = true;
    } catch (e) {
      document.body.innerHTML = `<pre style="padding:16px;white-space:pre-wrap">The simulator did not start.\n\n${String(
        (e as Error)?.stack ?? e
      )}</pre>`;
      throw e;
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void start());
  else void start();
}
