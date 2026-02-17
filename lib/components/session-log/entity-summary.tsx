/**
 * Entity Summary Component
 * Displays HP, AC, equipment, and status for a single entity
 */

import * as React from "react";
import type { EntityData } from "lib/services/entity-resolver";

export interface EntitySummaryProps {
  entity: EntityData;
}

export function EntitySummary({ entity }: EntitySummaryProps) {
  if (!entity.exists) {
    return (
      <div className="entity-summary entity-not-found">
        <p>Entity "{entity.name}" not found</p>
      </div>
    );
  }

  return (
    <div className="entity-summary">
      <div className="entity-summary-header">
        <h4>{entity.name}</h4>
      </div>

      <div className="entity-summary-body">
        {/* Frontmatter stats */}
        <div className="entity-stats">
          {entity.frontmatter.level && (
            <span className="stat-item">
              Level: {entity.frontmatter.level}
            </span>
          )}
          {entity.frontmatter.proficiency_bonus && (
            <span className="stat-item">
              Prof: +{entity.frontmatter.proficiency_bonus}
            </span>
          )}
        </div>

        {/* Code blocks available */}
        <div className="entity-blocks">
          {entity.codeBlocks.size > 0 && (
            <p className="blocks-available">
              Available blocks: {Array.from(entity.codeBlocks.keys()).join(", ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
