import * as React from "react";
import { EntityBlock, StatblockCategory, mapCategory } from "rpg-ui-toolkit";
import type { StatEntity, StatCategoryData } from "../../entities/stat.types";

const category: EntityBlock<StatCategoryData, StatEntity> = (props) => {
  const { self } = props;
  // `sourcePath` (the file this fence lives in) is supplied at runtime by the
  // fence processor but isn't part of the typed ComponentProps — read it via a
  // cast, the same way this file reads `app` off globalThis below.
  const sourcePath = (props as unknown as { sourcePath?: string }).sourcePath;

  const data = React.useMemo(() => mapCategory(self as unknown as Record<string, unknown>), [self]);

  const app = (
    globalThis as unknown as {
      app?: { workspace?: { getActiveFile?: () => { path?: string; basename?: string } | null } };
    }
  ).app;
  const activeFile = app?.workspace?.getActiveFile?.();
  // Title precedence: head `name:` wins; otherwise the RENDERED file's basename
  // (correct even when imported into a host note via `.bare()`, where the
  // active file is the host); the active file is only a last resort.
  const fileBasename = sourcePath
    ? sourcePath
        .split("/")
        .pop()
        ?.replace(/\.[^./]+$/, "")
    : undefined;
  const name = data.name || fileBasename || activeFile?.basename || "";

  return (
    <StatblockCategory
      name={name}
      level={data.level}
      subtitle={data.subtitle}
      habitat={data.habitat}
      treasure={data.treasure}
      body={data.text}
      sourcePath={sourcePath ?? activeFile?.path}
    />
  );
};

export default category;
