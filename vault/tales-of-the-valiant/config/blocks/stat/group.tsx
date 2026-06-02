import * as React from "react";
import { EntityBlock, StatblockGroup, mapGroup } from "rpg-ui-toolkit";
import type { StatEntity, StatGroupData } from "../../entities/stat.types";

const group: EntityBlock<StatGroupData, StatEntity> = ({ self }) => {
  const data = React.useMemo(
    () => mapGroup(self as unknown as Record<string, unknown>),
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
    <StatblockGroup
      name={name}
      subtitle={data.subtitle}
      habitat={data.habitat}
      treasure={data.treasure}
      body={data.text}
      sourcePath={activeFile?.path}
    />
  );
};

export default group;
