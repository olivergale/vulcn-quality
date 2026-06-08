import { registerWebSmoke } from "../surfaces/web-smoke/index";
import { registerHygiene } from "../surfaces/hygiene/index";
import { registerA11y } from "../surfaces/a11y/index";
import { registerVisual } from "../surfaces/visual/index";
import { nightlySurfacesForTier, webSurfacesForTier } from "./checks";
import type { Tier } from "../tiers/index";
import type { SmokeRoute } from "../surfaces/web-smoke/checks";
import type { AxeImpact } from "../surfaces/a11y/checks";
import type { DiffOptions, Viewport, VisualRoute } from "../surfaces/visual/checks";

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
 * Register the deterministic, pre-merge web surfaces for `config.tier` in one call
 * — the consumer-side half of the one-line tier opt-in. Pair it with the reusable
 * `.github/workflows/quality.yml` (the CI half). worker-contract is wired in the
 * consumer's own vitest-pool-workers job; the nightly surfaces (`visual` / `perf`)
 * go through `registerNightly` + `quality-nightly.yml`; `fan-out-review` lands with
 * VLCN-601.
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

export interface NightlyRunConfig {
  /** Project criticality tier (0 low-touch, 1 product, 2 platform; cumulative). */
  tier: Tier;
  /** Base URL the nightly surfaces run against. */
  baseUrl: string;
  /** Routes for the visual surface (path + optional masks / viewport filter / diff). */
  routes: VisualRoute[];
  /** Breakpoints to capture each route at (see registerVisual). */
  viewports?: Viewport[];
  /** Project-wide diff tolerance overrides (a route's own `diff` wins). */
  diff?: DiffOptions;
}

/**
 * Register the nightly, report-only Playwright surfaces for `config.tier` in one
 * call — the consumer-side half of the nightly opt-in. Pair it with the reusable
 * `.github/workflows/quality-nightly.yml`. `visual` lands here; `perf` runs as a
 * separate @lhci/cli job driven by `surfaces/perf`'s `lighthouserc`. Tier 0
 * composes nothing nightly; tiers 1+ compose `visual`. Call this from a thin
 * nightly spec in a consuming repo, NOT the pre-merge gate.
 *
 * In a consuming repo (`quality/nightly.spec.ts`):
 * ```ts
 * import { registerNightly } from "@vulcn/quality/runner";
 * registerNightly({
 *   tier: Number(process.env.QUALITY_TIER ?? 0),
 *   baseUrl: process.env.BASE_URL!,
 *   routes: [{ path: "/", mask: ["#last-updated"] }],
 * });
 * ```
 */
export function registerNightly(config: NightlyRunConfig): void {
  const surfaces = new Set(nightlySurfacesForTier(config.tier));
  if (surfaces.has("visual")) {
    registerVisual({
      baseUrl: config.baseUrl,
      routes: config.routes,
      viewports: config.viewports,
      diff: config.diff,
    });
  }
}
