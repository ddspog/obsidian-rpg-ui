import * as React from "react";
import { EntityBlock, StatblockCategory, mapCategory } from "rpg-ui-toolkit";
import type { StatEntity, StatCategoryData } from "../../entities/stat.types";

const category: EntityBlock<StatCategoryData, StatEntity> = ({ self }) => {
  const data = React.useMemo(
    () => mapCategory(self as unknown as Record<string, unknown>),
    [self]
  );

  const app = (
    globalThis as unknown as {
      app?: { workspace?: { getActiveFile?: () => { path?: string; basename?: string } | null } };
    }
  ).app;
  const activeFile = app?.workspace?.getActiveFile?.();
  const name = data.name || activeFile?.basename || "";

  return (
    <StatblockCategory
      name={name}
      subtitle={data.subtitle}
      habitat={data.habitat}
      treasure={data.treasure}
      body={data.text}
      sourcePath={activeFile?.path}
    />
  );
};

export default category;
