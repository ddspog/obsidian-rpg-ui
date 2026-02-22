/**
 * Show block – entries builder
 * Constructs the DOM entries list from data and configuration.
 */

interface EntriesConfig {
  data: string;
  properties: string[];
  level?: number;
}

/**
 * Build an entries container element from an array of data objects.
 */
export function buildEntries(
  entries: any[],
  config: EntriesConfig | undefined,
  renderMarkdown: (text: string, el: HTMLElement) => void
): HTMLElement {
  const container = document.createElement("div");
  container.className = "rpg-entries";

  const properties = config?.properties || ["name", "subtitle", "description"];
  const hasName = properties.includes("name");
  const hasSubtitle = properties.includes("subtitle");
  const hasDescription = properties.includes("description");
  const customProps = properties.filter((p) => p !== "name" && p !== "subtitle" && p !== "description");

  for (const entry of entries) {
    const entryDiv = document.createElement("div");
    entryDiv.className = "rpg-entry";

    if (hasName || hasSubtitle) {
      const titleDiv = document.createElement("div");
      titleDiv.className = "rpg-entry-title";

      if (hasName) {
        const nameVal = entry["name"];
        if (nameVal) {
          const headingLevel = config?.level ?? 5;
          const validLevel = typeof headingLevel === "number" && headingLevel >= 1 && headingLevel <= 6;
          const nameEl = document.createElement(validLevel ? `h${headingLevel}` : "h5");
          nameEl.textContent = String(nameVal);
          titleDiv.appendChild(nameEl);
        }
      }

      if (hasSubtitle) {
        const subtitleVal = entry["subtitle"];
        if (subtitleVal) {
          const em = document.createElement("em");
          em.textContent = String(subtitleVal);
          titleDiv.appendChild(em);
        }
      }

      if (titleDiv.hasChildNodes()) entryDiv.appendChild(titleDiv);
    }

    const hasBodyContent =
      (hasDescription && entry["description"]) ||
      customProps.some((p) => entry[p] !== undefined && entry[p] !== null);

    if (hasBodyContent) {
      const descDiv = document.createElement("div");
      descDiv.className = "rpg-entry-description";

      if (hasDescription) {
        const descVal = entry["description"];
        if (descVal) renderMarkdown(String(descVal), descDiv);
      }

      for (const prop of customProps) {
        const val = entry[prop];
        if (val !== undefined && val !== null) {
          if (descDiv.hasChildNodes()) descDiv.appendChild(document.createElement("br"));
          const label = prop.charAt(0).toUpperCase() + prop.slice(1).replace(/_/g, " ");
          descDiv.appendChild(document.createTextNode(`${label}: ${String(val)}`));
        }
      }

      entryDiv.appendChild(descDiv);
    }

    container.appendChild(entryDiv);
  }

  return container;
}
