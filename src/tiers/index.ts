/**
 * Tier model — which surfaces a project composes at each criticality level.
 * Cumulative: a higher tier is a superset of the one below. Canonical: Forum b96b17c1.
 */

export type Surface =
  | "web-smoke"
  | "worker-contract"
  | "hygiene"
  | "a11y"
  | "visual"
  | "perf"
  | "fan-out-review";

export type Tier = 0 | 1 | 2;

/** Surfaces composed at each tier (cumulative). */
export const TIER_SURFACES: Record<Tier, readonly Surface[]> = {
  0: ["web-smoke", "worker-contract", "hygiene"],
  1: ["web-smoke", "worker-contract", "hygiene", "a11y", "visual", "perf"],
  2: ["web-smoke", "worker-contract", "hygiene", "a11y", "visual", "perf", "fan-out-review"],
};

/** Nightly / report-only surfaces — composed but never block a merge. */
export const NIGHTLY_SURFACES: ReadonlySet<Surface> = new Set<Surface>(["visual", "perf"]);

/**
 * Surfaces that BLOCK a merge when present (deterministic, pre-merge). Everything
 * else in a tier is nightly/advisory. `fan-out-review`'s LLM/vision verdicts are
 * advisory until calibrated, so it is not a hard blocker here.
 */
export const BLOCKING_SURFACES: ReadonlySet<Surface> = new Set<Surface>([
  "web-smoke",
  "worker-contract",
  "hygiene",
  "a11y",
]);

export function surfacesForTier(tier: Tier): readonly Surface[] {
  return TIER_SURFACES[tier];
}

/** The merge-blocking subset of a tier's surfaces. */
export function blockingSurfacesForTier(tier: Tier): Surface[] {
  return surfacesForTier(tier).filter((s) => BLOCKING_SURFACES.has(s));
}
