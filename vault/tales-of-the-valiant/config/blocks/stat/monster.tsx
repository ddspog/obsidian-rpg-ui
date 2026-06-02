import * as React from "react";
import { EntityBlock, StatblockMonster, mapMonster, resolveStatFeatures } from "rpg-ui-toolkit";
import type { StatEntity, StatMonsterData, ResolvedStatFeature } from "../../entities/stat.types";

const monster: EntityBlock<StatMonsterData, StatEntity> = ({ self }) => {
  // Creature notes keep their statblock data as flat frontmatter keys, so
  // `self` is the raw frontmatter (merged with any fence YAML) — map it into
  // the structured shape the card renders.
  const data = React.useMemo(
    () => mapMonster(self as unknown as Record<string, unknown>),
    [self]
  );
  const [resolved, setResolved] = React.useState<ResolvedStatFeature[]>([]);

  const app = (
    globalThis as unknown as {
      app?: { workspace?: { getActiveFile?: () => { path?: string; basename?: string } | null } };
    }
  ).app;
  const activeFile = app?.workspace?.getActiveFile?.();
  const name = data.name || activeFile?.basename || "";

  React.useEffect(() => {
    if (!data.features || data.features.length === 0) {
      setResolved([]);
      return;
    }
    let cancelled = false;
    const sourcePath = activeFile?.path ?? "";
    const selfProps: Record<string, unknown> = {
      name: name.toLowerCase(),
      type: data.type,
      cr: data.cr,
      abilities: data.abilities,
      stats: data.stats,
    };
    resolveStatFeatures(data.features, sourcePath, selfProps).then(
      (results: ResolvedStatFeature[]) => {
        if (!cancelled) setResolved(results);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [data, name, activeFile?.path]);

  return (
    <StatblockMonster
      name={name}
      type={data.type}
      cr={data.cr}
      habitat={data.habitat}
      treasure={data.treasure}
      group={data.group}
      image={typeof data.image === "string" ? data.image : undefined}
      stats={data.stats}
      abilities={data.abilities}
      features={resolved}
      body={data.text}
    />
  );
};

export default monster;
