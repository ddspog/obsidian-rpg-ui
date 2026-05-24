import * as React from "react";
import { EntityBlock, StatblockVehicle, resolveStatFeatures } from "rpg-ui-toolkit";
import type { StatEntity, StatVehicleData, ResolvedStatFeature } from "../../entities/stat.types";

const vehicle: EntityBlock<StatVehicleData, StatEntity> = ({ self }) => {
  const [resolved, setResolved] = React.useState<ResolvedStatFeature[]>([]);

  React.useEffect(() => {
    if (!self.features || self.features.length === 0) {
      setResolved([]);
      return;
    }

    let cancelled = false;
    const app = (
      globalThis as unknown as {
        app?: { workspace?: { getActiveFile?: () => { path?: string } | null } };
      }
    ).app;
    const sourcePath = app?.workspace?.getActiveFile?.()?.path ?? "";

    const selfProps: Record<string, unknown> = {
      name: self.name ? String(self.name).toLowerCase() : "",
      size: self.size,
      type: self.type,
      dimensions: self.dimensions,
    };

    resolveStatFeatures(self.features, sourcePath, selfProps).then(
      (results: ResolvedStatFeature[]) => {
        if (!cancelled) setResolved(results);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [self.features, self.name]);

  return (
    <StatblockVehicle
      name={self.name}
      size={self.size}
      type={self.type}
      dimensions={self.dimensions}
      stats={self.stats ?? {}}
      abilities={self.abilities ?? { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }}
      features={resolved}
      body={self.text}
      view={self.view}
    />
  );
};

export default vehicle;
