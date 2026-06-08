/**
 * runner — the pure tier-composition logic (no Playwright import, so it
 * unit-tests without a browser). Given a tier, which BUILT, deterministic web
 * surfaces does `registerTier` (in ./index.ts) wire? Tier membership comes from
 * ../tiers; this just intersects it with what is actually registerable today.
 */
import { surfacesForTier, type Surface, type Tier } from "../tiers/index";

/**
 * Pre-merge, BLOCKING Playwright web surfaces `registerTier` wires today.
 * `visual` is nightly (see REGISTERABLE_NIGHTLY_SURFACES, not pre-merge);
 * `perf` is Lighthouse CI (not a Playwright `test()`); `worker-contract` is
 * consumer-side vitest-pool-workers; `fan-out-review` is manifold-review. All
 * absent so the pre-merge runner never references a surface it shouldn't wire here.
 */
export const REGISTERABLE_WEB_SURFACES: readonly Surface[] = ["web-smoke", "hygiene", "a11y"];

/** The registerable web surfaces a tier composes, in stable (REGISTERABLE) order. */
export function webSurfacesForTier(tier: Tier): Surface[] {
  const inTier = new Set(surfacesForTier(tier));
  return REGISTERABLE_WEB_SURFACES.filter((s) => inTier.has(s));
}

/**
 * Nightly, report-only Playwright surfaces `registerNightly` can wire today.
 * `visual` ships with VLCN-600; `perf` is Lighthouse CI (it runs via @lhci/cli in
 * the nightly workflow, not a Playwright `test()`), so it is intentionally absent.
 */
export const REGISTERABLE_NIGHTLY_SURFACES: readonly Surface[] = ["visual"];

/** The registerable nightly Playwright surfaces a tier composes, in stable order. */
export function nightlySurfacesForTier(tier: Tier): Surface[] {
  const inTier = new Set(surfacesForTier(tier));
  return REGISTERABLE_NIGHTLY_SURFACES.filter((s) => inTier.has(s));
}
