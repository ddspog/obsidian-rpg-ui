/**
 * The GM link in Obsidian: hand the open session over to a Game Master who
 * plays on a branch of a GitHub repository, and take the turn back when it
 * comes. See `lib/domains/gm-link/link.ts` for how a turn travels.
 */

import { type App, Component, MarkdownRenderer, Modal, normalizePath, Notice, Setting, TFile } from "obsidian";
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
import { githubRelay, type Relay, RelayError } from "lib/services/github-relay";

export interface GmLinkSettings {
  /** The GM link is on. Off by default: no commands, no bar button, no checks, until turned on in settings. */
  gmLinkEnabled?: boolean;
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
  addCommand(command: { id: string; name: string; checkCallback: (checking: boolean) => boolean | void }): unknown;
  registerInterval(id: number): number;
  registerObsidianProtocolHandler(action: string, handler: (params: Record<string, string>) => void): void;
}

/** What the last test of the connection found. */
export interface LinkTest {
  ok: boolean;
  lines: Array<{ ok: boolean; text: string }>;
  /** What GitHub made of the token: accepted, refused (401/403/404), or not known (no answer). */
  token: "ok" | "refused" | "unknown";
}

/** How a send or a check went wrong, in words for the player and the raw cause apart. */
export interface Failure {
  message: string;
  detail?: string;
}

const failure = (e: unknown): Failure =>
  e instanceof RelayError
    ? { message: e.message, ...(e.detail ? { detail: e.detail } : {}) }
    : { message: "Something went wrong.", detail: e instanceof Error ? e.message : String(e) };

/** A GitHub token, by its prefix (fine-grained, classic, OAuth, app). */
const TOKEN = /^(github_pat_|ghp_|gho_|ghu_|ghs_)[A-Za-z0-9_]+$/;

const SHORT = 4000;

/** How often a turn that is with the GM is looked for, while Obsidian is in front. */
const EVERY_MS = 45_000;

export class GmLinkController {
  private busy = false;
  /** "Not now" on the GM's turn: no more checks by themselves until the player checks or hands over. */
  private snoozed = false;
  constructor(private host: Host) {}

  /** Whether the GM link is turned on (Settings › General › GM link). */
  enabled(): boolean {
    return this.host.settings.gmLinkEnabled === true;
  }

  async setEnabled(on: boolean): Promise<void> {
    this.host.settings.gmLinkEnabled = on;
    await this.host.saveSettings();
  }

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

  /** Keeps a token that looks like one; false (nothing kept) for anything else. */
  async setToken(text: string): Promise<boolean> {
    const clean = text.trim();
    if (clean && !TOKEN.test(clean)) return false;
    this.host.settings.gmLinkToken = clean;
    this.tested = null;
    await this.host.saveSettings();
    return true;
  }

  /** Forgets the link, the token and what was remembered of the session. */
  async unlink(): Promise<void> {
    this.host.settings.gmLink = "";
    this.host.settings.gmLinkToken = "";
    this.host.settings.gmLinkState = {};
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
      return (this.tested = { ok: false, lines, token: "unknown" });
    }
    let token: LinkTest["token"] = "unknown";
    const here = this.host.app.vault.getAbstractFileByPath(link.session) instanceof TFile;
    lines.push({
      ok: here,
      text: here ? "The session's note is in this vault." : `The session's note is not in this vault: ${link.session}`,
    });
    try {
      const found = await githubRelay(
        link.repo,
        link.branch,
        this.host.settings.gmLinkToken,
        this.host.settings.gmLinkApi
      ).probe();
      token = "ok";
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
      const status = e instanceof RelayError ? e.status : 0;
      if (status === 401 || status === 403 || status === 404) token = "refused";
      lines.push({ ok: false, text: `${failure(e).message}${status ? ` (${status})` : ""}` });
    }
    return (this.tested = { ok: lines.every((l) => l.ok), lines, token });
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
      new Notice(`The session's note is not in this vault: ${link.session}`);
      return null;
    }
    return {
      link,
      relay: githubRelay(link.repo, link.branch, this.host.settings.gmLinkToken, this.host.settings.gmLinkApi),
    };
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

  /**
   * Ask what to tell the GM, then send the turn. `save`: the Log has unsaved edits, and this
   * saves them; they are saved before the turn goes.
   */
  openHandOver(save?: () => void | Promise<void>): void {
    const ready = this.ready();
    if (!ready) return;
    const state = this.state(ready.link);
    new HandOverModal(this.host.app, ready.link, state, !!save, async (message, kind) => {
      if (save) await save();
      return this.send(message, kind);
    }).open();
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

  /** The turn sent: null when it went, else what went wrong (the dialog shows it and stays open). */
  private async send(message: string, kind = "play"): Promise<Failure | null> {
    const ready = this.ready();
    if (!ready) return { message: "The GM link is not set up." };
    if (this.busy) return { message: "Something else is talking to GitHub. Try again in a moment." };
    this.busy = true;
    try {
      const notes = await this.notes(ready.link);
      const done = await handOver(ready.relay, ready.link, this.state(ready.link), notes, message, kind);
      this.snoozed = false;
      await this.keep(ready.link, done.state);
      new Notice(
        done.told
          ? "Your turn is with the GM."
          : ready.link.pr
            ? "Your turn is saved, but the GM could not be told. Tell them it is in."
            : "Your turn is saved. Tell the GM it is in.",
        SHORT
      );
      return null;
    } catch (e) {
      return failure(e);
    } finally {
      this.busy = false;
    }
  }

  /** Look for the GM's turn; when it has come, show it and offer to write it. */
  async check(quiet = false): Promise<void> {
    if (quiet && this.snoozed) return;
    if (!quiet) this.snoozed = false;
    const ready = quiet ? this.quietReady() : this.ready();
    if (!ready || this.busy) return;
    this.busy = true;
    try {
      const state = this.state(ready.link);
      const found = await checkTurn(ready.relay, ready.link, state);
      if (found.kind !== "turn") {
        if (!quiet)
          new Notice(found.kind === "waiting" ? "The GM is still playing." : "Nothing new from the GM.", SHORT);
        return;
      }
      const mine = changedSince(state, await this.notes(ready.link)).filter((p) => found.files.includes(p));
      new TurnModal(
        this.host.app,
        ready.link.session,
        found.table,
        found.files,
        mine,
        async () => {
          try {
            const done = await applyTurn(ready.relay, this.port(), state, found);
            await this.keep(ready.link, done.state);
            const n = done.written.length;
            new Notice(`The GM's turn is in your notes (${n} note${n === 1 ? "" : "s"} changed). Your move.`, SHORT);
          } catch (e) {
            const f = failure(e);
            new Notice(`The GM's turn was not written: ${f.message}`, 10000);
          }
        },
        () => (this.snoozed = true)
      ).open();
    } catch (e) {
      if (!quiet) new Notice(failure(e).message, 10000);
    } finally {
      this.busy = false;
    }
  }

  private quietReady(): { link: GmLink; relay: Relay } | null {
    const link = this.link();
    if (!link || !this.host.settings.gmLinkToken) return null;
    return {
      link,
      relay: githubRelay(link.repo, link.branch, this.host.settings.gmLinkToken, this.host.settings.gmLinkApi),
    };
  }

  /** Stop waiting: the notes are the player's again (the GM's turn, if it comes, is still offered). */
  async takeBack(): Promise<void> {
    const link = this.link();
    if (!link) return;
    await this.keep(link, { ...this.state(link), waiting: false });
    new Notice("The turn is yours again. If the GM's turn arrives, you are asked before it is written.");
  }

  /** For the settings tab: whose turn it is first, then which session and where. */
  describe(): { status: string; detail: string; linked: boolean; waiting: boolean } {
    const link = this.link();
    if (!this.host.settings.gmLink) return { status: "Not linked.", detail: "", linked: false, waiting: false };
    if (!link)
      return { status: "That is not a GM link (it starts rpg-gm://).", detail: "", linked: false, waiting: false };
    const s = this.state(link);
    const name = link.session.split("/").pop()?.replace(/\.md$/, "");
    return {
      status: `${s.waiting ? "With the GM." : "Your turn."} ${name}, with ${link.repo}.`,
      detail: `Branch ${link.branch}${link.pr ? `, pull request #${link.pr}` : ""}.`,
      linked: true,
      waiting: s.waiting,
    };
  }

  /** For the Log of the linked session: whose turn it is, and the two moves. */
  bar(path: string): GmLinkBar | undefined {
    if (!this.enabled()) return undefined;
    const link = this.link();
    if (!link || link.session !== path) return undefined;
    return {
      waiting: this.state(link).waiting,
      onHandOver: (save) => this.openHandOver(save),
      onCheck: () => void this.check(),
    };
  }

  /** A command that is there only while the GM link is on. */
  private gate(checking: boolean, run: () => void): boolean {
    if (!this.enabled()) return false;
    if (!checking) run();
    return true;
  }

  register(): void {
    this.host.addCommand({
      id: "rpg-ui-gm-setup",
      name: "GM link: set up",
      checkCallback: (checking) => this.gate(checking, () => this.openSetup()),
    });
    this.host.addCommand({
      id: "rpg-ui-gm-prefs",
      name: "GM link: how the GM runs the session",
      checkCallback: (checking) => this.gate(checking, () => this.openPrefs()),
    });
    // A link to tap (`obsidian://rpg-gm?link=…`, as `rpg table link` prints it): sets the link and opens the set-up.
    this.host.registerObsidianProtocolHandler("rpg-gm", (params) => {
      void this.setLink(params.link ?? "").then((ok) => {
        if (!ok) return void new Notice("That is not a GM link (it starts rpg-gm://).");
        if (!this.enabled())
          return void new Notice(
            "The link is kept, but the GM link is off: turn it on in Settings › General › GM link, then open the set-up.",
            10000
          );
        this.openSetup();
      });
    });
    this.host.addCommand({
      id: "rpg-ui-gm-hand-over",
      name: "GM link: hand over to the GM",
      checkCallback: (checking) => this.gate(checking, () => this.openHandOver()),
    });
    this.host.addCommand({
      id: "rpg-ui-gm-check",
      name: "GM link: check for the GM's turn",
      checkCallback: (checking) => this.gate(checking, () => void this.check()),
    });
    this.host.addCommand({
      id: "rpg-ui-gm-take-back",
      name: "GM link: take the turn back",
      checkCallback: (checking) => this.gate(checking, () => void this.takeBack()),
    });
    // While a turn is out, look for its answer, but only with Obsidian in front and no dialog open.
    this.host.registerInterval(
      window.setInterval(() => {
        const link = this.link();
        if (!this.enabled()) return;
        if (!link || !this.state(link).waiting || document.hidden || document.querySelector(".modal-container")) return;
        void this.check(true);
      }, EVERY_MS)
    );
  }
}

class HandOverModal extends Modal {
  private sending = false;

  constructor(
    app: App,
    private link: GmLink,
    private state: LinkState,
    private saveFirst: boolean,
    private onSend: (message: string, kind: string) => Promise<Failure | null>
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    this.titleEl.setText("Hand over to the GM");
    this.modalEl.addClass("rpg-gm-handover");
    const name = this.link.session.split("/").pop()?.replace(/\.md$/, "");
    contentEl.createEl("p", {
      text: `${name}: the session's note and the party's sheets go to the Game Master as they are now.`,
    });
    if (this.saveFirst)
      contentEl.createEl("p", { text: "The Log has unsaved edits: they are saved first.", cls: "rpg-gm-note" });
    if (this.state.waiting)
      contentEl.createEl("p", {
        text: "A turn is already with the GM: sending again replaces it.",
        cls: "rpg-gm-note",
      });
    let kind = "play";
    new Setting(contentEl).setName("Ask the GM to").addDropdown((d) => {
      for (const k of TURN_KINDS) d.addOption(k.value, k.label);
      d.setValue(kind).onChange((v) => (kind = v));
    });
    const label = contentEl.createEl("label", {
      text: "Tell the GM",
      cls: "rpg-gm-label",
      attr: { for: "rpg-gm-say" },
    });
    label.createSpan({ text: " (optional)", cls: "rpg-gm-optional" });
    const area = contentEl.createEl("textarea", {
      cls: "rpg-gm-say",
      attr: { id: "rpg-gm-say", rows: "4", placeholder: "What the party means to do, a question." },
    });
    const error = contentEl.createDiv({ cls: "rpg-gm-error", attr: { role: "alert" } });
    error.hide();
    let send: { setButtonText(t: string): unknown; setDisabled(d: boolean): unknown } | null = null;
    const label0 = this.saveFirst ? "Save and send my turn" : "Send my turn";
    new Setting(contentEl)
      .addButton((b) => b.setButtonText("Not yet").onClick(() => this.close()))
      .addButton((b) => {
        send = b;
        b.setButtonText(label0)
          .setCta()
          .onClick(async () => {
            if (this.sending) return;
            this.sending = true;
            b.setButtonText("Sending…").setDisabled(true);
            error.hide();
            const failed = await this.onSend(area.value.trim(), kind);
            this.sending = false;
            if (!failed) return this.close();
            error.empty();
            error.createEl("p", { text: `Your turn was not sent. ${failed.message}` });
            if (failed.detail) error.createEl("p", { text: failed.detail, cls: "rpg-gm-detail" });
            error.show();
            send?.setButtonText("Try again");
            send?.setDisabled(false);
          });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class TurnModal extends Modal {
  private component = new Component();

  constructor(
    app: App,
    private session: string,
    private table: TableFile,
    private files: string[],
    private mine: string[],
    private onApply: () => Promise<void>,
    private onLater: () => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    this.titleEl.setText("The GM has played");
    this.modalEl.addClass("rpg-gm-turn");
    this.component.load();
    // What the GM says is the game itself: set as the journal is, links and emphasis drawn.
    if (this.table.gm) {
      const words = contentEl.createDiv({ cls: "rpg-gm-turn-text markdown-rendered" });
      void MarkdownRenderer.render(this.app, this.table.gm, words, this.session, this.component);
    }
    const names = this.files.map((f) => f.split("/").pop()?.replace(/\.md$/, "") ?? f);
    contentEl.createEl("p", {
      text: names.length ? `Notes the GM changed: ${names.join(", ")}.` : "The GM changed no note.",
      cls: "rpg-gm-turn-files",
    });
    if (this.mine.length)
      contentEl.createEl("p", {
        text: `You changed ${this.mine.map((f) => f.split("/").pop()?.replace(/\.md$/, "")).join(", ")} since you handed over: writing the GM's turn replaces those changes.`,
        cls: "rpg-gm-note",
      });
    new Setting(contentEl)
      .addButton((b) =>
        b.setButtonText("Not now").onClick(() => {
          this.onLater();
          this.close();
        })
      )
      .addButton((b) =>
        b
          .setButtonText(this.mine.length ? "Replace with the GM's turn" : "Write it to my notes")
          .setCta()
          .onClick(() => {
            this.close();
            void this.onApply();
          })
      );
    contentEl.createEl("p", {
      text: "Not now keeps it waiting: press Check for GM in the Log's bar to read it again.",
      cls: "rpg-gm-hint",
    });
  }

  onClose(): void {
    this.component.unload();
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

const NO_CLIPBOARD =
  "Obsidian could not read the clipboard here: paste into the field (long-press on a phone), then press Save.";

type Step = { n: number; title: string; state: "todo" | "done" | "error"; summary: string; about: string };

/**
 * The set-up, as steps. The first one not done is open and holds the one primary button; a step
 * done folds to a line, with Change to open it again.
 */
class SetupModal extends Modal {
  /** Steps opened again with Change. */
  private opened = new Set<number>();

  constructor(
    app: App,
    private gm: GmLinkController
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Set up the GM link");
    this.modalEl.addClass("rpg-gm-setup");
    this.draw();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private box(step: Step, first: boolean): { body: HTMLElement; folded: boolean } {
    const box = this.contentEl.createDiv({ cls: `rpg-gm-step is-${step.state}${first ? " is-current" : ""}` });
    const head = box.createDiv({ cls: "rpg-gm-step-head" });
    head.createSpan({
      cls: "rpg-gm-step-mark",
      text: step.state === "done" ? "✓" : step.state === "error" ? "!" : String(step.n),
      attr: { "aria-hidden": "true" },
    });
    head.createSpan({ cls: "rpg-gm-step-title", text: step.title });
    head.createSpan({
      cls: "rpg-gm-step-state",
      text: step.state === "done" ? "Done" : step.state === "error" ? "Needs attention" : first ? "Next" : "",
    });
    const folded = step.state === "done" && step.n < 4 && !this.opened.has(step.n);
    if (folded) {
      const line = box.createDiv({ cls: "rpg-gm-step-folded" });
      line.createSpan({ text: step.summary, cls: "rpg-gm-step-summary" });
      const change = line.createEl("button", { text: "Change", cls: "rpg-gm-change" });
      change.addEventListener("click", () => {
        this.opened.add(step.n);
        this.draw();
      });
    } else box.createEl("p", { text: step.about, cls: "rpg-gm-step-about" });
    return { body: box, folded };
  }

  private draw(): void {
    const { contentEl, gm } = this;
    contentEl.empty();
    contentEl.createEl("p", {
      text: "You play here, in your own notes. When you hand over, your turn goes to the Game Master over a branch of the vault's GitHub repository, and their turn comes back into your notes.",
      cls: "rpg-gm-lede",
    });
    const link = gm.link();
    const tested = gm.tested;
    const tokenRefused = tested?.token === "refused";
    const tokenOk = gm.hasToken() && tested?.token === "ok";
    const state = link ? gm.state(link) : null;

    const steps: Step[] = [
      {
        n: 1,
        title: "The link from the GM",
        state: link ? "done" : "todo",
        summary: link ? `${link.session.split("/").pop()?.replace(/\.md$/, "")}, with ${link.repo}` : "",
        about: link
          ? `${link.session.split("/").pop()?.replace(/\.md$/, "")}, with ${link.repo} (branch ${link.branch}).`
          : "The GM gives you a link starting rpg-gm://. Copy it, then press Paste. A link starting obsidian://rpg-gm does this step by itself when tapped.",
      },
      {
        n: 2,
        title: "A GitHub token",
        state: tokenRefused ? "error" : tokenOk ? "done" : "todo",
        summary: "Accepted by GitHub. Kept on this device only.",
        about: tokenRefused
          ? "GitHub did not accept this token. Create a new one and paste it."
          : gm.hasToken()
            ? "Pasted, not tested yet: test it in step 3. Kept on this device only, never in a copy of the settings."
            : !link
              ? "Paste the GM's link first (step 1)."
              : "The plugin needs permission to write to that one repository. Create on GitHub opens the page filled in: under Repository access pick Only select repositories and choose the vault, then Generate token. Copy it, come back and press Paste.",
      },
      {
        n: 3,
        title: "Test the connection",
        state: tested?.ok ? "done" : tested && !tested.ok ? "error" : "todo",
        summary: "GitHub answers, the branch is there, the token may write.",
        about: tested
          ? ""
          : "Checks that the token reaches the branch and that the session's note is in this vault. Nothing is written.",
      },
      {
        n: 4,
        title: "Play, then hand over",
        state: state && (state.waiting || state.rev > 0) ? "done" : "todo",
        summary: "",
        about: state?.waiting
          ? "Your turn is with the GM. Their turn is looked for while Obsidian is open, and a dialog shows it when it comes."
          : "Play your turn in the session's Log as always, then press Hand over (here, or in the Log's own bar). When the GM has played, a dialog shows what they say and writes their changes into your notes.",
      },
    ];
    const current = (steps.find((s) => s.state !== "done") ?? steps[3]).n;

    // 1. The link
    const one = this.box(steps[0], current === 1);
    if (!one.folded) {
      let typed = "";
      new Setting(one.body)
        .addText((t) => {
          t.setPlaceholder("rpg-gm://…").onChange((v) => (typed = v));
          t.inputEl.setAttr("aria-label", "The link from the GM");
        })
        .addButton((b) => {
          b.setButtonText(typed ? "Save" : "Paste").onClick(async () => {
            const text = typed.trim() || (await clipboard());
            if (!text) return void new Notice(NO_CLIPBOARD, 8000);
            if (!(await gm.setLink(text))) return void new Notice("That is not a GM link (it starts rpg-gm://).");
            this.opened.delete(1);
            this.draw();
          });
          if (current === 1) b.setCta();
        });
    }

    // 2. The token
    const two = this.box(steps[1], current === 2);
    if (!two.folded) {
      let typed = "";
      new Setting(two.body)
        .addButton((b) => {
          b.setButtonText("Create on GitHub")
            .setDisabled(!link)
            .onClick(() => link && window.open(newTokenUrl(link)));
          if (current === 2 && !gm.hasToken() && link) b.setCta();
        })
        .addText((t) => {
          t.inputEl.type = "password";
          t.inputEl.setAttr("aria-label", "GitHub token");
          t.setPlaceholder("github_pat_…").onChange((v) => (typed = v));
          t.setDisabled(!link);
        })
        .addButton((b) => {
          b.setButtonText("Paste")
            .setDisabled(!link)
            .onClick(async () => {
              const text = typed.trim() || (await clipboard());
              if (!text) return void new Notice(NO_CLIPBOARD, 8000);
              if (!(await gm.setToken(text)))
                return void new Notice("That does not look like a GitHub token (they start github_pat_).", 8000);
              this.opened.delete(2);
              this.draw();
            });
          if (current === 2 && (gm.hasToken() || tokenRefused)) b.setCta();
        });
    }

    // 3. The test
    const three = this.box(steps[2], current === 3);
    if (!three.folded) {
      for (const l of tested?.lines ?? [])
        three.body.createEl("p", { text: `${l.ok ? "✓" : "✗"} ${l.text}`, cls: l.ok ? "rpg-gm-ok" : "rpg-gm-bad" });
      new Setting(three.body).addButton((b) => {
        b.setButtonText(tested ? "Test again" : "Test")
          .setDisabled(!link || !gm.hasToken())
          .onClick(async () => {
            b.setButtonText("Testing…").setDisabled(true);
            await gm.test();
            this.opened.delete(3);
            this.draw();
          });
        if (current === 3) b.setCta();
      });
    }

    // 4. Play
    const four = this.box(steps[3], current === 4);
    new Setting(four.body)
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
      .addButton((b) => {
        b.setButtonText(state?.waiting ? "Check for GM" : "Hand over")
          .setDisabled(!link || !gm.hasToken())
          .onClick(() => {
            this.close();
            if (state?.waiting) void gm.check();
            else gm.openHandOver();
          });
        if (current === 4) b.setCta();
      });
  }
}
