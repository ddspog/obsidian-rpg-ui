import * as React from "react";
import type { ItemMagicData, ItemMagicVariant, ItemMagicVariantsConfig } from "lib/domains/items/schema";

interface ItemMagicCardProps {
  data: ItemMagicData;
  showDescription?: boolean;
  renderMarkdown?: (source: string) => React.ReactNode;
}

export function ItemMagicCard({ data, showDescription = true, renderMarkdown }: ItemMagicCardProps) {
  const { rows: variantRows, columns: variantColumns, title: variantTitle } = normalizeVariants(data.variants);
  const hasVariants = variantRows.length > 0;
  const subtitle = buildSubtitle(data);

  return (
    <article className="rpg-item-magic-card">
      {data.name && (
        <header className="rpg-item-magic-card__header">
          <h3>{data.name}</h3>
        </header>
      )}

      <div className="rpg-item-magic-card__body">
        {subtitle && (
          <p className="rpg-item-magic-card__subtitle">
            <span className="rpg-item-magic-card__subtitle-type">{subtitle.type}</span>
            {data.cost && <span className="rpg-item-magic-card__subtitle-cost">{data.cost}</span>}
          </p>
        )}

        {showDescription && data.text && (
          <div className="rpg-item-magic-card__text">
            {renderMarkdown ? renderMarkdown(data.text) : <p>{data.text}</p>}
          </div>
        )}

        {data.bonus && !hasVariants && (
          <dl className="rpg-item-magic-card__effects">
            <dt>Bonus</dt>
            <dd>{data.bonus}</dd>
            {typeof data.damage_bonus === "number" && data.damage_bonus !== 0 && (
              <>
                <dt>Extra Damage</dt>
                <dd>{signed(data.damage_bonus)}</dd>
              </>
            )}
          </dl>
        )}

        {hasVariants && (
          <div className="el-table rpg-table-wrapper">
            <table className="rpg-table rpg-item-magic-card__variants">
              {variantTitle && <caption>{variantTitle}</caption>}
              <thead>
                <tr>
                  {variantColumns.map((col) => (
                    <th key={col}>{formatColumnLabel(col)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variantRows.map((variant, i) => (
                  <tr key={i}>
                    {variantColumns.map((col) => (
                      <td key={col}>{getVariantCell(variant, col)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDescription && data.image && (
        <figure className="rpg-item-card__figure">
          {renderMarkdown ? renderMarkdown(data.image) : <span>{data.image}</span>}
        </figure>
      )}
    </article>
  );
}

function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return String(n);
  return "+0";
}

function normalizeVariants(raw: ItemMagicData["variants"]): {
  rows: ItemMagicVariant[];
  columns: string[];
  title?: string;
} {
  if (!raw) return { rows: [], columns: [] };
  if (Array.isArray(raw)) {
    const cols = inferColumns(raw);
    return { rows: raw, columns: cols };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.rows && Array.isArray(obj.rows)) {
    const rows = obj.rows as ItemMagicVariant[];
    const cols = (Array.isArray(obj.columns) ? obj.columns.map(String) : null) ?? inferColumns(rows);
    return { rows, columns: cols, title: typeof obj.title === "string" ? obj.title : undefined };
  }
  const rows = Object.values(raw as Record<string, ItemMagicVariant>);
  return { rows, columns: inferColumns(rows) };
}

const DEFAULT_COLUMNS = ["rarity", "bonus", "price"];

function inferColumns(rows: ItemMagicVariant[]): string[] {
  if (rows.length === 0) return DEFAULT_COLUMNS;
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) keys.add(key);
  }
  return DEFAULT_COLUMNS.filter((c) => keys.has(c) || (c === "price" && keys.has("cost")));
}

function formatColumnLabel(col: string): string {
  return col.charAt(0).toUpperCase() + col.slice(1).replace(/_/g, " ");
}

function getVariantCell(variant: ItemMagicVariant, col: string): string {
  if (col === "price") return variant.price ?? variant.cost ?? "—";
  if (col === "bonus") return variant.bonus ?? (typeof variant.damage_bonus === "number" ? signed(variant.damage_bonus) : "—");
  const val = (variant as Record<string, unknown>)[col];
  return val != null ? String(val) : "—";
}

function buildSubtitle(data: ItemMagicData): { type: string } | null {
  const parts: string[] = [];

  const appliesTo = formatAppliesTo(data.applies_to);
  if (appliesTo) {
    parts.push(appliesTo);
  } else {
    parts.push("Wondrous Item");
  }

  if (data.rarity) {
    parts.push(data.rarity);
  }

  if (data.attunement) {
    if (typeof data.attunement === "string") {
      parts.push(`(${data.attunement})`);
    } else {
      parts.push("(Requires Attunement)");
    }
  }

  return parts.length > 0 ? { type: parts.join(", ") } : null;
}

function formatAppliesTo(raw: ItemMagicData["applies_to"]): string | null {
  if (!raw) return null;
  const parts: string[] = [];
  if (raw.kinds && raw.kinds.length > 0) {
    parts.push(raw.kinds.map((k) => k.charAt(0).toUpperCase() + k.slice(1)).join(" / "));
  }
  if (raw.families && raw.families.length > 0) {
    parts.push(`(${raw.families.map(cleanWikilink).join(", ")})`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

function cleanWikilink(raw: string): string {
  const m = raw.match(/^\[\[(.+?)\]\]$/);
  const inner = m ? m[1] : raw;
  const pipe = inner.indexOf("|");
  return (pipe >= 0 ? inner.slice(pipe + 1) : inner).split("/").pop()!.trim();
}
