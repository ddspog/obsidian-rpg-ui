/**
 * The GM link in Obsidian: hand the open session over to a Game Master who
 * plays on a branch of a GitHub repository, and take the turn back when it
 * comes. See `lib/domains/gm-link/link.ts` for how a turn travels.
 */

import { type App, Modal, normalizePath, Notice, Setting, TFile } from "obsidian";
import {
  changedSince,
  type GmLink,
  type LinkState,
  parseGmLink,
  playNotes,
  type TableFile,
} from "lib/domains/gm-link/link";
import type { GmLinkBar } from "lib/domains/gm-link/registry";
import { applyTurn, checkTurn, handOver, type VaultPort } from "lib/domains/gm-link/turn";
import { githubRelay, type Relay } from "lib/services/github-relay";

export interface GmLinkSettings {
  /** The link `rpg table link` prints: repository, branch, session, pull request. */
  gmLink: string;
  /** A GitHub token for that repository. Never copied with the settings. */
  gmLinkToken: string;
  /** What is remembered of each linked session, by its note's path. */
  gmLinkState: Record<string, LinkState>;
}

export const DEFAULT_GM_LINK: GmLinkSettings = { gmLink: "", gmLinkToken: "", gmLinkState: {} };

interface Host {
  app: App;
  settings: GmLinkSettings;
  saveSettings(): Promise<void>;
  addCommand(command: { id: string; name: string; callback: () => void }): unknown;
  registerInterval(id: number): number;
}

/** How often a turn that is with the GM is looked for, while Obsidian is in front. */
const EVERY_MS = 45_000;

export class GmLinkController {
  private busy = false;
  constructor(private host: Host) {}

  link(): GmLink | null {
    return parseGmLink(this.host.settings.gmLink ?? "");
  }

  state(link: GmLink): LinkState {
    return this.host.settings.gmLinkState?.[link.session] ?? { rev: 0, waiting: false };
  }

  private async keep(link: GmLink, state: LinkState): Promise<void> {
    this.host.settings.gmLinkState = { ...(this.host.settings.gmLinkState ?? {}), [link.session]: state };
    await this.host.saveSettings();
  }

  /** The link and a relay for it, or a notice of what is missing. */
  private ready(): { link: GmLink; relay: Relay } | null {
    const link = this.link();
    if (!link) {
      new Notice("GM link: paste the link the GM gave you in the plugin's settings (General › GM link).");
      return null;
    }
    if (!this.host.settings.gmLinkToken) {
      new Notice("GM link: add a GitHub token for the repository in the plugin's settings.");
      return null;
    }
    if (!(this.host.app.vault.getAbstractFileByPath(link.session) instanceof TFile)) {
      new Notice(`GM link: the session's note is not in this vault (${link.session}).`);
      return null;
    }
    return { link, relay: githubRelay(link.repo, link.branch, this.host.settings.gmLinkToken) };
  }

  private port(): VaultPort {
    const { vault } = this.host.app;
    return {
      read: async (path) => {
        const f = vault.getAbstractFileByPath(path);
        return f instanceof TFile ? vault.read(f) : null;
      },
      write: async (path, text) => {
        const f = vault.getAbstractFileByPath(path);
        if (f instanceof TFile) {
          await vault.modify(f, text);
          return;
        }
        const parts = normalizePath(path).split("/").slice(0, -1);
        for (let i = 1; i <= parts.length; i++) {
          const dir = parts.slice(0, i).join("/");
          if (dir && !vault.getAbstractFileByPath(dir)) await vault.createFolder(dir).catch(() => undefined);
        }
        await vault.create(path, text);
      },
    };
  }

  /** The session's play notes as they are in the vault. */
  private async notes(link: GmLink): Promise<Record<string, string>> {
    const { vault, metadataCache } = this.host.app;
    const session = vault.getAbstractFileByPath(link.session) as TFile;
    const fm = metadataCache.getFileCache(session)?.frontmatter ?? {};
    const pcs = ((Array.isArray(fm.pcs) ? fm.pcs : []) as unknown[])
      .map((p) =>
        metadataCache.getFirstLinkpathDest(
          String(p)
            .replace(/^\[\[|\]\]$/g, "")
            .split("|")[0],
          link.session
        )
      )
      .filter((f): f is TFile => f instanceof TFile)
      .map((f) => f.path);
    const out: Record<string, string> = {};
    for (const path of playNotes(
      link.session,
      pcs,
      vault.getMarkdownFiles().map((f) => f.path)
    )) {
      const f = vault.getAbstractFileByPath(path);
      if (f instanceof TFile) out[path] = await vault.read(f);
    }
    return out;
  }

  /** Ask what to tell the GM, then send the turn. */
  openHandOver(): void {
    const ready = this.ready();
    if (!ready) return;
    const state = this.state(ready.link);
    new HandOverModal(this.host.app, ready.link, state, (message) => void this.send(message)).open();
  }

  private async send(message: string): Promise<void> {
    const ready = this.ready();
    if (!ready || this.busy) return;
    this.busy = true;
    const working = new Notice("GM link: sending your turn…", 0);
    try {
      const notes = await this.notes(ready.link);
      const done = await handOver(ready.relay, ready.link, this.state(ready.link), notes, message);
      await this.keep(ready.link, done.state);
      new Notice(
        done.told
          ? "Your turn is with the Game Master."
          : ready.link.pr
            ? `Your turn is saved, but the GM could not be told (${done.toldError ?? "unknown"}). Tell them yourself.`
            : "Your turn is saved on the branch. Tell the GM it is in.",
        8000
      );
    } catch (e) {
      new Notice(`GM link: ${e instanceof Error ? e.message : String(e)}`, 12000);
    } finally {
      working.hide();
      this.busy = false;
    }
  }

  /** Look for the GM's turn; when it has come, show it and offer to write it. */
  async check(quiet = false): Promise<void> {
    const ready = quiet ? this.quietReady() : this.ready();
    if (!ready || this.busy) return;
    this.busy = true;
    try {
      const state = this.state(ready.link);
      const found = await checkTurn(ready.relay, ready.link, state);
      if (found.kind !== "turn") {
        if (!quiet)
          new Notice(found.kind === "waiting" ? "The Game Master is still playing." : "Nothing new from the GM.");
        return;
      }
      const mine = changedSince(state, await this.notes(ready.link)).filter((p) => found.files.includes(p));
      new TurnModal(this.host.app, found.table, found.files, mine, async () => {
        try {
          const done = await applyTurn(ready.relay, this.port(), state, found);
          await this.keep(ready.link, done.state);
          new Notice(`The GM's turn is in your notes (${done.written.length} changed). Your move.`, 8000);
        } catch (e) {
          new Notice(`GM link: ${e instanceof Error ? e.message : String(e)}`, 12000);
        }
      }).open();
    } catch (e) {
      if (!quiet) new Notice(`GM link: ${e instanceof Error ? e.message : String(e)}`, 12000);
    } finally {
      this.busy = false;
    }
  }

  private quietReady(): { link: GmLink; relay: Relay } | null {
    const link = this.link();
    if (!link || !this.host.settings.gmLinkToken) return null;
    return { link, relay: githubRelay(link.repo, link.branch, this.host.settings.gmLinkToken) };
  }

  /** Stop waiting: the notes are the player's again (the GM's turn, if it comes, is still offered). */
  async takeBack(): Promise<void> {
    const link = this.link();
    if (!link) return;
    await this.keep(link, { ...this.state(link), waiting: false });
    new Notice("The turn is yours again. If the GM's turn arrives, you will be asked before it is written.");
  }

  /** One line for the settings tab: where the linked session stands. */
  describe(): string {
    const link = this.link();
    if (!this.host.settings.gmLink) return "Not linked.";
    if (!link) return "That is not a GM link (it starts rpg-gm://).";
    const s = this.state(link);
    const name = link.session.split("/").pop()?.replace(/\.md$/, "");
    return `${name} on ${link.repo} (${link.branch})${link.pr ? `, PR #${link.pr}` : ""}: ${s.waiting ? "with the GM" : "your turn"}, rev ${s.rev}.`;
  }

  /** For the Log of the linked session: whose turn it is, and the two moves. */
  bar(path: string): GmLinkBar | undefined {
    const link = this.link();
    if (!link || link.session !== path) return undefined;
    return {
      waiting: this.state(link).waiting,
      onHandOver: () => this.openHandOver(),
      onCheck: () => void this.check(),
    };
  }

  register(): void {
    this.host.addCommand({
      id: "rpg-ui-gm-hand-over",
      name: "GM link: hand over to the Game Master",
      callback: () => this.openHandOver(),
    });
    this.host.addCommand({
      id: "rpg-ui-gm-check",
      name: "GM link: check for the GM's turn",
      callback: () => void this.check(),
    });
    this.host.addCommand({
      id: "rpg-ui-gm-take-back",
      name: "GM link: take the turn back",
      callback: () => void this.takeBack(),
    });
    // While a turn is out, look for its answer, but only with Obsidian in front and no dialog open.
    this.host.registerInterval(
      window.setInterval(() => {
        const link = this.link();
        if (!link || !this.state(link).waiting || document.hidden || document.querySelector(".modal-container")) return;
        void this.check(true);
      }, EVERY_MS)
    );
  }
}

class HandOverModal extends Modal {
  constructor(
    app: App,
    private link: GmLink,
    private state: LinkState,
    private onSend: (message: string) => void
  ) {
    super(app);
  }
  onOpen(): void {
    const { contentEl } = this;
    this.titleEl.setText("Hand over to the Game Master");
    contentEl.createEl("p", {
      text: `${this.link.session.split("/").pop()?.replace(/\.md$/, "")}: the session's note and the party's sheets go to the GM as they are now. Save the Log's pending edits first.`,
    });
    if (this.state.waiting)
      contentEl.createEl("p", {
        text: "A turn is already with the GM: sending again replaces it.",
        cls: "mod-warning",
      });
    let message = "";
    const area = contentEl.createEl("textarea", {
      attr: { rows: "4", placeholder: "Anything to tell the GM: what the party means to do, a question." },
    });
    area.style.width = "100%";
    area.addEventListener("input", () => (message = area.value));
    new Setting(contentEl)
      .addButton((b) => b.setButtonText("Not yet").onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText("Send my turn")
          .setCta()
          .onClick(() => {
            this.close();
            this.onSend(message.trim());
          })
      );
  }
  onClose(): void {
    this.contentEl.empty();
  }
}

class TurnModal extends Modal {
  constructor(
    app: App,
    private table: TableFile,
    private files: string[],
    private mine: string[],
    private onApply: () => Promise<void>
  ) {
    super(app);
  }
  onOpen(): void {
    const { contentEl } = this;
    this.titleEl.setText("The Game Master has played");
    if (this.table.gm) for (const para of this.table.gm.split(/\n{2,}/)) contentEl.createEl("p", { text: para });
    const names = this.files.map((f) => f.split("/").pop()?.replace(/\.md$/, "") ?? f);
    contentEl.createEl("p", {
      text: names.length ? `Notes the GM changed: ${names.join(", ")}.` : "The GM changed no note.",
      cls: "setting-item-description",
    });
    if (this.mine.length)
      contentEl.createEl("p", {
        text: `You changed ${this.mine.map((f) => f.split("/").pop()?.replace(/\.md$/, "")).join(", ")} since you handed over: writing the GM's turn replaces those changes.`,
        cls: "mod-warning",
      });
    new Setting(contentEl)
      .addButton((b) => b.setButtonText("Not now").onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText(this.mine.length ? "Replace with the GM's turn" : "Write it to my notes")
          .setCta()
          .onClick(() => {
            this.close();
            void this.onApply();
          })
      );
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
