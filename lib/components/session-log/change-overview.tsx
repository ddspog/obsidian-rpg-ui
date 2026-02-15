/**
 * Change Overview Component
 * Displays a summary of all state changes (deltas) from the session
 */

import * as React from "react";
import type { EntityDelta, ProgressChange, ThreadChange } from "lib/domains/lonelog/types";
import {
  calculateTotalHPChange,
  getFinalStatus,
  getActiveTags,
} from "lib/domains/lonelog/deltas";

export interface ChangeOverviewProps {
  entityDeltas: EntityDelta[];
  progressChanges: ProgressChange[];
  threadChanges: ThreadChange[];
}

export function ChangeOverview({
  entityDeltas,
  progressChanges,
  threadChanges,
}: ChangeOverviewProps) {
  if (
    entityDeltas.length === 0 &&
    progressChanges.length === 0 &&
    threadChanges.length === 0
  ) {
    return null;
  }

  return (
    <div className="lonelog-change-overview">
      <h3>Session Overview</h3>

      {entityDeltas.length > 0 && (
        <div className="overview-section">
          <h4>Entities</h4>
          {entityDeltas.map((delta, index) => (
            <EntityChangeSummary key={index} delta={delta} />
          ))}
        </div>
      )}

      {progressChanges.length > 0 && (
        <div className="overview-section">
          <h4>Progress Trackers</h4>
          <div className="progress-list">
            {progressChanges.map((progress, index) => (
              <ProgressChangeSummary key={index} progress={progress} />
            ))}
          </div>
        </div>
      )}

      {threadChanges.length > 0 && (
        <div className="overview-section">
          <h4>Threads</h4>
          <div className="thread-list">
            {threadChanges.map((thread, index) => (
              <ThreadChangeSummary key={index} thread={thread} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface EntityChangeSummaryProps {
  delta: EntityDelta;
}

function EntityChangeSummary({ delta }: EntityChangeSummaryProps) {
  const totalHP = calculateTotalHPChange(delta.changes);
  const finalStatus = getFinalStatus(delta.changes);
  const activeTags = getActiveTags(delta.changes);

  const hpDisplay = totalHP === 0 ? "—" : totalHP > 0 ? `+${totalHP}` : `${totalHP}`;
  const hpClass = totalHP === 0 ? "" : totalHP > 0 ? "hp-gain" : "hp-loss";

  return (
    <div className="entity-change-summary">
      <span className="entity-name">
        {delta.entityType === "pc" ? "PC" : "NPC"}: {delta.entity}
      </span>
      {totalHP !== 0 && (
        <span className={`entity-hp ${hpClass}`}>HP {hpDisplay}</span>
      )}
      {finalStatus && (
        <span className="entity-status">Status: {finalStatus}</span>
      )}
      {activeTags.size > 0 && (
        <span className="entity-tags">
          Tags: {Array.from(activeTags).join(", ")}
        </span>
      )}
    </div>
  );
}

interface ProgressChangeSummaryProps {
  progress: ProgressChange;
}

function ProgressChangeSummary({ progress }: ProgressChangeSummaryProps) {
  const icon =
    progress.kind === "clock"
      ? "🕐"
      : progress.kind === "track"
        ? "📊"
        : progress.kind === "timer"
          ? "⏱"
          : "📅";

  return (
    <div className="progress-change-summary">
      <span className="progress-icon">{icon}</span>
      <span className="progress-name">{progress.name}:</span>
      <span className="progress-value">
        {progress.current}
        {progress.max !== undefined && `/${progress.max}`}
      </span>
    </div>
  );
}

interface ThreadChangeSummaryProps {
  thread: ThreadChange;
}

function ThreadChangeSummary({ thread }: ThreadChangeSummaryProps) {
  const stateClass = thread.to.toLowerCase() === "closed" ? "thread-closed" : "thread-open";

  return (
    <div className="thread-change-summary">
      <span className="thread-name">{thread.name}:</span>
      <span className={`thread-state ${stateClass}`}>{thread.to}</span>
    </div>
  );
}
