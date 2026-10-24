/** The system loader compiles a vault's TypeScript with esbuild, which a browser page doesn't carry:
 *  the simulator runs with the default system, and the GM cards don't need another. */
import type { RPGSystem } from "lib/systems/types";

export function setBundleCacheContext(): void {}
export async function initEsbuild(): Promise<void> {}
export async function loadSystemFromTypeScript(): Promise<RPGSystem | null> {
  return null;
}
export async function evaluateSystemBundle(): Promise<unknown> {
  return null;
}
