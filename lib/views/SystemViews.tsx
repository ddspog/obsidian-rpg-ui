/**
 * System Block Views
 *
 * Read-only display views for `rpg system*` code blocks.  These blocks define
 * system rules — they are not interactive character-sheet components.
 *
 * Registered views:
 *   - "system"             → renders a system info card
 *   - "system.attributes"  → renders attribute definition cards
 *   - "system.skills"      → renders skill definition cards
 *   - "system.expressions" → renders expression definition cards
 *   - "system.conditions"  → renders condition definition cards
 */

import { MarkdownPostProcessorContext } from "obsidian";
import { BaseView } from "./BaseView";
import {
  parseAttributeBlocks,
  parseSkillBlocks,
  parseExpressionBlocks,
  parseConditionBlocks,
  parseMarkdownSystemFile,
} from "lib/systems/parser";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function card(className: string, children: string): string {
  return `<div class="${className}">${children}</div>`;
}

// ─── SystemView (rpg system) ──────────────────────────────────────────────────

export class SystemView extends BaseView {
  public codeblock = "system";

  public render(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext): void {
    try {
      const parsed = parseMarkdownSystemFile(`\`\`\`rpg system\n${source}\n\`\`\``);
      if (!parsed) {
        el.innerHTML = `<div class="system-info-container"><p class="notice">Invalid system block — missing "name" field.</p></div>`;
        return;
      }
      el.innerHTML = this.buildSystemInfoCard(parsed);
    } catch (err) {
      el.innerHTML = `<div class="notice">Error rendering system block: ${String(err)}</div>`;
    }
  }

  private buildSystemInfoCard(parsed: NonNullable<ReturnType<typeof parseMarkdownSystemFile>>): string {
    const { name, attributes, refs } = parsed;
    const attributePills = (attributes ?? [])
      .map((a) => `<span class="system-info-attribute">${a.$name}</span>`)
      .join("");

    const refSection = (label: string, refPaths: string[] | undefined): string => {
      if (!refPaths || refPaths.length === 0) return "";
      const files = refPaths.map((r) => `<div class="system-info-file">📄 ${r}</div>`).join("");
      return `<div class="system-info-section">
        <span class="system-info-label">${label}</span>
        <div class="system-info-files">${files}</div>
      </div>`;
    };

    return `<div class="system-info-container">
      <div class="system-info-header">
        <span class="system-info-icon">⚙️</span>
        <h3 class="system-info-title">${name}</h3>
      </div>
      ${
        attributePills
          ? `<div class="system-info-section">
        <span class="system-info-label">Attributes</span>
        <div class="system-info-attributes">${attributePills}</div>
      </div>`
          : ""
      }
      ${refSection("Skills", refs.skills)}
      ${refSection("Expressions", refs.expressions)}
      ${refSection("Conditions", refs.conditions)}
    </div>`;
  }
}

// ─── SystemAttributesView (rpg system.attributes) ─────────────────────────────

export class SystemAttributesView extends BaseView {
  public codeblock = "system.attributes";

  public render(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext): void {
    try {
      const attrs = parseAttributeBlocks(`\`\`\`rpg system.attributes\n${source}\n\`\`\``);
      if (attrs.length === 0) {
        el.innerHTML = `<div class="notice">No attributes found in block.</div>`;
        return;
      }
      const cards = attrs
        .map(
          (a) => `<div class="attribute-card">
          <div class="attribute-header">
            <h4 class="attribute-name">${a.alias ? `${a.alias} – ` : ""}${a.$name}</h4>
          </div>
          ${a.subtitle ? `<div class="attribute-subtitle">${a.subtitle}</div>` : ""}
          ${a.$contents ? `<div class="attribute-description">${a.$contents}</div>` : ""}
        </div>`,
        )
        .join("");
      el.innerHTML = `<div class="attributes-display-container"><div class="attributes-grid">${cards}</div></div>`;
    } catch (err) {
      el.innerHTML = `<div class="notice">Error rendering attributes block: ${String(err)}</div>`;
    }
  }
}

// ─── SystemSkillsView (rpg system.skills) ─────────────────────────────────────

export class SystemSkillsView extends BaseView {
  public codeblock = "system.skills";

  public render(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext): void {
    try {
      const skills = parseSkillBlocks(`\`\`\`rpg system.skills\n${source}\n\`\`\``);
      if (skills.length === 0) {
        el.innerHTML = `<div class="notice">No skills found in block.</div>`;
        return;
      }
      const skillCards = skills
        .map(
          (s) => card(
            "system-skill-card",
            `<span class="system-skill-name">${s.$name}</span>
             <span class="system-skill-attribute">${String(s.attribute).substring(0, 3).toUpperCase()}</span>`,
          ),
        )
        .join("");
      el.innerHTML = `<div class="system-skills-display">
        <div class="system-skills-header">
          <span class="system-skills-icon">🎯</span>
          <h4 class="system-skills-title">Skills Definition</h4>
          <span class="system-skills-count">${skills.length}</span>
        </div>
        <div class="system-skills-grid">${skillCards}</div>
      </div>`;
    } catch (err) {
      el.innerHTML = `<div class="notice">Error rendering skills block: ${String(err)}</div>`;
    }
  }
}

// ─── SystemExpressionsView (rpg system.expressions) ───────────────────────────

export class SystemExpressionsView extends BaseView {
  public codeblock = "system.expressions";

  public render(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext): void {
    try {
      const exprs = parseExpressionBlocks(`\`\`\`rpg system.expressions\n${source}\n\`\`\``);
      if (exprs.length === 0) {
        el.innerHTML = `<div class="notice">No expressions found in block.</div>`;
        return;
      }
      const exprCards = exprs
        .map(
          (e) => `<div class="system-expression-card">
          <div class="system-expression-id">${e.id}</div>
          ${e.params.length > 0 ? `<div class="system-expression-params"><em>${e.params.join(", ")}</em></div>` : ""}
          <code class="system-expression-formula">${e.formula}</code>
        </div>`,
        )
        .join("");
      el.innerHTML = `<div class="system-expressions-display">
        <div class="system-expressions-header">
          <span class="system-expressions-icon">🔢</span>
          <h4 class="system-expressions-title">Expressions Definition</h4>
          <span class="system-expressions-count">${exprs.length}</span>
        </div>
        <div class="system-expressions-list">${exprCards}</div>
      </div>`;
    } catch (err) {
      el.innerHTML = `<div class="notice">Error rendering expressions block: ${String(err)}</div>`;
    }
  }
}

// ─── SystemConditionsView (rpg system.conditions) ─────────────────────────────

export class SystemConditionsView extends BaseView {
  public codeblock = "system.conditions";

  public render(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext): void {
    try {
      const conditions = parseConditionBlocks(`\`\`\`rpg system.conditions\n${source}\n\`\`\``);
      if (conditions.length === 0) {
        el.innerHTML = `<div class="notice">No conditions found in block.</div>`;
        return;
      }
      const conditionCards = conditions
        .map(
          (c) => `<div class="system-condition-card">
          <div class="system-condition-header">
            ${c.icon ? `<span class="system-condition-icon">${c.icon}</span>` : ""}
            <span class="system-condition-name">${c.$name}</span>
          </div>
          ${c.$contents ? `<div class="system-condition-description">${c.$contents}</div>` : ""}
        </div>`,
        )
        .join("");
      el.innerHTML = `<div class="system-conditions-display">
        <div class="system-conditions-header">
          <span class="system-conditions-icon">🎭</span>
          <h4 class="system-conditions-title">Conditions Definition</h4>
          <span class="system-conditions-count">${conditions.length}</span>
        </div>
        <div class="system-conditions-list">${conditionCards}</div>
      </div>`;
    } catch (err) {
      el.innerHTML = `<div class="notice">Error rendering conditions block: ${String(err)}</div>`;
    }
  }
}
