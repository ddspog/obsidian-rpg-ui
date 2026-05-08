import * as React from "react";
import type { EncumbranceBands, LoadState } from "lib/domains/inventory";
import { formatWeight } from "./ItemRow";

interface EncumbranceBarProps {
  total: number;
  bands: EncumbranceBands;
  load: LoadState;
}

/**
 * Segmented bar mirroring the reference statblock: four thresholds
 * (encumbered / heavy / carry / push) with the current load dot positioned
 * proportionally along the way.
 */
export function EncumbranceBar({ total, bands, load }: EncumbranceBarProps) {
  const max = bands.push || 1;
  const pct = (value: number) => Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <section className="rpg-inventory-block__encumbrance" data-load={load}>
      <h5 className="rpg-inventory-block__section-title">Encumbrance</h5>
      <div className="rpg-inventory-block__encumbrance-grid">
        <div className="rpg-inventory-block__encumbrance-cell">
          <span className="rpg-inventory-block__encumbrance-label">Total Wht.</span>
          <span className="rpg-inventory-block__encumbrance-value">
            {formatWeight(total)} lb.
          </span>
        </div>
        <div className="rpg-inventory-block__encumbrance-cell">
          <span className="rpg-inventory-block__encumbrance-label">Carry Capacity</span>
          <span className="rpg-inventory-block__encumbrance-value">
            {formatWeight(bands.encumbered)} lb. - {formatWeight(bands.heavy)} lb. -{" "}
            {formatWeight(bands.carry)} lb.
          </span>
        </div>
        <div className="rpg-inventory-block__encumbrance-cell">
          <span className="rpg-inventory-block__encumbrance-label">Max. Push Wgt.</span>
          <span className="rpg-inventory-block__encumbrance-value">
            {formatWeight(bands.push)} lb.
          </span>
        </div>
      </div>
      <div
        className="rpg-inventory-block__encumbrance-bar"
        role="progressbar"
        aria-valuenow={total}
        aria-valuemin={0}
        aria-valuemax={bands.push}
      >
        <div
          className="rpg-inventory-block__encumbrance-band"
          data-band="free"
          style={{ left: 0, width: `${pct(bands.encumbered)}%` }}
        />
        <div
          className="rpg-inventory-block__encumbrance-band"
          data-band="encumbered"
          style={{
            left: `${pct(bands.encumbered)}%`,
            width: `${pct(bands.heavy) - pct(bands.encumbered)}%`,
          }}
        />
        <div
          className="rpg-inventory-block__encumbrance-band"
          data-band="heavy"
          style={{
            left: `${pct(bands.heavy)}%`,
            width: `${pct(bands.carry) - pct(bands.heavy)}%`,
          }}
        />
        <div
          className="rpg-inventory-block__encumbrance-band"
          data-band="over"
          style={{
            left: `${pct(bands.carry)}%`,
            width: `${pct(bands.push) - pct(bands.carry)}%`,
          }}
        />
        <div
          className="rpg-inventory-block__encumbrance-marker"
          style={{ left: `${pct(total)}%` }}
        />
      </div>
    </section>
  );
}
