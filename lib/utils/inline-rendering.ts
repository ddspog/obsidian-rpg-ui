import { MarkdownRenderer } from "obsidian";

export interface DataRecord {
  [key: string]: unknown;
}

export function buildInlineTable(data: DataRecord[], columns: Array<Record<string, unknown>>): HTMLElement {
  const table = document.createElement("table");
  table.className = "rpg-inline-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const normalizedColumns = columns
    .map((column) => {
      const property = String(column.property ?? column.data ?? column.key ?? "").trim();
      const header = String(column.header ?? column.label ?? property).trim();
      return { property, header };
    })
    .filter((column) => column.property.length > 0);

  for (const column of normalizedColumns) {
    const th = document.createElement("th");
    th.textContent = column.header || column.property;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const row of data) {
    const tr = document.createElement("tr");
    for (const column of normalizedColumns) {
      const td = document.createElement("td");
      const value = getValue(row, column.property);
      td.textContent = formatValue(value);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  return table;
}

export function buildInlineCards(data: DataRecord[], fields: string[], sourcePath: string, renderMarkdown: (text: string, el: HTMLElement, path: string) => void): HTMLElement {
  const container = document.createElement("div");
  container.className = "rpg-inline-cards";

  const normalizedFields = fields.map((field) => String(field).trim()).filter((field) => field.length > 0);

  for (const item of data) {
    const card = document.createElement("div");
    card.className = "rpg-inline-card";

    const name = formatValue(item.name ?? "");
    const alias = formatValue(item.alias ?? "");
    const header = document.createElement("div");
    header.className = "rpg-inline-card-header";
    // Display uppercase name as the main header
    header.textContent = name.toUpperCase();

    // If alias exists and is different from name, show it inline with parentheses
    if (alias && alias.toUpperCase() !== name.toUpperCase()) {
      const aliasEl = document.createElement("span");
      aliasEl.className = "rpg-inline-card-alias";
      aliasEl.textContent = ` (${alias.toUpperCase()})`;
      header.appendChild(aliasEl);
    }

    card.appendChild(header);

    if (item.subtitle) {
      const subtitle = document.createElement("div");
      subtitle.className = "rpg-inline-card-subtitle";
      subtitle.textContent = formatValue(item.subtitle);
      card.appendChild(subtitle);
    }

    if (item.description) {
      const description = document.createElement("div");
      description.className = "rpg-inline-card-description";
      renderMarkdown(String(item.description), description, sourcePath);
      card.appendChild(description);
    }

    const extras = normalizedFields.filter((field) => !["name", "alias", "subtitle", "description"].includes(field));
    if (extras.length > 0) {
      const list = document.createElement("div");
      list.className = "rpg-inline-card-fields";
      for (const field of extras) {
        const value = getValue(item, field);
        const row = document.createElement("div");
        row.className = "rpg-inline-card-field";
        const label = document.createElement("span");
        label.className = "rpg-inline-card-field-label";
        label.textContent = formatFieldLabel(field);
        const content = document.createElement("span");
        content.className = "rpg-inline-card-field-value";
        content.textContent = formatValue(value);
        row.append(label, content);
        list.appendChild(row);
      }
      card.appendChild(list);
    }

    container.appendChild(card);
  }

  return container;
}

export function getValue(record: DataRecord, path: string): unknown {
  if (!path) return "";
  const parts = path.split(".");
  let current: unknown = record;
  for (const part of parts) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[part];
  }
  return current ?? "";
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => formatValue(item)).join(", ");
  return JSON.stringify(value);
}

export function formatFieldLabel(field: string): string {
  return field.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
