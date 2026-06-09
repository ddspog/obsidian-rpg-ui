/**
 * Prose View
 *
 * The default reading mode for an `rpg log` block. Renders scenes of narration
 * and dialogue, showing only the `=>` conclusions of lonelog actions (each
 * marked with a clickable provenance dot) and rendering `[[wikilinks]]` through
 * Obsidian's markdown renderer. The mechanical machinery (rolls, oracles,
 * tables, markers) is hidden here and lives in the sidebar / mechanical mode.
 */

import * as React from "react";
import { Markdown } from "lib/components/markdown";
import { InlineMarkdown } from "./inline-markdown";
import { laneForSpeaker } from "lib/domains/session-log/prose-model";
import type { ProseScene, ProseNode } from "lib/domains/session-log/prose-model";

export interface ProseViewProps {
  scenes: ProseScene[];
  sourcePath: string;
  /** Currently highlighted provenance id (or null). */
  selectedId: number | null;
  /** A provenance dot was clicked — open the sidebar and select this id. */
  onSelectSource: (id: number) => void;
  /** Register a prose element as the scroll target for a provenance id. */
  registerAnchor: (id: number, el: HTMLElement | null) => void;
}

export function ProseView({ scenes, sourcePath, selectedId, onSelectSource, registerAnchor }: ProseViewProps) {
  if (scenes.length === 0) {
    return <div className="lonelog-prose-empty">Nothing to narrate yet.</div>;
  }

  return (
    <div className="lonelog-prose-doc">
      {scenes.map((scene, si) => (
        <section className="lonelog-prose-scene" key={si}>
          {scene.head && (
            <h4
              className="lonelog-prose-scene-head"
              ref={scene.head.sourceId != null ? (el) => registerAnchor(scene.head!.sourceId!, el) : undefined}
            >
              <span className="lonelog-prose-scene-id">{scene.head.number}</span>
              <span className="lonelog-prose-scene-title">{scene.head.context}</span>
              {scene.head.fromConsequence && scene.head.sourceId != null && (
                <ProseDot
                  id={scene.head.sourceId}
                  selected={selectedId === scene.head.sourceId}
                  onClick={onSelectSource}
                />
              )}
            </h4>
          )}
          {scene.nodes.map((node, ni) => (
            <ProseNodeView
              key={ni}
              node={node}
              sourcePath={sourcePath}
              selectedId={selectedId}
              onSelectSource={onSelectSource}
              registerAnchor={registerAnchor}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function ProseNodeView({
  node,
  sourcePath,
  selectedId,
  onSelectSource,
  registerAnchor,
}: {
  node: ProseNode;
  sourcePath: string;
  selectedId: number | null;
  onSelectSource: (id: number) => void;
  registerAnchor: (id: number, el: HTMLElement | null) => void;
}) {
  switch (node.kind) {
    case "paragraph":
      return (
        <p className="lonelog-conclusion">
          {node.fragments.map((frag, i) => (
            <React.Fragment key={i}>
              {i > 0 && " "}
              <span className="lonelog-fragment" ref={(el) => registerAnchor(frag.sourceId, el)}>
                <InlineMarkdown source={frag.text} sourcePath={sourcePath} className="lonelog-md-inline" />
                <ProseDot id={frag.sourceId} selected={selectedId === frag.sourceId} onClick={onSelectSource} />
              </span>
            </React.Fragment>
          ))}
        </p>
      );

    case "narration":
      return <Markdown source={node.text} sourcePath={sourcePath} className="lonelog-prose-narration" />;

    case "dialogue":
      return (
        <DialogueBalloon
          speaker={node.speaker}
          speakerType={node.speakerType}
          text={node.text}
          sourcePath={sourcePath}
        />
      );

    default:
      return null;
  }
}

function ProseDot({ id, selected, onClick }: { id: number; selected: boolean; onClick: (id: number) => void }) {
  return (
    <button
      type="button"
      className={`lonelog-dot ${selected ? "is-selected" : ""}`}
      aria-label="Show the source action for this passage"
      onClick={(e) => {
        e.preventDefault();
        onClick(id);
      }}
    />
  );
}

function DialogueBalloon({
  speaker,
  speakerType,
  text,
  sourcePath,
}: {
  speaker: string;
  speakerType: "pc" | "npc";
  text: string;
  sourcePath: string;
}) {
  const lane = laneForSpeaker(speaker);
  return (
    <div className={`lonelog-balloon lonelog-balloon-${speakerType}`} style={{ "--lane": lane } as React.CSSProperties}>
      <span className="lonelog-balloon-speaker">{speaker}</span>
      <InlineMarkdown source={text} sourcePath={sourcePath} className="lonelog-balloon-text" />
    </div>
  );
}
