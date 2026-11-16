import { describe, expect, it } from "vitest";
import type { Relay } from "lib/services/github-relay";
import {
  accepts,
  changedSince,
  formatGmLink,
  type LinkState,
  parseGmLink,
  parseTable,
  playNotes,
  tablePath,
} from "./link";
import { applyTurn, checkTurn, handOver, type VaultPort } from "./turn";

/** A branch in memory: commits of whole trees, as the relay sees GitHub. */
function fakeRelay(start: Record<string, string>) {
  const commits: Array<Record<string, string>> = [{ ...start }];
  const comments: string[] = [];
  let failNext = 0;
  const relay: Relay = {
    head: async () => String(commits.length - 1),
    commit: async (files, _message, parent) => {
      if (failNext-- > 0 || parent !== String(commits.length - 1)) throw new Error("the branch moved");
      commits.push({ ...commits[commits.length - 1], ...files });
      return String(commits.length - 1);
    },
    read: async (path, ref) =>
      commits[ref === undefined || !/^\d+$/.test(ref) ? commits.length - 1 : Number(ref)][path] ?? null,
    changed: async (base, head) => {
      const a = commits[Number(base)];
      const b = commits[Number(head)];
      return Object.keys({ ...a, ...b })
        .filter((p) => a[p] !== b[p])
        .map((path) => ({ path, removed: b[path] === undefined }));
    },
    comment: async (_pr, body) => void comments.push(body),
  };
  return {
    relay,
    commits,
    comments,
    failOnce: () => (failNext = 1),
    push: (files: Record<string, string>) => commits.push({ ...commits[commits.length - 1], ...files }),
  };
}

function fakeVault(notes: Record<string, string>): VaultPort & { notes: Record<string, string> } {
  return { notes, read: async (p) => notes[p] ?? null, write: async (p, t) => void (notes[p] = t) };
}

const SESSION = "game/binder/One.md";
const LINK = { repo: "someone/vault", branch: "play/one", session: SESSION, pr: 7 };

describe("the link", () => {
  it("is read back as written, and nothing else is a link", () => {
    expect(parseGmLink(formatGmLink(LINK))).toEqual(LINK);
    expect(parseGmLink("rpg-gm://someone/vault?branch=b&session=A%20note.md")).toEqual({
      repo: "someone/vault",
      branch: "b",
      session: "A note.md",
    });
    expect(parseGmLink("https://github.com/someone/vault")).toBeNull();
    expect(parseGmLink("rpg-gm://someone/vault?branch=b")).toBeNull();
    expect(tablePath("x/01. Journey to Wisdom's Path.md")).toBe(".rpg-sessions/01-journey-to-wisdom-s-path/table.json");
    expect(parseTable('{"rev":1,"turn":"player"}')).toEqual({ rev: 1, turn: "player" });
    expect(parseTable('{"rev":1}')).toBeNull();
  });

  it("sends the session, the sheets and the party's folder, and takes back only notes in sight", () => {
    const notes = [
      "game/binder/One.md",
      "game/binder/GM Screen.md",
      "game/party/characters/Ana.md",
      "game/party/items/Rope.md",
      "game/books/Rules.md",
    ];
    expect(playNotes(SESSION, ["game/party/characters/Ana.md"], notes)).toEqual([
      SESSION,
      "game/party/characters/Ana.md",
      "game/party/items/Rope.md",
    ]);
    expect(accepts("game/binder/One.md")).toBe(true);
    expect(accepts("game/binder/.gm/One.md")).toBe(false);
    expect(accepts(".rpg-sessions/one/table.json")).toBe(false);
    expect(accepts(".obsidian/plugins/x/main.js")).toBe(false);
    expect(accepts("../outside.md")).toBe(false);
  });
});

describe("a turn", () => {
  it("goes to the GM in one commit, comes back, and is written into the vault", async () => {
    const hub = fakeRelay({ [SESSION]: "old", "game/party/characters/Ana.md": "Ana" });
    const vault = fakeVault({ [SESSION]: "old\n@(Ana) Climbs", "game/party/characters/Ana.md": "Ana" });
    let state: LinkState = { rev: 0, waiting: false };

    hub.failOnce(); // the branch moves under the first try: the turn is sent again on its new head
    const sent = await handOver(hub.relay, LINK, state, { ...vault.notes }, "Up we go.");
    state = sent.state;
    expect(sent.told).toBe(true);
    expect(hub.comments[0]).toContain("Up we go.");
    expect(hub.commits).toHaveLength(2);
    expect(hub.commits[1][SESSION]).toBe("old\n@(Ana) Climbs");
    expect(parseTable(hub.commits[1][tablePath(SESSION)])).toMatchObject({
      rev: 0,
      turn: "gm",
      message: "Up we go.",
      base: "0",
    });
    expect(state.waiting).toBe(true);
    expect(await checkTurn(hub.relay, LINK, state)).toEqual({ kind: "waiting" });

    // The GM plays: the log, a new note, its hidden notebook, and the turn given back.
    hub.push({
      [SESSION]: "old\n@(Ana) Climbs\n=> The ridge holds.",
      "game/party/items/Horn.md": "A horn.",
      "game/binder/.gm/One.md": "secret prep",
      [tablePath(SESSION)]: JSON.stringify({ rev: 1, turn: "player", gm: "The ridge holds. What now?" }),
    });
    const found = await checkTurn(hub.relay, LINK, state);
    expect(found).toMatchObject({ kind: "turn", files: [SESSION, "game/party/items/Horn.md"] });
    if (found.kind !== "turn") return;
    expect(changedSince(state, vault.notes)).toEqual([]);

    const done = await applyTurn(hub.relay, vault, state, found);
    expect(done.written).toEqual([SESSION, "game/party/items/Horn.md"]);
    expect(vault.notes[SESSION]).toContain("The ridge holds.");
    expect(vault.notes["game/binder/.gm/One.md"]).toBeUndefined();
    expect(done.state).toMatchObject({ rev: 1, waiting: false, gm: "The ridge holds. What now?" });
    expect(await checkTurn(hub.relay, LINK, done.state)).toEqual({ kind: "nothing" });
  });

  it("knows what the player changed after handing over", async () => {
    const hub = fakeRelay({ [SESSION]: "old" });
    const sent = await handOver(
      hub.relay,
      { ...LINK, pr: undefined },
      { rev: 0, waiting: false },
      { [SESSION]: "mine" },
      ""
    );
    expect(sent.told).toBe(false);
    expect(changedSince(sent.state, { [SESSION]: "mine" })).toEqual([]);
    expect(changedSince(sent.state, { [SESSION]: "mine, and more" })).toEqual([SESSION]);
  });
});
