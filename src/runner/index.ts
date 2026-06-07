import { registerWebSmoke } from "../surfaces/web-smoke/index";
import { registerHygiene } from "../surfaces/hygiene/index";
import { registerA11y } from "../surfaces/a11y/index";
import { webSurfacesForTier } from "./checks";
import type { Tier } from "../tiers/index";
import type { SmokeRoute } from "../surfaces/web-smoke/checks";
import type { AxeImpact } from "../surfaces/a11y/checks";

export * from "./checks";

export interface TierRunConfig {
  /** Project criticality tier (0 low-touch, 1 product, 2 platform; cumulative). */
  tier: Tier;
  /** Base URL every web surface runs against. */
  baseUrl: string;
  /** Routes for web-smoke (path + optional must-contain markers). */
  routes: SmokeRoute[];
  /** Paths for hygiene + a11y. Defaults to the web-smoke routes' paths. */
  paths?: string[];
  /** a11y floor / rule suppression overrides (see registerA11y). */
  a11y?: { minImpact?: AxeImpact; ignoreRules?: string[] };
}

/**
 * Register the deterministic web surfaces for `config.tier` in one call — the
 * consumer-side half of the one-line tier opt-in. Pair it with the reusable
 * `.github/workflows/quality.yml` (the CI half). worker-contract is wired in the
 * consumer's own vitest-pool-workers job; visual/perf/fan-out-review land with
 * VLCN-600/601.
 *
 * In a consuming repo (`quality/tier.spec.ts`):
 * ```ts
 * import { registerTier } from "@vulcn/quality/runner";
 * registerTier({
 *   tier: Number(process.env.QUALITY_TIER ?? 0),
 *   baseUrl: process.env.BASE_URL!,
 *   routes: [{ path: "/", mustContain: ["Aexodus"] }],
 * });
 * ```
 */
export function registerTier(config: TierRunConfig): void {
  const surfaces = new Set(webSurfacesForTier(config.tier));
  const paths = config.paths ?? config.routes.map((r) => r.path);
  if (surfaces.has("web-smoke")) {
    registerWebSmoke({ baseUrl: config.baseUrl, routes: config.routes });
  }
  if (surfaces.has("hygiene")) {
    registerHygiene({ baseUrl: config.baseUrl, paths });
  }
  if (surfaces.has("a11y")) {
    registerA11y({ baseUrl: config.baseUrl, paths, ...config.a11y });
  }
}
