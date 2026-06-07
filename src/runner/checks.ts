/**
 * runner — the pure tier-composition logic (no Playwright import, so it
 * unit-tests without a browser). Given a tier, which BUILT, deterministic web
 * surfaces does `registerTier` (in ./index.ts) wire? Tier membership comes from
 * ../tiers; this just intersects it with what is actually registerable today.
 */
import { surfacesForTier, type Surface, type Tier } from "../tiers/index";

/**
 * Playwright-run surfaces `registerTier` can wire today (their modules exist).
 * `visual`/`perf` are Playwright surfaces that ship with VLCN-600;
 * `worker-contract` is consumer-side vitest-pool-workers (not Playwright);
 * `fan-out-review` is manifold-review (VLCN-601). All intentionally absent so the
 * runner never references a surface that isn't built yet.
 */
export const REGISTERABLE_WEB_SURFACES: readonly Surface[] = ["web-smoke", "hygiene", "a11y"];

/** The registerable web surfaces a tier composes, in stable (REGISTERABLE) order. */
export function webSurfacesForTier(tier: Tier): Surface[] {
  const inTier = new Set(surfacesForTier(tier));
  return REGISTERABLE_WEB_SURFACES.filter((s) => inTier.has(s));
}
