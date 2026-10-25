/**
 * Prose View
 *
 * The default reading mode for an `rpg log` block. Renders scenes of narration
 * and dialogue, showing only the `=>` conclusions of lonelog actions (each
 * marked with a clickable provenance dot) and rendering `[[wikilinks]]` through
 * Obsidian's markdown renderer. The mechanical machinery (rolls, oracles,
 * tables, markers) is hidden here and lives in the sidebar / mechanical mode.
 *
 * A fight is told as a section of its own: its turns (`Turn 2`), and each
 * action beside the creature who took it.
 */

import * as React from "react";
import { Markdown } from "lib/components/markdown";
import { InlineMarkdown } from "./inline-markdown";
import { Swords } from "lucide-react";
import { actorLabel } from "lib/domains/session-log/prose-model";
import type { ProseFragment, ProseScene, ProseNode } from "lib/domains/session-log/prose-model";

export interface ProseViewProps {
  scenes: ProseScene[];
  sourcePath: string;
  /** Currently highlighted provenance id (or null). */
  selectedId: number | null;
  /** A provenance dot was clicked — open the sidebar and select this id. */
  onSelectSource: (id: number) => void;
  /** Register a prose element as the scroll target for a provenance id. */
  registerAnchor: (id: number, el: HTMLElement | null) => void;
  /** A fight's map for one turn, drawn before it (`turnId`: the turn's marker). */
  renderTurnMap?: (turnId: number, headInto?: HTMLElement | null) => React.ReactNode;
  /** An action in a fight was clicked: go to it — the map moves there. */
  onSelectStep?: (id: number) => void;
  /** A party member's name as the log knows them (`Talon Pallton` → `Talon`). */
  partyName?: (actor: string) => string | undefined;
}

export function ProseView({
  scenes,
  sourcePath,
  selectedId,
  onSelectSource,
  registerAnchor,
  renderTurnMap,
  onSelectStep,
  partyName,
}: ProseViewProps) {
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
                  label={`Show the source of scene ${scene.head.number}: ${scene.head.context}`}
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
              {...(renderTurnMap ? { renderTurnMap } : {})}
              {...(onSelectStep ? { onSelectStep } : {})}
              {...(partyName ? { partyName } : {})}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

interface NodeViewProps {
  sourcePath: string;
  selectedId: number | null;
  onSelectSource: (id: number) => void;
  registerAnchor: (id: number, el: HTMLElement | null) => void;
  renderTurnMap?: (turnId: number, headInto?: HTMLElement | null) => React.ReactNode;
  onSelectStep?: (id: number) => void;
  partyName?: (actor: string) => string | undefined;
}

/** A run of conclusions, each with its provenance dot. */
function Fragments({
  fragments,
  sourcePath,
  selectedId,
  onSelectSource,
  registerAnchor,
}: NodeViewProps & { fragments: ProseFragment[] }) {
  return (
    <>
      {fragments.map((frag, i) => (
        <React.Fragment key={i}>
          {i > 0 && " "}
          <span className="lonelog-fragment" ref={(el) => registerAnchor(frag.sourceId, el)}>
            <InlineMarkdown source={frag.text} sourcePath={sourcePath} className="lonelog-md-inline" />
            <ProseDot
              id={frag.sourceId}
              label={`Show the source behind: ${snippet(frag.text)}`}
              selected={selectedId === frag.sourceId}
              onClick={onSelectSource}
            />
          </span>
        </React.Fragment>
      ))}
    </>
  );
}

/** A fight's nodes, its consecutive actions gathered into one list. */
function CombatView({ node, ...props }: NodeViewProps & { node: Extract<ProseNode, { kind: "combat" }> }) {
  const runs: Array<ProseNode | Array<Extract<ProseNode, { kind: "beat" }>>> = [];
  for (const n of node.nodes) {
    const last = runs[runs.length - 1];
    if (n.kind === "beat" && Array.isArray(last)) last.push(n);
    else runs.push(n.kind === "beat" ? [n] : n);
  }
  // The fight's first map titles itself on this header line (`Combat · Map
  // Clearing … Setup`), rather than on a line of its own.
  const [headSlot, setHeadSlot] = React.useState<HTMLElement | null>(null);
  const firstTurn = node.nodes.find((n) => n.kind === "turn")?.sourceId;
  return (
    <section className="lonelog-prose-combat" aria-label="Combat">
      <header className="lonelog-prose-combat-head">
        <Swords size={14} aria-hidden="true" /> Combat
        <span className="lonelog-prose-combat-map" ref={setHeadSlot} />
      </header>
      {runs.map((run, i) =>
        Array.isArray(run) ? (
          <dl key={i} className="lonelog-prose-beats">
            {run.map((beat, j) => (
              <div
                key={j}
                className={`lonelog-prose-beat${props.onSelectStep ? " is-steppable" : ""}`}
                // A click shows it on the turn's map. (Keyboard users step the map
                // with its replay buttons; the passage's dot is a real button.)
                {...(props.onSelectStep ? { onClick: () => props.onSelectStep!(beat.fragments[0].sourceId) } : {})}
              >
                <dt className="lonelog-prose-actor" title={beat.actor.replace(/\[\[|\]\]/g, "")}>
                  {props.partyName?.(beat.actor) ?? actorLabel(beat.actor)}
                </dt>
                <dd className="lonelog-conclusion">
                  <Fragments fragments={beat.fragments} {...props} />
                </dd>
              </div>
            ))}
          </dl>
        ) : run.kind === "turn" ? (
          // Each turn opens on the map: the fight as it stands in that turn.
          <React.Fragment key={i}>
            {props.renderTurnMap?.(run.sourceId, run.sourceId === firstTurn ? headSlot : undefined)}
            <ProseNodeView node={run} {...props} />
          </React.Fragment>
        ) : (
          <ProseNodeView key={i} node={run} {...props} />
        )
      )}
    </section>
  );
}

function ProseNodeView({ node, ...props }: NodeViewProps & { node: ProseNode }) {
  const { sourcePath, registerAnchor } = props;
  switch (node.kind) {
    case "paragraph":
      return (
        <p className="lonelog-conclusion">
          <Fragments fragments={node.fragments} {...props} />
        </p>
      );

    case "combat":
      return <CombatView node={node} {...props} />;

    case "turn":
      return (
        <h5 className="lonelog-prose-turn" ref={(el) => registerAnchor(node.sourceId, el)}>
          Turn {node.number}
        </h5>
      );

    case "beat":
      return (
        <dl className="lonelog-prose-beats">
          <div className="lonelog-prose-beat">
            <dt className="lonelog-prose-actor">{props.partyName?.(node.actor) ?? actorLabel(node.actor)}</dt>
            <dd className="lonelog-conclusion">
              <Fragments fragments={node.fragments} {...props} />
            </dd>
          </div>
        </dl>
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

/** The first few words of a passage, for a dot's label (markup stripped). */
function snippet(text: string): string {
  const words = text
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/[*_`~]/g, "")
    .trim()
    .split(/\s+/);
  return words.slice(0, 6).join(" ") + (words.length > 6 ? "…" : "");
}

function ProseDot({
  id,
  label,
  selected,
  onClick,
}: {
  id: number;
  label: string;
  selected: boolean;
  onClick: (id: number) => void;
}) {
  return (
    <button
      type="button"
      className={`lonelog-dot ${selected ? "is-selected" : ""}`}
      aria-label={label}
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
  return (
    <div className={`lonelog-balloon lonelog-balloon-${speakerType}`}>
      <span className="lonelog-balloon-speaker">{speaker}</span>
      <InlineMarkdown source={text} sourcePath={sourcePath} className="lonelog-balloon-text" />
    </div>
  );
}
