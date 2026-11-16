/**
 * The GM link in Obsidian: hand the open session over to a Game Master who
 * plays on a branch of a GitHub repository, and take the turn back when it
 * comes. See `lib/domains/gm-link/link.ts` for how a turn travels.
 */

import { type App, Modal, normalizePath, Notice, Setting, TFile } from "obsidian";
import {
  changedSince,
  type GmLink,
  newTokenUrl,
  type LinkState,
  parseGmLink,
  playNotes,
  type TableFile,
} from "lib/domains/gm-link/link";
import { TURN_KINDS } from "lib/domains/gm-link/prefs";
import type { GmLinkBar } from "lib/domains/gm-link/registry";
import { applyTurn, checkTurn, handOver, type VaultPort } from "lib/domains/gm-link/turn";
import { GmPrefsModal } from "lib/plugin/gm-prefs-modal";
import { githubRelay, type Relay } from "lib/services/github-relay";

export interface GmLinkSettings {
  /** The link `rpg table link` prints: repository, branch, session, pull request. */
  gmLink: string;
  /** A GitHub token for that repository. Never copied with the settings. */
  gmLinkToken: string;
  /** What is remembered of each linked session, by its note's path. */
  gmLinkState: Record<string, LinkState>;
  /** Another address for GitHub's API (GitHub Enterprise: `https://host/api/v3`). Empty: github.com. */
  gmLinkApi?: string;
}

export const DEFAULT_GM_LINK: GmLinkSettings = { gmLink: "", gmLinkToken: "", gmLinkState: {} };

interface Host {
  app: App;
  settings: GmLinkSettings;
  saveSettings(): Promise<void>;
  addCommand(command: { id: string; name: string; callback: () => void }): unknown;
  registerInterval(id: number): number;
  registerObsidianProtocolHandler(action: string, handler: (params: Record<string, string>) => void): void;
}

/** What the last test of the connection found. */
export interface LinkTest {
  ok: boolean;
  lines: Array<{ ok: boolean; text: string }>;
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

  /** The last test's findings, until the link or the token changes. */
  tested: LinkTest | null = null;

  async setLink(text: string): Promise<boolean> {
    const clean = text.trim();
    if (clean && !parseGmLink(clean)) return false;
    this.host.settings.gmLink = clean;
    this.tested = null;
    await this.host.saveSettings();
    return true;
  }

  async setToken(text: string): Promise<void> {
    this.host.settings.gmLinkToken = text.trim();
    this.tested = null;
    await this.host.saveSettings();
  }

  hasToken(): boolean {
    return !!this.host.settings.gmLinkToken;
  }

  /** Whether the link, the token and this vault fit together: each finding in words. */
  async test(): Promise<LinkTest> {
    const link = this.link();
    const lines: LinkTest["lines"] = [];
    if (!link || !this.hasToken()) {
      lines.push({ ok: false, text: !link ? "No link yet (step 1)." : "No token yet (step 2)." });
      return (this.tested = { ok: false, lines });
    }
    const here = this.host.app.vault.getAbstractFileByPath(link.session) instanceof TFile;
    lines.push({
      ok: here,
      text: here ? "The session's note is in this vault." : `The session's note is not in this vault: ${link.session}`,
    });
    try {
      const found = await githubRelay(link.repo, link.branch, this.host.settings.gmLinkToken, this.host.settings.gmLinkApi).probe();
      lines.push({ ok: true, text: `The token reaches ${link.repo}.` });
      lines.push({
        ok: found.branch,
        text: found.branch ? `The branch ${link.branch} is there.` : `No branch ${link.branch} in the repository.`,
      });
      if (found.write !== undefined)
        lines.push({
          ok: found.write,
          text: found.write
            ? "The token may write to it."
            : "The token may only read: it needs Contents and Pull requests set to read and write.",
        });
    } catch (e) {
      lines.push({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    return (this.tested = { ok: lines.every((l) => l.ok), lines });
  }

  /** The guided set-up: the steps, each with its button, ticked as they are done. */
  openSetup(): void {
    new SetupModal(this.host.app, this).open();
  }

  /** The link and a relay for it; with something missing, the set-up opens instead. */
  private ready(): { link: GmLink; relay: Relay } | null {
    const link = this.link();
    if (!link || !this.host.settings.gmLinkToken) {
      this.openSetup();
      return null;
    }
    if (!(this.host.app.vault.getAbstractFileByPath(link.session) instanceof TFile)) {
      new Notice(`GM link: the session's note is not in this vault (${link.session}).`);
      return null;
    }
    return { link, relay: githubRelay(link.repo, link.branch, this.host.settings.gmLinkToken, this.host.settings.gmLinkApi) };
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
    new HandOverModal(this.host.app, ready.link, state, (message, kind) => void this.send(message, kind)).open();
  }

  /** How the GM runs the linked session: the dialog that sets it in the session's note. */
  openPrefs(): void {
    const link = this.link();
    const file = link ? this.host.app.vault.getAbstractFileByPath(link.session) : null;
    if (!(file instanceof TFile)) {
      this.openSetup();
      return;
    }
    new GmPrefsModal(this.host.app, file).open();
  }

  private async send(message: string, kind = "play"): Promise<void> {
    const ready = this.ready();
    if (!ready || this.busy) return;
    this.busy = true;
    const working = new Notice("GM link: sending your turn…", 0);
    try {
      const notes = await this.notes(ready.link);
      const done = await handOver(ready.relay, ready.link, this.state(ready.link), notes, message, kind);
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
    return { link, relay: githubRelay(link.repo, link.branch, this.host.settings.gmLinkToken, this.host.settings.gmLinkApi) };
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
    this.host.addCommand({ id: "rpg-ui-gm-setup", name: "GM link: set up", callback: () => this.openSetup() });
    this.host.addCommand({
      id: "rpg-ui-gm-prefs",
      name: "GM link: how the Game Master runs the session",
      callback: () => this.openPrefs(),
    });
    // A link to tap (`obsidian://rpg-gm?link=…`, as `rpg table link` prints it): sets the link and opens the set-up.
    this.host.registerObsidianProtocolHandler("rpg-gm", (params) => {
      void this.setLink(params.link ?? "").then((ok) => {
        if (!ok) new Notice("That is not a GM link.");
        this.openSetup();
      });
    });
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
    private onSend: (message: string, kind: string) => void
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
    let kind = "play";
    new Setting(contentEl).setName("Ask the GM to").addDropdown((d) => {
      for (const k of TURN_KINDS) d.addOption(k.value, k.label);
      d.setValue(kind).onChange((v) => (kind = v));
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
            this.onSend(message.trim(), kind);
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

/** Text from the clipboard, or null where Obsidian may not read it (then the field is typed into). */
async function clipboard(): Promise<string | null> {
  try {
    const text = await navigator.clipboard.readText();
    return text.trim() || null;
  } catch {
    return null;
  }
}

/**
 * The set-up, as steps. Each says what it is for, has the button that does it,
 * and shows a tick once it is done; the next is drawn open.
 */
class SetupModal extends Modal {
  constructor(
    app: App,
    private gm: GmLinkController
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Play with a Game Master elsewhere");
    this.modalEl.addClass("rpg-gm-setup");
    this.draw();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private step(n: number, title: string, done: boolean, about: string): HTMLElement {
    const box = this.contentEl.createDiv({ cls: `rpg-gm-step${done ? " is-done" : ""}` });
    const head = box.createDiv({ cls: "rpg-gm-step-head" });
    head.createSpan({ cls: "rpg-gm-step-mark", text: done ? "✓" : String(n) });
    head.createSpan({ cls: "rpg-gm-step-title", text: title });
    box.createEl("p", { text: about, cls: "rpg-gm-step-about" });
    return box;
  }

  private draw(): void {
    const { contentEl, gm } = this;
    contentEl.empty();
    contentEl.createEl("p", {
      text: "You play here, in your own notes. When you hand over, your turn goes to the Game Master over a branch of the vault's GitHub repository, and their turn comes back into your notes.",
    });
    const link = gm.link();
    const tested = gm.tested;

    // 1. The link
    const one = this.step(
      1,
      "The link from the GM",
      !!link,
      link
        ? `${link.session.split("/").pop()?.replace(/\.md$/, "")}, on ${link.repo} (${link.branch}).`
        : "The GM gives you a link starting rpg-gm://. Copy it, then press Paste. (A link starting obsidian://rpg-gm does this step by itself when tapped.)"
    );
    let typedLink = "";
    new Setting(one)
      .addText((t) => t.setPlaceholder("rpg-gm://…").onChange((v) => (typedLink = v)))
      .addButton((b) =>
        b
          .setButtonText(link ? "Replace" : "Paste")
          .setCta()
          .onClick(async () => {
            const text = typedLink.trim() || (await clipboard());
            if (!text) return void new Notice("Nothing to paste: copy the link first, or type it in the field.");
            if (!(await gm.setLink(text))) return void new Notice("That is not a GM link (it starts rpg-gm://).");
            this.draw();
          })
      );

    // 2. The token
    const two = this.step(
      2,
      "A GitHub token",
      gm.hasToken(),
      gm.hasToken()
        ? "A token is kept on this device (never in a copy of the settings)."
        : "The plugin needs leave to write to that one repository. Create a token on GitHub (the page opens filled in: under Repository access pick Only select repositories and choose the vault, then Generate token), copy it, come back and press Paste."
    );
    let typedToken = "";
    const tokenRow = new Setting(two);
    if (link)
      tokenRow.addButton((b) => b.setButtonText("Create on GitHub").onClick(() => window.open(newTokenUrl(link))));
    tokenRow
      .addText((t) => {
        t.inputEl.type = "password";
        t.setPlaceholder("github_pat_…").onChange((v) => (typedToken = v));
      })
      .addButton((b) =>
        b
          .setButtonText(gm.hasToken() ? "Replace" : "Paste")
          .setCta()
          .onClick(async () => {
            const text = typedToken.trim() || (await clipboard());
            if (!text) return void new Notice("Nothing to paste: copy the token first, or type it in the field.");
            await gm.setToken(text);
            this.draw();
          })
      );

    // 3. The test
    const three = this.step(
      3,
      "Test the connection",
      !!tested?.ok,
      tested
        ? ""
        : "Checks that the token reaches the branch and that the session's note is in this vault. Nothing is written."
    );
    for (const l of tested?.lines ?? [])
      three.createEl("p", { text: `${l.ok ? "✓" : "✗"} ${l.text}`, cls: l.ok ? "rpg-gm-ok" : "mod-warning" });
    new Setting(three).addButton((b) =>
      b
        .setButtonText(tested ? "Test again" : "Test")
        .setCta()
        .setDisabled(!link || !gm.hasToken())
        .onClick(async () => {
          b.setButtonText("Testing…").setDisabled(true);
          await gm.test();
          this.draw();
        })
    );

    // 4. Play
    const state = link ? gm.state(link) : null;
    const four = this.step(
      4,
      "Play, then hand over",
      !!state && (state.waiting || state.rev > 0),
      state?.waiting
        ? "Your turn is with the Game Master. Their turn is looked for while Obsidian is open; a dialog shows it when it comes."
        : "Play your turn in the session's Log as always and save it. Then press Hand over (here, or in the Log's own bar). You can add a line for the GM. When they have played, a dialog shows what they say and writes their changes into your notes."
    );
    new Setting(four)
      .addButton((b) =>
        b
          .setButtonText("How the GM runs it…")
          .setDisabled(!link)
          .onClick(() => {
            this.close();
            gm.openPrefs();
          })
      )
      .addButton((b) =>
        b
          .setButtonText("Open the session")
          .setDisabled(!link)
          .onClick(() => {
            if (link) void this.app.workspace.openLinkText(link.session, "");
            this.close();
          })
      )
      .addButton((b) =>
        b
          .setButtonText(state?.waiting ? "Check for the GM's turn" : "Hand over")
          .setCta()
          .setDisabled(!link || !gm.hasToken())
          .onClick(() => {
            this.close();
            if (state?.waiting) void gm.check();
            else gm.openHandOver();
          })
      );
  }
}
