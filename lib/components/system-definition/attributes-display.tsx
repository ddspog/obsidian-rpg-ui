import * as React from "react";
import { MarkdownRenderer } from "obsidian";

interface AttributeDefinition {
  name: string;
  subtitle?: string;
  alias?: string;
  description?: string;
}

interface AttributesDisplayProps {
  attributes: AttributeDefinition[];
  vault?: any; // Obsidian vault for markdown rendering
}

export function AttributesDisplay(props: AttributesDisplayProps): JSX.Element {
  const renderMarkdown = (markdown: string, container: HTMLElement) => {
    if (props.vault) {
      MarkdownRenderer.renderMarkdown(
        markdown,
        container,
        "",
        null as any
      );
    } else {
      container.innerHTML = markdown;
    }
  };

  const formatAttributeName = (name: string, alias?: string): string => {
    const displayName = name.toUpperCase();
    if (alias) {
      return `${displayName} (${alias.toUpperCase()})`;
    }
    return displayName;
  };

  return (
    <div className="attributes-display-container">
      <div className="attributes-grid">
        {props.attributes.map((attr, index) => (
          <div key={index} className="attribute-card">
            <div className="attribute-header">
              <h4 className="attribute-name">
                {formatAttributeName(attr.name, attr.alias)}
              </h4>
            </div>
            
            {attr.subtitle && (
              <div className="attribute-subtitle">
                {attr.subtitle}
              </div>
            )}
            
            {attr.description && (
              <div 
                className="attribute-description"
                ref={(el) => {
                  if (el && attr.description) {
                    renderMarkdown(attr.description, el);
                  }
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
