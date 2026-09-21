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

      case "foe":
        return `${tag.name}${tag.tags.length > 0 ? ` (${tag.tags.join(", ")})` : ""}`;

      case "clock":
      case "event":
      case "track":
        return `${tag.name} ${tag.current}/${tag.max}`;

      case "dial":
        return `${tag.name} ${tag.current} (${tag.min}–${tag.max})`;

      case "timer":
        return `${tag.name}: ${tag.value}`;

      case "thread":
        return `${tag.name}: ${tag.state}`;

      case "inventory": {
        if (tag.ref) return `#${tag.name}`;
        if (tag.delta != null) return `${tag.name} ${tag.delta > 0 ? "+" : ""}${tag.delta}`;
        if (tag.transition) return `${tag.name} ${tag.transition.from}→${tag.transition.to}`;
        if (tag.depleted) return `${tag.name} (depleted)`;
        const qty = tag.quantity != null ? `×${tag.quantity}` : "";
        const props = tag.props.length > 0 ? ` (${tag.props.join(", ")})` : "";
        return `${tag.name}${qty}${props}`;
      }

      case "wealth": {
        if (tag.delta != null) return `${tag.currency} ${tag.delta > 0 ? "+" : ""}${tag.delta}`;
        if (tag.transition) return `${tag.currency} ${tag.transition.from}→${tag.transition.to}`;
        if (tag.amount != null) return `${tag.currency}: ${tag.amount}`;
        return tag.currency;
      }

      case "room": {
        if (tag.ref) return `#R${tag.id}`;
        const status = tag.status ? ` ${tag.status}` : "";
        const desc = tag.description ? ` — ${tag.description}` : "";
        return `R${tag.id}${status}${desc}`;
      }

      default:
        return "";
    }
  };

  const getProgressBar = (): React.ReactNode => {
    if (tag.kind === "clock" || tag.kind === "event" || tag.kind === "track") {
      const percentage = (tag.current / tag.max) * 100;
      return (
        <div className="tag-progress-bar">
          <div className="tag-progress-fill" style={{ width: `${percentage}%` }} />
        </div>
      );
    }
    if (tag.kind === "dial") {
      const span = tag.max - tag.min;
      const percentage = span > 0 ? Math.max(0, Math.min(100, ((tag.current - tag.min) / span) * 100)) : 0;
      return (
        <div className="tag-progress-bar tag-progress-bar--dial">
          <div className="tag-progress-fill" style={{ width: `${percentage}%` }} />
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
        <TagPill key={index} tag={tag} onClick={onTagClick ? () => onTagClick(tag) : undefined} />
      ))}
    </div>
  );
}
