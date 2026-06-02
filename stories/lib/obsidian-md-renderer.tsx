/**
 * obsidian-md-renderer.tsx
 *
 * Minimal Obsidian-flavored markdown → React renderer used by Storybook to
 * preview compendium documents end-to-end. Parses headings, paragraphs,
 * unordered lists, callouts (`>[!type] title`), wikilinks (`[[x]]` /
 * `[[x|y]]`), image embeds (`![[img|params]]`), bold/italic, pipe tables
 * inside `tx` code fences, and dispatches `rpg feature.{details,choice,unlock}`
 * code fences through `RpgBlock`.
 *
 * Deliberately not a full markdown engine — it handles the exact patterns
 * used by the Tales of the Valiant compendium and nothing more.
 */

import * as React from "react";
import { RpgBlock } from "./RpgBlock";
import type { RPGSystem } from "../../lib/systems/types";

// ─── Block types ──────────────────────────────────────────────────────────────

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "callout"; kind: string; title: string; children: Block[] }
  | { type: "image"; target: string; params: string }
  | { type: "feature"; subtype: "details" | "choice" | "unlock"; yaml: string }
  | { type: "tx"; raw: string }
  | { type: "code"; lang: string; content: string }
  | { type: "hr" };

// ─── Block parser ─────────────────────────────────────────────────────────────

function isBlockStart(line: string): boolean {
  return (
    line.startsWith("#") ||
    line.startsWith("```") ||
    line.startsWith(">") ||
    line.startsWith("!") ||
    /^[-*]\s+/.test(line) ||
    /^---+\s*$/.test(line)
  );
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  const end = lines.length;

  while (i < end) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Code fence
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const content: string[] = [];
      i++;
      while (i < end && !lines[i].startsWith("```")) {
        content.push(lines[i]);
        i++;
      }
      if (i < end) i++; // skip closing ```

      const featureMatch = /^rpg feature\.(details|choice|unlock)$/.exec(lang);
      if (featureMatch) {
        blocks.push({
          type: "feature",
          subtype: featureMatch[1] as "details" | "choice" | "unlock",
          yaml: content.join("\n"),
        });
      } else if (lang === "tx") {
        blocks.push({ type: "tx", raw: content.join("\n") });
      } else {
        blocks.push({ type: "code", lang, content: content.join("\n") });
      }
      continue;
    }

    // Callout: > [!type] title
    const calloutMatch = /^>\s*\[!([^\]]+)\]\s*(.*)$/.exec(line);
    if (calloutMatch) {
      const kind = calloutMatch[1].trim();
      const title = calloutMatch[2].trim();
      i++;
      const bodyLines: string[] = [];
      while (i < end && lines[i].startsWith(">")) {
        bodyLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({
        type: "callout",
        kind,
        title,
        children: parseBlocks(bodyLines),
      });
      continue;
    }

    // Image embed (possibly with trailing inline prose): ![[target|params]]rest
    const embedMatch = /^!\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/.exec(line);
    if (embedMatch) {
      blocks.push({
        type: "image",
        target: embedMatch[1].trim(),
        params: (embedMatch[2] ?? "").trim(),
      });
      const rest = line.slice(embedMatch[0].length).trim();
      if (rest) {
        const paraLines: string[] = [rest];
        i++;
        while (i < end && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
          paraLines.push(lines[i]);
          i++;
        }
        blocks.push({ type: "paragraph", text: paraLines.join("\n") });
        continue;
      }
      i++;
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < end && /^[-*]\s+/.test(lines[i])) {
        let item = lines[i].replace(/^[-*]\s+/, "");
        i++;
        // Consume continuation lines (indented, non-empty, not a new block)
        while (i < end && /^\s{2,}\S/.test(lines[i])) {
          item += " " + lines[i].trim();
          i++;
        }
        items.push(item);
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // Default: paragraph (consecutive non-blank, non-block-start lines).
    // Internal newlines are preserved so label/value groups like `**X:** y`
    // render as soft line breaks instead of collapsing onto one line.
    const paraLines: string[] = [line];
    i++;
    while (i < end && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", text: paraLines.join("\n") });
  }

  return blocks;
}

// ─── Inline parser (bold/italic/wikilinks) ────────────────────────────────────

function renderInline(text: string, keyPrefix: string = "i"): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let buffer = "";
  let i = 0;
  let k = 0;

  const flush = () => {
    if (buffer) {
      nodes.push(buffer);
      buffer = "";
    }
  };

  while (i < text.length) {
    const rest = text.slice(i);

    // **bold**
    let m = /^\*\*([^*]+)\*\*/.exec(rest);
    if (m) {
      flush();
      nodes.push(<strong key={`${keyPrefix}-${k++}`}>{renderInline(m[1], `${keyPrefix}-${k}`)}</strong>);
      i += m[0].length;
      continue;
    }

    // __bold__
    m = /^__([^_]+)__/.exec(rest);
    if (m) {
      flush();
      nodes.push(<strong key={`${keyPrefix}-${k++}`}>{renderInline(m[1], `${keyPrefix}-${k}`)}</strong>);
      i += m[0].length;
      continue;
    }

    // [[target|display]] or [[target]]
    m = /^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/.exec(rest);
    if (m) {
      flush();
      const target = m[1].trim();
      const display = (m[2] ?? m[1]).trim();
      nodes.push(
        <a key={`${keyPrefix}-${k++}`} href={`#${target.replace(/\s+/g, "-")}`}>
          {display}
        </a>
      );
      i += m[0].length;
      continue;
    }

    // _italic_
    m = /^_([^_\n]+)_/.exec(rest);
    if (m) {
      flush();
      nodes.push(<em key={`${keyPrefix}-${k++}`}>{renderInline(m[1], `${keyPrefix}-${k}`)}</em>);
      i += m[0].length;
      continue;
    }

    // *italic* (avoid eating stray asterisks inside words)
    m = /^\*([^*\n]+)\*/.exec(rest);
    if (m) {
      flush();
      nodes.push(<em key={`${keyPrefix}-${k++}`}>{renderInline(m[1], `${keyPrefix}-${k}`)}</em>);
      i += m[0].length;
      continue;
    }

    buffer += text[i];
    i++;
  }
  flush();

  return nodes;
}

// ─── Pipe table parser for ```tx``` fences ───────────────────────────────────

function splitRow(line: string): string[] {
  const parts = line.trim().split("|");
  if (parts[0] === "") parts.shift();
  if (parts[parts.length - 1] === "") parts.pop();
  return parts.map((c) => c.trim());
}

function TxTable({ raw }: { raw: string }) {
  const allLines = raw.split("\n").filter((l) => l.trim());
  // Strip trailing [ ... ] meta line (CSS tags / caption markers)
  let caption: string | null = null;
  if (allLines.length > 0 && allLines[allLines.length - 1].startsWith("[")) {
    const meta = allLines.pop()!;
    const captionMatch = /^\[\s*([^\]#]+?)\s*(?:#|\])/.exec(meta);
    caption = captionMatch ? captionMatch[1].trim() : null;
  }

  const tableLines = allLines.filter((l) => l.trim().startsWith("|"));
  if (tableLines.length < 2) return null;

  const rows = tableLines.map(splitRow);
  const sepIdx = rows.findIndex((r) => r.every((c) => /^:?-+:?$/.test(c)));
  const headerRows = sepIdx >= 0 ? rows.slice(0, sepIdx) : [];
  const bodyRows = sepIdx >= 0 ? rows.slice(sepIdx + 1) : rows;

  return (
    <figure aria-label={caption ?? "Table"} className="rpg-tx-table">
      {caption && (
        <figcaption>
          <strong>{caption}</strong>
        </figcaption>
      )}
      <table>
        {headerRows.length > 0 && (
          <thead>
            {headerRows.map((row, ri) => (
              <tr key={ri}>{renderHeaderCells(row, ri)}</tr>
            ))}
          </thead>
        )}
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) =>
                ci === 0 ? (
                  <th key={ci} scope="row">
                    {renderInline(cell, `tx-${ri}-${ci}`)}
                  </th>
                ) : (
                  <td key={ci}>{renderInline(cell, `tx-${ri}-${ci}`)}</td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function renderHeaderCells(row: string[], rowIndex: number): React.ReactNode[] {
  const cells: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < row.length) {
    if (row[i] === "") {
      i++;
      continue;
    }
    let span = 1;
    while (i + span < row.length && row[i + span] === "") span++;
    cells.push(
      <th key={`${rowIndex}-${k++}`} scope="col" colSpan={span > 1 ? span : undefined}>
        {renderInline(row[i], `th-${rowIndex}-${k}`)}
      </th>
    );
    i += span;
  }
  return cells;
}

// ─── Block renderer ───────────────────────────────────────────────────────────

function Callout({ kind, title, children }: { kind: string; title: string; children: React.ReactNode }) {
  return (
    <aside className={`rpg-callout rpg-callout-${kind.toLowerCase()}`} aria-label={title || kind}>
      <header>
        <strong>{title || kind}</strong>
      </header>
      {children}
    </aside>
  );
}

function ImageEmbed({ target, params }: { target: string; params: string }) {
  // Params can carry alignment (right/left), dimensions, visibility flags.
  // In the Storybook preview we don't have the original asset, so render a
  // semantic placeholder figure that respects the requested float when given.
  const tokens = params
    .split("|")
    .map((t) => t.trim())
    .filter(Boolean);
  const align = tokens.find((t) => t === "left" || t === "right");
  const widthTok = tokens.find((t) => /^\d+$/.test(t));
  const style: React.CSSProperties = {};
  if (align === "left") style.float = "left";
  if (align === "right") style.float = "right";
  if (widthTok) style.width = `${widthTok}px`;
  return (
    <figure className="rpg-md-embed" style={style} aria-label={`Embed ${target}`}>
      <figcaption>
        <em>{target}</em>
      </figcaption>
    </figure>
  );
}

function renderBlock(block: Block, system: RPGSystem, key: string): React.ReactNode {
  switch (block.type) {
    case "heading": {
      const Tag = `h${Math.min(block.level, 6)}` as keyof React.JSX.IntrinsicElements;
      return <Tag key={key}>{renderInline(block.text, key)}</Tag>;
    }
    case "paragraph": {
      const lines = block.text.split("\n");
      return (
        <p key={key}>
          {lines.map((l, i) => (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              {renderInline(l, `${key}-${i}`)}
            </React.Fragment>
          ))}
        </p>
      );
    }
    case "list":
      return (
        <ul key={key}>
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item, `${key}-${i}`)}</li>
          ))}
        </ul>
      );
    case "callout":
      return (
        <Callout key={key} kind={block.kind} title={block.title}>
          {block.children.map((b, i) => renderBlock(b, system, `${key}-${i}`))}
        </Callout>
      );
    case "image":
      return <ImageEmbed key={key} target={block.target} params={block.params} />;
    case "feature":
      return <RpgBlock key={key} system={system} entity="feature" block={block.subtype} yaml={block.yaml} />;
    case "tx":
      return <TxTable key={key} raw={block.raw} />;
    case "code":
      return (
        <pre key={key} className={`language-${block.lang}`}>
          <code>{block.content}</code>
        </pre>
      );
    case "hr":
      return <hr key={key} />;
  }
}

// ─── Public entrypoint ────────────────────────────────────────────────────────

export interface ObsidianMarkdownProps {
  system: RPGSystem;
  source: string;
  /** Optional `aria-label` for the outer wrapper; defaults to "Compendium page". */
  ariaLabel?: string;
  /** Optional class applied to the wrapper. */
  className?: string;
}

export function ObsidianMarkdown({
  system,
  source,
  ariaLabel = "Compendium page",
  className = "rpg-compendium-page",
}: ObsidianMarkdownProps) {
  const blocks = React.useMemo(() => parseBlocks(source.split("\n")), [source]);
  return (
    <article aria-label={ariaLabel} className={className}>
      {blocks.map((b, i) => renderBlock(b, system, `b-${i}`))}
    </article>
  );
}

export default ObsidianMarkdown;
