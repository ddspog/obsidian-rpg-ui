/**
 * Scene Header Component
 * Renders scene markers with variant styles for flashbacks, parallel threads, and montages
 */

import * as React from "react";
import type { SceneEntry } from "lib/domains/lonelog/types";

export interface SceneHeaderProps {
  scene: SceneEntry;
}

export function SceneHeader({ scene }: SceneHeaderProps) {
  const getSceneVariant = (): string => {
    const number = scene.number;

    // Flashback: S1a, S2b, etc.
    if (/^S\d+[a-z]$/i.test(number)) {
      return "flashback";
    }

    // Parallel thread: T1-S1, T2-S3, etc.
    if (/^T\d+-S\d+/.test(number)) {
      return "parallel";
    }

    // Montage: S1.1, S1.2, etc.
    if (/^S\d+\.\d+$/.test(number)) {
      return "montage";
    }

    // Sequential: S1, S2, S3
    return "sequential";
  };

  const variant = getSceneVariant();

  return (
    <div className={`lonelog-scene-header scene-${variant}`}>
      <div className="scene-number">{scene.number}</div>
      {scene.context && (
        <div className="scene-context">{scene.context}</div>
      )}
    </div>
  );
}
