/**
 * Shared render helpers for statblock components (`StatblockVehicle`,
 * `StatblockMonster`). Keeps the two cards visually identical where they
 * overlap — title bar, ability table, stat list, feature entries — while
 * each card owns its own labels / subtitle / extra rows.
 */

import * as React from "react";
import { Markdown } from "./markdown";
import type {
  AbilityScores,
  ResolvedStatFeature,
  StatFeatureCategory,
} from "../domains/statblocks/types";
import { STAT_SECTION_LABELS, STAT_SECTION_ORDER } from "../domains/statblocks/types";

export function formatModifier(value: number): string {
  if (value >= 0) return `+${value}`;
  return String(value);
}

/** Split features into passive traits and the ordered action sections. */
export function groupFeatures(features: ResolvedStatFeature[]): {
  traits: ResolvedStatFeature[];
  sections: Record<string, ResolvedStatFeature[]>;
} {
  const traits: ResolvedStatFeature[] = [];
  const sections: Record<string, ResolvedStatFeature[]> = {};

  for (const f of features) {
    if (!f.type || !STAT_SECTION_ORDER.includes(f.type as StatFeatureCategory)) {
      traits.push(f);
    } else {
      (sections[f.type] ??= []).push(f);
    }
  }

  return { traits, sections };
}

export function normalizeStatValue(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw == null) return "";
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (Array.isArray(raw) && raw.length === 1 && Array.isArray(raw[0]) && raw[0].length === 1 && typeof raw[0][0] === "string") {
    return `[[${raw[0][0]}]]`;
  }
  return String(raw);
}

export function StatValue({ value, sourcePath }: { value: unknown; sourcePath?: string }) {
  const str = normalizeStatValue(value);
  if (/\[\[/.test(str)) {
    return <Markdown source={str} sourcePath={sourcePath} />;
  }
  return <>{str}</>;
}

/** Render `[[target|label]]` wikilinks inline as internal-links; plain text
 *  flows through unchanged. For one-line fields (subtitle, habitat) where a
 *  block-level `<Markdown>` would break the line. */
export function InlineWikilinks({ text }: { text: string }): React.ReactElement {
  const re = /\[\[([^\]\n]+)\]\]/g;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > cursor) parts.push(text.slice(cursor, m.index));
    const inner = m[1];
    const pipe = inner.indexOf("|");
    const target = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
    const label = (pipe >= 0 ? inner.slice(pipe + 1) : inner).split("/").pop()!.trim();
    parts.push(
      <a key={m.index} className="internal-link" href={target} data-href={target}>
        {label}
      </a>
    );
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/**
 * The justified `Habitat: a, b   ⟷   Treasure: x, y` line shared by
 * `stat.group` and ungrouped `stat.monster`. Wikilinks render inline.
 */
export function HabitatTreasureLine({
  habitat,
  treasure,
}: {
  habitat?: string;
  treasure?: string;
}): React.ReactElement | null {
  if (!habitat && !treasure) return null;
  return (
    <p className="rpg-statblock-habitat-treasure">
      {habitat ? (
        <span className="rpg-statblock-ht-habitat">
          <strong>Habitat:</strong> <InlineWikilinks text={habitat} />
        </span>
      ) : (
        <span />
      )}
      {treasure ? (
        <span className="rpg-statblock-ht-treasure">
          <strong>Treasure:</strong> <InlineWikilinks text={treasure} />
        </span>
      ) : null}
    </p>
  );
}

export function FeatureEntry({
  feature,
  sourcePath,
}: {
  feature: ResolvedStatFeature;
  sourcePath?: string;
}) {
  if (!feature.name) {
    if (!feature.text) return null;
    return (
      <div className="rpg-statblock-feature">
        <Markdown source={feature.text} sourcePath={sourcePath} />
      </div>
    );
  }
  if (!feature.text) {
    return (
      <p className="rpg-statblock-feature">
        <strong>
          <em>{feature.name}.</em>
        </strong>
      </p>
    );
  }
  return (
    <div className="rpg-statblock-feature">
      <Markdown source={`***${feature.name}.*** ${feature.text}`} sourcePath={sourcePath} />
    </div>
  );
}

/** The six-column ability-modifier table. */
export function AbilitiesTable({ abilities }: { abilities: AbilityScores }) {
  return (
    <table className="rpg-statblock-abilities">
      <thead>
        <tr>
          <th>STR</th>
          <th>DEX</th>
          <th>CON</th>
          <th>INT</th>
          <th>WIS</th>
          <th>CHA</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{formatModifier(abilities.str)}</td>
          <td>{formatModifier(abilities.dex)}</td>
          <td>{formatModifier(abilities.con)}</td>
          <td>{formatModifier(abilities.int)}</td>
          <td>{formatModifier(abilities.wis)}</td>
          <td>{formatModifier(abilities.cha)}</td>
        </tr>
      </tbody>
    </table>
  );
}

/** Render the passive traits + the ordered action sections (ACTIONS, …). */
export function FeatureSections({
  traits,
  sections,
  sourcePath,
}: {
  traits: ResolvedStatFeature[];
  sections: Record<string, ResolvedStatFeature[]>;
  sourcePath?: string;
}) {
  return (
    <>
      {traits.length > 0 && (
        <section className="rpg-statblock-traits">
          {traits.map((f, idx) => (
            <FeatureEntry key={idx} feature={f} sourcePath={sourcePath} />
          ))}
        </section>
      )}

      {STAT_SECTION_ORDER.map((cat) => {
        const items = sections[cat];
        if (!items || items.length === 0) return null;
        return (
          <section key={cat} className="rpg-statblock-section" data-category={cat}>
            <h4>{STAT_SECTION_LABELS[cat]}</h4>
            {items.map((f, idx) => (
              <FeatureEntry key={idx} feature={f} sourcePath={sourcePath} />
            ))}
          </section>
        );
      })}
    </>
  );
}

/**
 * Render a stat definition-list. `labels` maps raw keys to display labels;
 * keys in `paired` are laid out two-per-row (e.g. crew / passengers).
 */
export function renderStatEntries(
  entries: [string, unknown][],
  labels: Record<string, string>,
  paired: Set<string>,
  sourcePath?: string
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < entries.length) {
    const [key, value] = entries[i];
    if (paired.has(key) && i + 1 < entries.length && paired.has(entries[i + 1][0])) {
      elements.push(
        <div key={`pair-${i}`} className="rpg-statblock-stats-pair">
          <div>
            <dt>{labels[key] ?? key}</dt>
            <dd>
              <StatValue value={value} sourcePath={sourcePath} />
            </dd>
          </div>
          <div>
            <dt>{labels[entries[i + 1][0]] ?? entries[i + 1][0]}</dt>
            <dd>
              <StatValue value={entries[i + 1][1]} sourcePath={sourcePath} />
            </dd>
          </div>
        </div>
      );
      i += 2;
    } else {
      elements.push(
        <div key={key}>
          <dt>{labels[key] ?? key}</dt>
          <dd>
            <StatValue value={value} sourcePath={sourcePath} />
          </dd>
        </div>
      );
      i++;
    }
  }

  return elements;
}
