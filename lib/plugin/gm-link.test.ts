import { beforeAll, describe, expect, it, vi } from "vitest";
import { GmLinkController } from "./gm-link";

const LINK = "rpg-gm://someone/vault?branch=play&session=game%2Fbinder%2FOne.md&pr=7";

function host(settings: Record<string, unknown>) {
  const commands: Array<{ id: string; checkCallback: (checking: boolean) => boolean | void }> = [];
  const h = {
    app: { vault: { getAbstractFileByPath: () => null } },
    settings: { gmLink: LINK, gmLinkToken: "github_pat_x", gmLinkState: {}, ...settings } as Record<string, unknown>,
    saveSettings: async () => {},
    addCommand: (c: (typeof commands)[number]) => commands.push(c),
    registerInterval: (id: number) => id,
    registerObsidianProtocolHandler: () => {},
  };
  return { h, commands };
}

// The controller's timer is the window's; the tests run in Node.
beforeAll(() => {
  vi.stubGlobal("window", { setInterval: () => 0 });
});

describe("the GM link's switch", () => {
  it("is off by default: no commands, no button in the Log's bar", () => {
    const { h, commands } = host({});
    const gm = new GmLinkController(h as never);
    gm.register();
    expect(gm.enabled()).toBe(false);
    expect(commands.length).toBeGreaterThan(0);
    for (const c of commands) expect(c.checkCallback(true)).toBe(false);
    expect(gm.bar("game/binder/One.md")).toBeUndefined();
  });

  it("turned on, offers its commands and the bar's Hand over for the linked session only", async () => {
    const { h, commands } = host({});
    const gm = new GmLinkController(h as never);
    gm.register();
    await gm.setEnabled(true);
    expect(h.settings.gmLinkEnabled).toBe(true);
    for (const c of commands) expect(c.checkCallback(true)).toBe(true);
    expect(gm.bar("game/binder/One.md")).toMatchObject({ waiting: false });
    expect(gm.bar("game/binder/Two.md")).toBeUndefined();
  });
});
