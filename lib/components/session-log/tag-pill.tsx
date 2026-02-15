/**
 * Tag Pill Component
 * Renders inline tags from Lonelog entries (NPC, Location, Clock, etc.)
 */

import * as React from "react";
import type { PersistentTag } from "lib/domains/lonelog/types";

export interface TagPillProps {
  tag: PersistentTag;
  onClick?: () => void;
}

export function TagPill({ tag, onClick }: TagPillProps) {
  const getTagClass = (): string => {
    const classes = ["lonelog-tag-pill", `tag-${tag.kind}`];
    if (onClick) {
      classes.push("clickable");
    }
    return classes.join(" ");
  };

  const getTagContent = (): string => {
    switch (tag.kind) {
      case "npc":
        return `${tag.ref ? "#" : ""}${tag.name}${tag.tags.length > 0 ? ` (${tag.tags.join(", ")})` : ""}`;

      case "location":
        return `📍 ${tag.name}${tag.tags.length > 0 ? ` (${tag.tags.join(", ")})` : ""}`;

      case "pc":
        return `${tag.name}${tag.changes.length > 0 ? `: ${tag.changes.join(", ")}` : ""}`;

      case "clock":
      case "event":
      case "track":
        return `${tag.name} ${tag.current}/${tag.max}`;

      case "timer":
        return `⏱ ${tag.name}: ${tag.value}`;

      case "thread":
        return `🧵 ${tag.name}: ${tag.state}`;

      default:
        return "";
    }
  };

  const getProgressBar = (): React.ReactNode => {
    if (
      tag.kind === "clock" ||
      tag.kind === "event" ||
      tag.kind === "track"
    ) {
      const percentage = (tag.current / tag.max) * 100;
      return (
        <div className="tag-progress-bar">
          <div
            className="tag-progress-fill"
            style={{ width: `${percentage}%` }}
          />
        </div>
      );
    }
    return null;
  };

  return (
    <span className={getTagClass()} onClick={onClick}>
      <span className="tag-content">{getTagContent()}</span>
      {getProgressBar()}
    </span>
  );
}

export interface TagPillListProps {
  tags: PersistentTag[];
  onTagClick?: (tag: PersistentTag) => void;
}

export function TagPillList({ tags, onTagClick }: TagPillListProps) {
  if (tags.length === 0) return null;

  return (
    <div className="lonelog-tag-pills">
      {tags.map((tag, index) => (
        <TagPill
          key={index}
          tag={tag}
          onClick={onTagClick ? () => onTagClick(tag) : undefined}
        />
      ))}
    </div>
  );
}
