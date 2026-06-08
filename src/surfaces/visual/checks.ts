/**
 * visual — pure check logic (no Playwright import, so it unit-tests without a
 * browser). The screenshot + pixel-diff itself runs in ./index.ts via Playwright's
 * native `toHaveScreenshot`; everything that decides WHAT to capture — the
 * route × breakpoint matrix, the stable snapshot names, the diff tolerances, the
 * dynamic-region masks — lives here.
 *
 * Honest scope: a regression gate, not a design review. It catches unintended
 * pixel drift between a committed baseline and the current render; it says nothing
 * about whether the design is good. Nightly + opt-in: visual diffs are flake-prone
 * (fonts, animations, anti-aliasing) so they REPORT, they do not block a merge.
 * Free path first (native Playwright screenshots); Argos/Percy are an optional
 * managed-baseline escalation, not a dependency here.
 */

/** A breakpoint to capture each route at. */
export interface Viewport {
  name: string;
  width: number;
  height: number;
}

/** The standard breakpoint matrix: phone, tablet, desktop. */
export const DEFAULT_VIEWPORTS: readonly Viewport[] = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "desktop", width: 1440, height: 900 },
];

/** Pixel-diff tolerances passed through to `toHaveScreenshot`. */
export interface DiffOptions {
  /** Fraction of pixels allowed to differ (0..1). Default 0.01 (1%). */
  maxDiffPixelRatio?: number;
  /** Absolute pixel count allowed to differ (overrides ratio when set). */
  maxDiffPixels?: number;
  /** Per-pixel YIQ colour-distance threshold (0..1). Default 0.2 (Playwright's). */
  threshold?: number;
  /** Capture the full scrollable page, not just the viewport. Default true. */
  fullPage?: boolean;
  /** Freeze CSS animations/transitions before the shot. Default "disabled". */
  animations?: "disabled" | "allow";
  /** Hide the text caret so a blinking cursor never flips the diff. Default "hide". */
  caret?: "hide" | "initial";
}

/** Diff tolerances applied unless a route overrides them. */
export const DEFAULT_DIFF_OPTIONS: Readonly<Required<Omit<DiffOptions, "maxDiffPixels">>> = {
  maxDiffPixelRatio: 0.01,
  threshold: 0.2,
  fullPage: true,
  animations: "disabled",
  caret: "hide",
};

/** A route to visually snapshot, with optional per-route overrides. */
export interface VisualRoute {
  path: string;
  /** CSS selectors for dynamic regions to mask out (timestamps, carousels, ads). */
  mask?: string[];
  /** Restrict this route to a subset of viewports by name. Default: all. */
  viewports?: string[];
  /** Per-route diff tolerance overrides. */
  diff?: DiffOptions;
}

/** One concrete screenshot to take: a route at a viewport, with a stable name. */
export interface ScreenshotCase {
  path: string;
  viewport: Viewport;
  /** Snapshot file name, e.g. `deals-desktop.png` — stable across runs. */
  name: string;
  mask: string[];
  diff: DiffOptions;
}

/**
 * A filesystem-safe, collision-resistant slug for a route path:
 * `/` → `root`, `/deals` → `deals`, `/deals/vetted-lp?x=1` → `deals-vetted-lp-x-1`.
 */
export function slugForPath(path: string): string {
  const slug = path
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug || "root";
}

/** Stable snapshot name for a route at a viewport: `<slug>-<viewport>.png`. */
export function snapshotName(path: string, viewport: Viewport): string {
  return `${slugForPath(path)}-${viewport.name}.png`;
}

/**
 * Expand routes × viewports into the concrete screenshot cases, applying per-route
 * viewport filters, masks, and merged diff options. Route order is preserved;
 * within a route, viewport order follows `viewports`.
 */
export function expandCases(
  routes: readonly VisualRoute[],
  viewports: readonly Viewport[] = DEFAULT_VIEWPORTS,
  baseDiff: DiffOptions = DEFAULT_DIFF_OPTIONS,
): ScreenshotCase[] {
  const byName = new Map(viewports.map((v) => [v.name, v]));
  const cases: ScreenshotCase[] = [];
  for (const route of routes) {
    const chosen = route.viewports?.length
      ? route.viewports
          .map((n) => byName.get(n))
          .filter((v): v is Viewport => v !== undefined)
      : viewports;
    for (const viewport of chosen) {
      cases.push({
        path: route.path,
        viewport,
        name: snapshotName(route.path, viewport),
        mask: route.mask ?? [],
        diff: { ...baseDiff, ...route.diff },
      });
    }
  }
  return cases;
}

/**
 * Snapshot names that collide across cases — two routes that slug to the same name
 * would overwrite each other's baseline. Empty array = every name is unique.
 */
export function duplicateNames(cases: readonly ScreenshotCase[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const c of cases) {
    if (seen.has(c.name)) dupes.add(c.name);
    seen.add(c.name);
  }
  return [...dupes];
}
