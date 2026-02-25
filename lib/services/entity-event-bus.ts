/**
 * Entity Event Bus
 *
 * A lightweight, scoped publish/subscribe bus for entity-level events.
 * Each vault file (identified by its sourcePath) gets its own isolated bus
 * so that triggering an event only affects the blocks within that note.
 *
 * Usage from inside a block component:
 *   trigger("short-rest")         // fires all listeners registered for "short-rest"
 *
 * Future (on-prop):
 *   on("short-rest", () => { ... }) // subscribe from another block
 */

type Handler = () => void;

export class EntityEventBus {
  private listeners: Map<string, Set<Handler>> = new Map();

  /** Fire all handlers registered for `eventName`. Errors in handlers are caught and logged. */
  trigger(eventName: string): void {
    const handlers = this.listeners.get(eventName);
    if (!handlers || handlers.size === 0) return;
    for (const h of handlers) {
      try {
        h();
      } catch (e) {
        console.error(`[EntityEventBus] Error in handler for "${eventName}":`, e);
      }
    }
  }

  /**
   * Subscribe to an event.
   * @returns A cleanup/unsubscribe function.
   */
  on(eventName: string, handler: Handler): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(handler);
    return () => {
      this.listeners.get(eventName)?.delete(handler);
    };
  }

  /** Remove all listeners (e.g., when the file is closed/unloaded). */
  clear(): void {
    this.listeners.clear();
  }
}

// ─── Global per-file registry ─────────────────────────────────────────────────

const busRegistry = new Map<string, EntityEventBus>();

/** Get (or create) the EntityEventBus for a given vault file path. */
export function getEntityBus(sourcePath: string): EntityEventBus {
  if (!busRegistry.has(sourcePath)) {
    busRegistry.set(sourcePath, new EntityEventBus());
  }
  return busRegistry.get(sourcePath)!;
}

/** Release the bus for a file — call when a file is closed or no longer needed. */
export function clearEntityBus(sourcePath: string): void {
  busRegistry.get(sourcePath)?.clear();
  busRegistry.delete(sourcePath);
}
