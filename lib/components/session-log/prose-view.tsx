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
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun, Swords, Thermometer, Wind } from "lucide-react";
import { weatherSky, type WeatherSky } from "lib/domains/hexmap/terrain";
import type { SceneWeather } from "lib/domains/session-log/travel";
import { actorLabel } from "lib/domains/session-log/prose-model";
import type { ProseFragment, ProseScene, ProseNode } from "lib/domains/session-log/prose-model";
import { combatTrailKey, headTrailKey, nodeTrailKey, TRAIL_START } from "lib/domains/session-log/log-trails";

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
  /** A journey's map, drawn where it starts (`startId`: its `[TRAVEL]`). */
  renderTravelMap?: (startId: number) => React.ReactNode;
  /** The Log mixed into the prose: what goes at a place (`log-trails.ts` keys), drawn after it. */
  renderTrail?: (key: string) => React.ReactNode;
  /** The weather of each scene (by index), drawn behind its heading. */
  sceneWeather?: Array<SceneWeather | null>;
}

const SKY_ICON: Record<WeatherSky, typeof Sun> = {
  storm: CloudLightning,
  snow: CloudSnow,
  rain: CloudRain,
  fog: CloudFog,
  wind: Wind,
  cloud: Cloud,
  heat: Thermometer,
  clear: Sun,
};

/** A scene's weather, at the end of its heading: what it is, and what it was when the scene changed it. */
function SceneWeatherLabel({ weather }: { weather: SceneWeather }) {
  const sky = weatherSky(weather.parts);
  const Icon = sky ? SKY_ICON[sky.sky] : Cloud;
  const was = weather.from ? (weatherSky(weather.from)?.word ?? weather.from[weather.from.length - 1]) : null;
  const now = weather.parts.join(" · ");
  const title = weather.changed
    ? `The weather changes in this scene${weather.from ? `: was ${weather.from.join(" · ")}` : ""}; now ${now}`
    : `The weather carried into this scene: ${now}`;
  return (
    <span className={`lonelog-scene-weather${weather.changed ? " is-change" : ""}`} title={title}>
      <Icon className="lonelog-scene-weather-icon" size={15} aria-hidden="true" />
      {weather.changed && was && <span className="lonelog-scene-weather-was">{was} →</span>}
      <span className="lonelog-scene-weather-now">{now}</span>
    </span>
  );
}

/** A stable hue (0-359) for a speaker's name, so each voice keeps its own colour through the log. */
function speakerHue(name: string): number {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
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
  renderTravelMap,
  renderTrail,
  sceneWeather,
}: ProseViewProps) {
  if (scenes.length === 0) {
    return (
      <>
        <div className="lonelog-prose-empty">Nothing to narrate yet.</div>
        {renderTrail?.(TRAIL_START)}
      </>
    );
  }

  return (
    <div className="lonelog-prose-doc">
      {renderTrail?.(TRAIL_START)}
      {scenes.map((scene, si) => {
        const weather = sceneWeather?.[si] ?? null;
        const sky = weather ? weatherSky(weather.parts)?.sky : undefined;
        return (
          <section className="lonelog-prose-scene" key={si}>
            {scene.head && (
              <h4
                className={`lonelog-prose-scene-head${weather ? " has-weather" : ""}${weather?.changed ? " is-weather-change" : ""}`}
                {...(sky ? { "data-sky": sky } : {})}
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
                {weather && <SceneWeatherLabel weather={weather} />}
              </h4>
            )}
            {scene.head && renderTrail?.(headTrailKey(si))}
            {scene.nodes.map((node, ni) => (
              <React.Fragment key={ni}>
                <ProseNodeView
                  node={node}
                  sourcePath={sourcePath}
                  selectedId={selectedId}
                  onSelectSource={onSelectSource}
                  registerAnchor={registerAnchor}
                  {...(renderTurnMap ? { renderTurnMap } : {})}
                  {...(onSelectStep ? { onSelectStep } : {})}
                  {...(partyName ? { partyName } : {})}
                  {...(renderTravelMap ? { renderTravelMap } : {})}
                  {...(renderTrail && node.kind === "combat" ? { renderTrail, trailAt: [si, ni] as const } : {})}
                />
                {/* A fight draws its own runs, inside it. */}
                {node.kind !== "combat" && renderTrail?.(nodeTrailKey(si, ni))}
              </React.Fragment>
            ))}
          </section>
        );
      })}
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
  renderTravelMap?: (startId: number) => React.ReactNode;
  /** A fight's Log runs (the Log mixed into the prose), and where the fight is: scene, node. */
  renderTrail?: (key: string) => React.ReactNode;
  trailAt?: readonly [number, number];
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

/** A fight's nodes, its consecutive actions gathered into one list; with the Log mixed in, each turn and
 *  action has its run of entries right under it. */
function CombatView({
  node,
  renderTrail,
  trailAt,
  ...props
}: NodeViewProps & { node: Extract<ProseNode, { kind: "combat" }> }) {
  type Beat = Extract<ProseNode, { kind: "beat" }>;
  // Each inner node with its index in the fight, which keys its Log run.
  const runs: Array<{ node: ProseNode; k: number } | Array<{ beat: Beat; k: number }>> = [];
  node.nodes.forEach((n, k) => {
    const last = runs[runs.length - 1];
    if (n.kind === "beat" && Array.isArray(last)) last.push({ beat: n, k });
    else runs.push(n.kind === "beat" ? [{ beat: n, k }] : { node: n, k });
  });
  const trail = (k: number) => (renderTrail && trailAt ? renderTrail(combatTrailKey(trailAt[0], trailAt[1], k)) : null);
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
      {renderTrail && trailAt && renderTrail(nodeTrailKey(trailAt[0], trailAt[1]))}
      {runs.map((run, i) =>
        Array.isArray(run) ? (
          <dl key={i} className="lonelog-prose-beats">
            {run.map(({ beat, k }) => (
              <div
                key={k}
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
                  {/* Its rolls, right under it (a click there is the Log's, not the map's). */}
                  {renderTrail && (
                    <div className="lonelog-prose-beat-trail" onClick={(e) => e.stopPropagation()}>
                      {trail(k)}
                    </div>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : run.node.kind === "turn" ? (
          // Each turn opens on the map: the fight as it stands in that turn.
          <React.Fragment key={i}>
            {props.renderTurnMap?.(run.node.sourceId, run.node.sourceId === firstTurn ? headSlot : undefined)}
            <ProseNodeView node={run.node} {...props} />
            {trail(run.k)}
          </React.Fragment>
        ) : (
          <React.Fragment key={i}>
            <ProseNodeView node={run.node} {...props} />
            {trail(run.k)}
          </React.Fragment>
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

    case "travel":
      return (
        // No line of its own: the minimap shows the journey. Only where it starts, for the reading position.
        <span className="lonelog-travel-anchor" ref={(el) => registerAnchor(node.sourceId, el)} />
      );

    case "arrival":
      // A journey's end: when, how far and long, what came of it.
      return (
        <aside className="lonelog-travel-arrival" ref={(el) => registerAnchor(node.sourceId, el)}>
          <header>
            <span className="lonelog-travel-arrival-key">Arrived</span>
            {node.arrive && <strong>{node.arrive}</strong>}
          </header>
          {node.stats.length > 0 && (
            <ul className="lonelog-travel-stats">
              {node.stats.map((st, i) => (
                <li key={i}>{st}</li>
              ))}
            </ul>
          )}
          {node.outcome && (
            <Markdown source={node.outcome} sourcePath={sourcePath} className="lonelog-travel-outcome" />
          )}
        </aside>
      );

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
      <span className="lonelog-balloon-speaker" style={{ "--speaker-hue": speakerHue(speaker) } as React.CSSProperties}>
        {speaker}
      </span>
      <InlineMarkdown source={text} sourcePath={sourcePath} className="lonelog-balloon-text" />
    </div>
  );
}
