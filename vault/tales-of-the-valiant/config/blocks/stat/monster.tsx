import * as React from "react";
import { EntityBlock, StatblockMonster, mapMonster, resolveStatFeatures } from "rpg-ui-toolkit";
import type { StatEntity, StatMonsterData, ResolvedStatFeature } from "../../entities/stat.types";

const monster: EntityBlock<StatMonsterData, StatEntity> = (props) => {
  const { self } = props;
  // `sourcePath` (the file this fence lives in) is supplied at runtime by the
  // fence processor but isn't part of the typed ComponentProps — read via cast.
  const propSourcePath = (props as unknown as { sourcePath?: string }).sourcePath;

  // Creature notes keep their statblock data as flat frontmatter keys, so
  // `self` is the raw frontmatter (merged with any fence YAML) — map it into
  // the structured shape the card renders.
  const data = React.useMemo(() => mapMonster(self as unknown as Record<string, unknown>), [self]);
  const [resolved, setResolved] = React.useState<ResolvedStatFeature[]>([]);

  const app = (
    globalThis as unknown as {
      app?: { workspace?: { getActiveFile?: () => { path?: string; basename?: string } | null } };
    }
  ).app;
  const activeFile = app?.workspace?.getActiveFile?.();
  // The file this fence lives in — used for both the title fallback and the
  // base path for feature-link resolution. In a `.bare()` import the active
  // file is the host note, so prefer the supplied sourcePath over it.
  const filePath = propSourcePath || activeFile?.path || "";
  const fileBasename = filePath
    ? filePath
        .split("/")
        .pop()
        ?.replace(/\.[^./]+$/, "")
    : undefined;
  const name = data.name || fileBasename || activeFile?.basename || "";

  React.useEffect(() => {
    if (!data.features || data.features.length === 0) {
      setResolved([]);
      return;
    }
    let cancelled = false;
    const selfProps: Record<string, unknown> = {
      name: name.toLowerCase(),
      type: data.type,
      cr: data.cr,
      abilities: data.abilities,
      stats: data.stats,
    };
    resolveStatFeatures(data.features, filePath, selfProps).then((results: ResolvedStatFeature[]) => {
      if (!cancelled) setResolved(results);
    });
    return () => {
      cancelled = true;
    };
  }, [data, name, filePath]);

  return (
    <StatblockMonster
      name={name}
      type={data.type}
      cr={data.cr}
      habitat={data.habitat}
      treasure={data.treasure}
      category={data.category}
      image={typeof data.image === "string" ? data.image : undefined}
      stats={data.stats}
      abilities={data.abilities}
      features={resolved}
      body={data.text}
    />
  );
};

export default monster;
