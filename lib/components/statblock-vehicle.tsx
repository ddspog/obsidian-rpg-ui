import * as React from "react";
import { Markdown } from "./markdown";
import type {
  AbilityScores,
  ResolvedStatFeature,
  StatFeatureCategory,
} from "../domains/statblocks/types";
import { STAT_SECTION_LABELS, STAT_SECTION_ORDER } from "../domains/statblocks/types";

export interface StatblockVehicleProps {
  name: string;
  size: string;
  type: string;
  dimensions?: string;
  stats: Record<string, string>;
  abilities: AbilityScores;
  features: ResolvedStatFeature[];
  body?: string;
  view?: string;
  sourcePath?: string;
}

const STAT_LABELS: Record<string, string> = {
  ac: "Armor Class",
  hp: "Hit Points",
  speed: "Speed",
  immune: "Immune",
  initiative: "Initiative",
  crew: "Crew",
  passengers: "Passengers",
  cargo: "Cargo Capacity",
};

const PAIRED_STATS = new Set(["crew", "passengers"]);

function formatModifier(value: number): string {
  if (value >= 0) return `+${value}`;
  return String(value);
}

function groupFeatures(features: ResolvedStatFeature[]) {
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

export function StatblockVehicle({
  name,
  size,
  type,
  dimensions,
  stats,
  abilities,
  features,
  body,
  view,
  sourcePath,
}: StatblockVehicleProps) {
  const { traits, sections } = React.useMemo(() => groupFeatures(features), [features]);
  const subtitle = dimensions ? `${size} ${type} (${dimensions})` : `${size} ${type}`;
  const descAfter = view === "desc-after";

  const description = body ? (
    <section className="rpg-statblock-desc">
      <Markdown source={body} sourcePath={sourcePath} />
    </section>
  ) : null;

  return (
    <article className="rpg-statblock rpg-statblock-vehicle">
      {!descAfter && description}

      <header className="rpg-statblock-header">
        <h3>{name}</h3>
      </header>
      <p className="rpg-statblock-subtitle">
        <em>{subtitle}</em>
      </p>

      <dl className="rpg-statblock-stats">
        {renderStatEntries(Object.entries(stats), sourcePath)}
      </dl>

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

      {descAfter && description}
    </article>
  );
}

function FeatureEntry({
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
      <Markdown
        source={`***${feature.name}.*** ${feature.text}`}
        sourcePath={sourcePath}
      />
    </div>
  );
}

function normalizeStatValue(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw == null) return "";
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (Array.isArray(raw) && raw.length === 1 && Array.isArray(raw[0]) && raw[0].length === 1 && typeof raw[0][0] === "string") {
    return `[[${raw[0][0]}]]`;
  }
  return String(raw);
}

function StatValue({ value, sourcePath }: { value: unknown; sourcePath?: string }) {
  const str = normalizeStatValue(value);
  if (/\[\[/.test(str)) {
    return <Markdown source={str} sourcePath={sourcePath} />;
  }
  return <>{str}</>;
}

function renderStatEntries(entries: [string, unknown][], sourcePath?: string) {
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < entries.length) {
    const [key, value] = entries[i];
    if (PAIRED_STATS.has(key) && i + 1 < entries.length && PAIRED_STATS.has(entries[i + 1][0])) {
      elements.push(
        <div key={`pair-${i}`} className="rpg-statblock-stats-pair">
          <div>
            <dt>{STAT_LABELS[key] ?? key}</dt>
            <dd><StatValue value={value} sourcePath={sourcePath} /></dd>
          </div>
          <div>
            <dt>{STAT_LABELS[entries[i + 1][0]] ?? entries[i + 1][0]}</dt>
            <dd><StatValue value={entries[i + 1][1]} sourcePath={sourcePath} /></dd>
          </div>
        </div>
      );
      i += 2;
    } else {
      elements.push(
        <div key={key}>
          <dt>{STAT_LABELS[key] ?? key}</dt>
          <dd><StatValue value={value} sourcePath={sourcePath} /></dd>
        </div>
      );
      i++;
    }
  }

  return elements;
}

export default StatblockVehicle;
