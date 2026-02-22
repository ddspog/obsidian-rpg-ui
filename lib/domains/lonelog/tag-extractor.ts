import type { PersistentTag } from "./types";

/** Extract all persistent tags from a text string */
export function extractTags(text: string): PersistentTag[] {
  const tags: PersistentTag[] = [];
  const tagRegex = /\[(?:#)?(N|L|E|Clock|Track|Timer|Thread|PC):([^\]|]+)(?:\|([^\]]*))?\]/g;

  let match;
  while ((match = tagRegex.exec(text)) !== null) {
    const isRef = text[match.index + 1] === "#";
    const kind = match[1];
    const name = match[2];
    const tagData = match[3] || "";

    switch (kind) {
      case "N": {
        const tagList = tagData ? tagData.split("|").filter(Boolean) : [];
        tags.push({ kind: "npc", name, tags: tagList, ref: isRef });
        break;
      }
      case "L": {
        const tagList = tagData ? tagData.split("|").filter(Boolean) : [];
        tags.push({ kind: "location", name, tags: tagList });
        break;
      }
      case "E": {
        const combined = `${name}${tagData ? ` ${tagData}` : ""}`;
        const m = combined.match(/^(.+?)\s+(\d+)\/(\d+)$/);
        if (m) tags.push({ kind: "event", name: m[1].trim(), current: parseInt(m[2], 10), max: parseInt(m[3], 10) });
        break;
      }
      case "Clock": {
        const combined = `${name}${tagData ? ` ${tagData}` : ""}`;
        const m = combined.match(/^(.+?)\s+(\d+)\/(\d+)$/);
        if (m) {
          tags.push({ kind: "clock", name: m[1].trim(), current: parseInt(m[2], 10), max: parseInt(m[3], 10) });
        } else {
          const alt = name.match(/^(\d+)\/(\d+)$/);
          if (alt) tags.push({ kind: "clock", name: tagData || "Clock", current: parseInt(alt[1], 10), max: parseInt(alt[2], 10) });
        }
        break;
      }
      case "Track": {
        const combined = `${name}${tagData ? ` ${tagData}` : ""}`;
        const m = combined.match(/^(.+?)\s+(\d+)\/(\d+)$/);
        if (m) tags.push({ kind: "track", name: m[1].trim(), current: parseInt(m[2], 10), max: parseInt(m[3], 10) });
        break;
      }
      case "Timer": {
        const combined = `${name}${tagData ? ` ${tagData}` : ""}`;
        const m = combined.match(/^(.+?)\s+(\d+)$/);
        if (m) {
          tags.push({ kind: "timer", name: m[1].trim(), value: parseInt(m[2], 10) });
        } else {
          const num = name.match(/^(\d+)$/);
          if (num) tags.push({ kind: "timer", name: "Timer", value: parseInt(num[1], 10) });
        }
        break;
      }
      case "Thread":
        tags.push({ kind: "thread", name, state: tagData || "Open" });
        break;
      case "PC": {
        const changes = tagData ? tagData.split("|").filter(Boolean) : [];
        tags.push({ kind: "pc", name, changes });
        break;
      }
    }
  }

  return tags;
}
