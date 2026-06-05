import * as React from "react";
import { useState } from "react";
import type { LonelogEntry, PersistentTag, RollEntry } from "lib/domains/lonelog/types";
import { groupIntoProse, type ProseSegment, summarizeRoll } from "lib/domains/session-log/prose-grouper";
import { SceneHeader } from "./scene-header";
import { TagPillList } from "./tag-pill";

export interface EventListProps {
  entries: LonelogEntry[];
  onTagClick?: (tag: PersistentTag) => void;
}

export function EventList({ entries, onTagClick }: EventListProps) {
  const segments = React.useMemo(() => groupIntoProse(entries), [entries]);

  return (
    <div className="lonelog-prose">
      {segments.map((seg, i) => (
        <ProseItem key={i} segment={seg} onTagClick={onTagClick} />
      ))}
    </div>
  );
}

function ProseItem({ segment, onTagClick }: { segment: ProseSegment; onTagClick?: (tag: PersistentTag) => void }) {
  switch (segment.type) {
    case "scene":
      return <SceneHeader scene={segment.entry} />;

    case "action-group":
      return <ActionGroup segment={segment} onTagClick={onTagClick} />;

    case "world-event":
      return <WorldEventGroup segment={segment} onTagClick={onTagClick} />;

    case "oracle":
      return <OracleGroup segment={segment} onTagClick={onTagClick} />;

    case "dialogue":
      return (
        <p className="lonelog-prose-line prose-dialogue">
          <span className={`prose-speaker prose-speaker-${segment.entry.speakerType}`}>
            {segment.entry.speaker}:
          </span>{" "}
          <em>&ldquo;{segment.entry.text}&rdquo;</em>
        </p>
      );

    case "narrative":
      return <p className="lonelog-prose-line prose-narrative"><em>{segment.entry.text}</em></p>;

    case "meta":
      return <p className="lonelog-prose-line prose-meta">{segment.entry.text}</p>;

    case "standalone-consequence":
      return (
        <p className="lonelog-prose-line prose-consequence">
          {segment.entry.text}
          {segment.entry.tags.length > 0 && <TagPillList tags={segment.entry.tags} onTagClick={onTagClick} />}
        </p>
      );

    case "standalone-roll":
      return <InlineRoll roll={segment.entry} />;

    case "combat-start":
      return <div className="lonelog-combat-marker combat-start" aria-label="Combat begins" />;

    case "combat-end":
      return <div className="lonelog-combat-marker combat-end" aria-label="Combat ends" />;

    case "resource-start":
      return <div className="lonelog-resource-marker resource-start" aria-label="Resources snapshot" />;

    case "resource-end":
      return <div className="lonelog-resource-marker resource-end" aria-label="End resources" />;

    case "dungeon-status-start":
      return <div className="lonelog-dungeon-marker dungeon-start" aria-label="Dungeon status" />;

    case "dungeon-status-end":
      return <div className="lonelog-dungeon-marker dungeon-end" aria-label="End dungeon status" />;

    case "round":
      return <div className="lonelog-round-marker">Round {segment.round}</div>;

    default:
      return null;
  }
}

function ActionGroup({
  segment,
  onTagClick,
}: {
  segment: Extract<ProseSegment, { type: "action-group" }>;
  onTagClick?: (tag: PersistentTag) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = segment.rolls.length > 0;
  const allTags = segment.consequences.flatMap((c) => c.tags);
  const consequenceText = segment.consequences.map((c) => c.text).filter(Boolean).join(" ");
  const { action } = segment;

  return (
    <div className="lonelog-prose-action">
      <p className="prose-action-text">
        <span className="prose-action-marker">@</span>
        {action.actor && <span className="prose-actor-name">{action.actor}</span>}
        {action.assist && <span className="prose-assist-name"> &gt; {action.assist}</span>}
        {action.actor && " "}
        {action.text}
        {hasDetails && (
          <button
            className={`prose-detail-toggle ${expanded ? "is-expanded" : ""}`}
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label="Show rolls"
          >
            {segment.rolls.map((r, i) => {
              const info = summarizeRoll(r);
              return (
                <span key={i} className={`prose-roll-chip ${info.success === true ? "chip-success" : info.success === false ? "chip-failure" : ""}`}>
                  {info.label} {r.result && <span className="chip-result">{r.result}</span>}
                </span>
              );
            })}
          </button>
        )}
      </p>
      {expanded && hasDetails && (
        <div className="prose-detail-block">
          {segment.rolls.map((r, i) => (
            <InlineRoll key={i} roll={r} />
          ))}
        </div>
      )}
      {consequenceText && (
        <p className="prose-consequence-text">
          {consequenceText}
          {allTags.length > 0 && <TagPillList tags={allTags} onTagClick={onTagClick} />}
        </p>
      )}
    </div>
  );
}

function WorldEventGroup({
  segment,
  onTagClick,
}: {
  segment: Extract<ProseSegment, { type: "world-event" }>;
  onTagClick?: (tag: PersistentTag) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasRolls = segment.rolls.length > 0;
  const allTags = [...segment.entry.tags, ...segment.consequences.flatMap((c) => c.tags)];
  const consequenceText = segment.consequences.map((c) => c.text).filter(Boolean).join(" ");

  return (
    <div className="lonelog-prose-world-event">
      <p className="prose-world-event-text">
        <span className="prose-world-event-marker">!</span>
        {segment.entry.text}
        {hasRolls && (
          <button
            className={`prose-detail-toggle ${expanded ? "is-expanded" : ""}`}
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label="Show rolls"
          >
            {segment.rolls.map((r, i) => {
              const info = summarizeRoll(r);
              return (
                <span key={i} className={`prose-roll-chip ${info.success === true ? "chip-success" : info.success === false ? "chip-failure" : ""}`}>
                  {r.actor && <span className="chip-actor">{r.actor} </span>}
                  {info.label} {r.result && <span className="chip-result">{r.result}</span>}
                </span>
              );
            })}
          </button>
        )}
      </p>
      {expanded && hasRolls && (
        <div className="prose-detail-block">
          {segment.rolls.map((r, i) => (
            <InlineRoll key={i} roll={r} />
          ))}
        </div>
      )}
      {consequenceText && (
        <p className="prose-consequence-text">
          {consequenceText}
          {allTags.length > 0 && <TagPillList tags={allTags} onTagClick={onTagClick} />}
        </p>
      )}
      {!consequenceText && allTags.length > 0 && (
        <TagPillList tags={allTags} onTagClick={onTagClick} />
      )}
    </div>
  );
}

function OracleGroup({
  segment,
  onTagClick,
}: {
  segment: Extract<ProseSegment, { type: "oracle" }>;
  onTagClick?: (tag: PersistentTag) => void;
}) {
  return (
    <div className="lonelog-prose-oracle">
      <p className="prose-oracle-question">
        <span className="prose-oracle-marker">?</span>
        {segment.question.actor && <span className="prose-actor-name">{segment.question.actor}</span>}
        {segment.question.actor && " "}
        {segment.question.text}
      </p>
      {segment.answer && (
        <p className="prose-oracle-answer">
          <span className="prose-oracle-arrow">&rarr;</span>
          {segment.answer.text}
          {segment.answer.roll && <span className="prose-oracle-roll">({segment.answer.roll})</span>}
        </p>
      )}
      {segment.consequence && (
        <p className="prose-consequence-text">
          {segment.consequence.text}
          {segment.consequence.tags.length > 0 && <TagPillList tags={segment.consequence.tags} onTagClick={onTagClick} />}
        </p>
      )}
    </div>
  );
}

function InlineRoll({ roll }: { roll: RollEntry }) {
  return (
    <span className={`prose-roll-inline ${roll.success === true ? "roll-success" : roll.success === false ? "roll-failure" : ""}`}>
      {roll.actor && <span className="roll-actor">{roll.actor}: </span>}
      {roll.label && <span className="roll-label">{roll.label} </span>}
      <code>{roll.roll}</code>
      {roll.total != null && <span className="roll-total">={roll.total}</span>}
      {roll.vsTarget && <span className="roll-vs"> vs {roll.vsTarget}</span>}
      {roll.result && <> &rarr; <strong>{roll.result}</strong></>}
    </span>
  );
}
