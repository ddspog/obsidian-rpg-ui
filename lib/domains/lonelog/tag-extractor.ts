import type { PersistentTag, InventoryTag, WealthTag, RoomTag } from "./types";

/** Extract all persistent tags from a text string */
export function extractTags(text: string): PersistentTag[] {
  const tags: PersistentTag[] = [];
  const tagRegex = /\[(?:#)?(N|L|E|Clock|Track|Timer|Thread|PC|F|Faction|Party|Inv|Wealth|R):([^\]]+)\]/g;

  let match;
  while ((match = tagRegex.exec(text)) !== null) {
    const isRef = text[match.index + 1] === "#";
    const kind = match[1];
    const content = match[2];

    switch (kind) {
      case "N": {
        const parts = content.split("|").map((s) => s.trim());
        const name = parts[0];
        const tagList = parts.slice(1).filter(Boolean);
        tags.push({ kind: "npc", name, tags: tagList, ref: isRef });
        break;
      }
      case "L": {
        const parts = content.split("|").map((s) => s.trim());
        const name = parts[0];
        const tagList = parts.slice(1).filter(Boolean);
        tags.push({ kind: "location", name, tags: tagList });
        break;
      }
      case "E": {
        const m = content.match(/^(.+?)\s+(\d+)\/(\d+)$/);
        if (m) tags.push({ kind: "event", name: m[1].trim(), current: parseInt(m[2], 10), max: parseInt(m[3], 10) });
        break;
      }
      case "Clock": {
        const m = content.match(/^(.+?)\s+(\d+)\/(\d+)$/);
        if (m) {
          tags.push({ kind: "clock", name: m[1].trim(), current: parseInt(m[2], 10), max: parseInt(m[3], 10) });
        } else {
          const alt = content.match(/^(\d+)\/(\d+)$/);
          if (alt)
            tags.push({ kind: "clock", name: "Clock", current: parseInt(alt[1], 10), max: parseInt(alt[2], 10) });
        }
        break;
      }
      case "Track": {
        const m = content.match(/^(.+?)\s+(\d+)\/(\d+)$/);
        if (m) tags.push({ kind: "track", name: m[1].trim(), current: parseInt(m[2], 10), max: parseInt(m[3], 10) });
        break;
      }
      case "Timer": {
        const m = content.match(/^(.+?)\s+(\d+)$/);
        if (m) {
          tags.push({ kind: "timer", name: m[1].trim(), value: parseInt(m[2], 10) });
        } else {
          const num = content.match(/^(\d+)$/);
          if (num) tags.push({ kind: "timer", name: "Timer", value: parseInt(num[1], 10) });
        }
        break;
      }
      case "Thread":
        tags.push({ kind: "thread", name: content.split("|")[0].trim(), state: content.split("|")[1]?.trim() || "Open" });
        break;
      case "PC": {
        const parts = content.split("|").map((s) => s.trim());
        const name = parts[0];
        const changes = parts.slice(1).filter(Boolean);
        tags.push({ kind: "pc", name, changes });
        break;
      }
      case "F": {
        const parts = content.split("|").map((s) => s.trim());
        const name = parts[0];
        const tagList = parts.slice(1).filter(Boolean);
        tags.push({ kind: "foe", name, tags: tagList });
        break;
      }
      case "Inv": {
        tags.push(parseInventoryTag(content, isRef));
        break;
      }
      case "R": {
        tags.push(parseRoomTag(content, isRef));
        break;
      }
      case "Wealth": {
        tags.push(...parseWealthTag(content));
        break;
      }
      case "Faction":
      case "Party":
        break;
    }
  }

  return tags;
}

function parseInventoryTag(content: string, isRef: boolean): InventoryTag {
  const tag: InventoryTag = { kind: "inventory", name: "", ref: isRef, props: [] };

  // Check for delta shorthand: [Inv:Item+N] or [Inv:Item-N]
  const deltaMatch = content.match(/^(.+?)([+-])(\d+)$/);
  if (deltaMatch) {
    tag.name = deltaMatch[1].trim();
    tag.delta = parseInt(deltaMatch[3], 10) * (deltaMatch[2] === "-" ? -1 : 1);
    return tag;
  }

  const parts = content.split("|").map((s) => s.trim());
  tag.name = parts[0];

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];

    // Quantity transition: 3→2 or 3->2
    const transMatch = part.match(/^(\d+)\s*(?:→|->)\s*(\d+)$/);
    if (transMatch) {
      tag.transition = { from: parseInt(transMatch[1], 10), to: parseInt(transMatch[2], 10) };
      continue;
    }

    // Plain quantity
    if (/^\d+$/.test(part)) {
      tag.quantity = parseInt(part, 10);
      continue;
    }

    // Depleted marker
    if (part.toLowerCase() === "depleted") {
      tag.depleted = true;
      continue;
    }

    // Everything else is a property
    tag.props.push(part);
  }

  return tag;
}

function parseWealthTag(content: string): WealthTag[] {
  const tags: WealthTag[] = [];
  const entries = content.split("|").map((s) => s.trim());

  for (const entry of entries) {
    // Delta: Gold+15 or Gold-8
    const deltaMatch = entry.match(/^(.+?)([+-])(\d+)$/);
    if (deltaMatch) {
      tags.push({ kind: "wealth", currency: deltaMatch[1].trim(), delta: parseInt(deltaMatch[3], 10) * (deltaMatch[2] === "-" ? -1 : 1) });
      continue;
    }

    // Transition: Gold 45→52 or Gold 45->52
    const transMatch = entry.match(/^(.+?)\s+(\d+)\s*(?:→|->)\s*(\d+)$/);
    if (transMatch) {
      tags.push({ kind: "wealth", currency: transMatch[1].trim(), transition: { from: parseInt(transMatch[2], 10), to: parseInt(transMatch[3], 10) } });
      continue;
    }

    // Absolute: Gold 45
    const absMatch = entry.match(/^(.+?)\s+(\d+)$/);
    if (absMatch) {
      tags.push({ kind: "wealth", currency: absMatch[1].trim(), amount: parseInt(absMatch[2], 10) });
      continue;
    }

    // Just a name (no amount)
    if (entry.trim()) {
      tags.push({ kind: "wealth", currency: entry.trim() });
    }
  }

  return tags;
}

function parseRoomTag(content: string, isRef: boolean): RoomTag {
  const tag: RoomTag = { kind: "room", id: "", ref: isRef };

  const parts = content.split("|").map((s) => s.trim());
  tag.id = parts[0];

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];

    // Exits field: "exits N:R2, E:R3"
    if (part.toLowerCase().startsWith("exits ") || part.toLowerCase().startsWith("exits:")) {
      const exitsStr = part.replace(/^exits[\s:]+/i, "");
      tag.exits = exitsStr.split(",").map((e) => e.trim()).filter(Boolean);
      continue;
    }

    // First non-exits field after ID is status
    if (!tag.status) {
      tag.status = part;
      continue;
    }

    // Second non-exits field is description
    if (!tag.description) {
      tag.description = part;
      continue;
    }
  }

  return tag;
}
