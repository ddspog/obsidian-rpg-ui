/**
 * Inventory component
 * 
 * Displays inventory items, currency, and encumbrance.
 * Phase 2: Read-only display of items and currency.
 */

import { InventoryBlock, InventorySection, calculateTotalWeight } from "lib/domains/inventory";

interface InventoryProps {
  data: InventoryBlock;
  totalWeight: number;
  capacity?: number;
}

export function Inventory({ data, totalWeight, capacity }: InventoryProps) {
  return (
    <div className="rpg-inventory">
      {/* Currency display */}
      {data.currency && Object.keys(data.currency).length > 0 && (
        <div className="rpg-inventory-currency">
          <h4>Currency</h4>
          <div className="rpg-currency-row">
            {data.currency.platinum !== undefined && data.currency.platinum > 0 && (
              <span className="rpg-currency-item">
                <span className="rpg-currency-value">{data.currency.platinum}</span> PP
              </span>
            )}
            {data.currency.gold !== undefined && data.currency.gold > 0 && (
              <span className="rpg-currency-item">
                <span className="rpg-currency-value">{data.currency.gold}</span> GP
              </span>
            )}
            {data.currency.electrum !== undefined && data.currency.electrum > 0 && (
              <span className="rpg-currency-item">
                <span className="rpg-currency-value">{data.currency.electrum}</span> EP
              </span>
            )}
            {data.currency.silver !== undefined && data.currency.silver > 0 && (
              <span className="rpg-currency-item">
                <span className="rpg-currency-value">{data.currency.silver}</span> SP
              </span>
            )}
            {data.currency.copper !== undefined && data.currency.copper > 0 && (
              <span className="rpg-currency-item">
                <span className="rpg-currency-value">{data.currency.copper}</span> CP
              </span>
            )}
          </div>
        </div>
      )}

      {/* Encumbrance display */}
      {capacity && (
        <div className="rpg-inventory-encumbrance">
          <div className="rpg-encumbrance-label">
            Carrying: {totalWeight} / {capacity} lbs
          </div>
          <div className="rpg-encumbrance-bar">
            <div
              className="rpg-encumbrance-fill"
              style={{ width: `${Math.min((totalWeight / capacity) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Inventory sections */}
      {data.sections &&
        data.sections.map((section, idx) => (
          <div key={idx} className="rpg-inventory-section">
            <h4 className="rpg-section-title">{section.name}</h4>
            <div className="rpg-items-list">
              {section.items.map((item, itemIdx) => (
                <div key={itemIdx} className="rpg-inventory-item">
                  <div className="rpg-item-header">
                    <span className="rpg-item-name">{item.name}</span>
                    {item.quantity && item.quantity > 1 && (
                      <span className="rpg-item-quantity">×{item.quantity}</span>
                    )}
                    {item.weight && (
                      <span className="rpg-item-weight">{item.weight * (item.quantity || 1)} lbs</span>
                    )}
                  </div>
                  {item.description && <div className="rpg-item-description">{item.description}</div>}
                  {item.tags && item.tags.length > 0 && (
                    <div className="rpg-item-tags">
                      {item.tags.map((tag, tagIdx) => (
                        <span key={tagIdx} className="rpg-item-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
