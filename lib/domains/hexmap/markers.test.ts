import { describe, expect, it } from "vitest";
import { markerPathFromName, markSlug } from "./markers";

describe("markers", () => {
  it("names marks the same in every style", () => {
    expect(markSlug("Paw Print Round")).toBe("paw-round");
    expect(markSlug("Tower 2")).toBe("tower-2");
    expect(markSlug("party 1")).toBe("party-1");
  });

  it("sorts an imported pack's names into style/mark", () => {
    expect(markerPathFromName("Pins - Pedestal, gold (tower)")).toBe("pedestal-gold/tower");
    expect(markerPathFromName("Pins - Pedestal, wood")).toBe("pedestal-wood/blank");
    expect(markerPathFromName("Pins - Banner (paw print sharp)")).toBe("signpost/paw-sharp");
    expect(markerPathFromName("Pins - Banner")).toBe("signpost/blank");
    expect(markerPathFromName("Pins - You're Here, red (party 1)")).toBe("here-red/party-1");
    expect(markerPathFromName("Pins - You're Here")).toBe("here/blank");
    expect(markerPathFromName("Pins - Pin, blue (large)")).toBe("pin-large/blue");
    expect(markerPathFromName("Pins - Pin, blue")).toBe("pin/blue");
    expect(markerPathFromName("Pins - Party 2")).toBe("party/2");
    expect(markerPathFromName("Banner 6 (white)")).toBe("flag-6/white");
    expect(markerPathFromName("Icon - Tower 2 (sticker)")).toBe("sticker/tower-2");
    expect(markerPathFromName("Icons - Tent (sticker)")).toBe("sticker/tent");
    expect(markerPathFromName("Icon - Skull")).toBe("icon/skull");
    expect(markerPathFromName("skull")).toBeNull();
  });
});
