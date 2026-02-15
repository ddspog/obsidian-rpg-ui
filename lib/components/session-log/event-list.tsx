/**
 * Event List Component
 * Renders parsed LonelogEntry[] as styled cards
 */

import * as React from "react";
import type { LonelogEntry } from "lib/domains/lonelog/types";
import { SceneHeader } from "./scene-header";
import { TagPillList } from "./tag-pill";

export interface EventListProps {
  entries: LonelogEntry[];
  onTagClick?: (tag: any) => void;
}

export function EventList({ entries, onTagClick }: EventListProps) {
  return (
    <div className="lonelog-event-list">
      {entries.map((entry, index) => (
        <EventCard key={index} entry={entry} onTagClick={onTagClick} />
      ))}
    </div>
  );
}

interface EventCardProps {
  entry: LonelogEntry;
  onTagClick?: (tag: any) => void;
}

function EventCard({ entry, onTagClick }: EventCardProps) {
  switch (entry.type) {
    case "scene":
      return <SceneHeader scene={entry} />;

    case "action":
      return (
        <div className="lonelog-event-card event-action">
          <span className="event-symbol">@</span>
          <span className="event-text">{entry.text}</span>
        </div>
      );

    case "oracle_question":
      return (
        <div className="lonelog-event-card event-oracle-question">
          <span className="event-symbol">?</span>
          <span className="event-text">{entry.text}</span>
        </div>
      );

    case "oracle_answer":
      return (
        <div className="lonelog-event-card event-oracle-answer">
          <span className="event-symbol">→</span>
          <span className="event-text">
            {entry.text}
            {entry.roll && <span className="oracle-roll"> ({entry.roll})</span>}
          </span>
        </div>
      );

    case "roll":
      return (
        <div className={`lonelog-event-card event-roll ${entry.success !== undefined ? (entry.success ? "roll-success" : "roll-failure") : ""}`}>
          <span className="event-symbol">🎲</span>
          <span className="roll-expression">{entry.roll}</span>
          {entry.result && (
            <>
              <span className="roll-arrow">→</span>
              <span className="roll-result">{entry.result}</span>
            </>
          )}
        </div>
      );

    case "consequence":
      return (
        <div className="lonelog-event-card event-consequence">
          <span className="event-symbol">⇒</span>
          <div className="consequence-content">
            <span className="event-text">{entry.text}</span>
            <TagPillList tags={entry.tags} onTagClick={onTagClick} />
          </div>
        </div>
      );

    case "dialogue":
      return (
        <div className="lonelog-event-card event-dialogue">
          <span className="dialogue-speaker">{entry.speaker}:</span>
          <span className="dialogue-text">"{entry.text}"</span>
        </div>
      );

    case "table_roll":
      return (
        <div className="lonelog-event-card event-table-roll">
          <span className="event-symbol">📊</span>
          <span className="table-source">{entry.source}</span>
          <span className="table-roll">{entry.roll}</span>
          <span className="table-result">→ {entry.result}</span>
        </div>
      );

    case "generator":
      return (
        <div className="lonelog-event-card event-generator">
          <span className="event-symbol">⚙️</span>
          <span className="gen-source">{entry.source}:</span>
          <span className="gen-result">{entry.result}</span>
        </div>
      );

    case "meta_note":
      return (
        <div className="lonelog-event-card event-meta-note">
          <span className="note-text">(note: {entry.text})</span>
        </div>
      );

    case "narrative":
      return (
        <div className="lonelog-event-card event-narrative">
          <span className="narrative-text">{entry.text}</span>
        </div>
      );

    default:
      return null;
  }
}
