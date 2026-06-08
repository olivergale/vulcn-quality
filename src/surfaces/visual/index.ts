import { expect, test } from "@playwright/test";
import {
  duplicateNames,
  expandCases,
  type DiffOptions,
  type ScreenshotCase,
  type Viewport,
  type VisualRoute,
} from "./checks";

export * from "./checks";

export interface VisualConfig {
  baseUrl: string;
  /** Routes to snapshot (path + optional masks / viewport filter / diff overrides). */
  routes: VisualRoute[];
  /** Breakpoints to capture each route at. Defaults to DEFAULT_VIEWPORTS. */
  viewports?: Viewport[];
  /** Project-wide diff tolerance overrides (a route's own `diff` wins over these). */
  diff?: DiffOptions;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Register the visual surface: each route is captured at each viewport and pixel-
 * diffed against a committed baseline (`toHaveScreenshot`). The FIRST run writes
 * baselines (no assertion); later runs fail on drift beyond the diff tolerance.
 * Nightly + report-only — call this from a thin nightly spec in a consuming repo,
 * not the pre-merge gate. Baselines live in the consumer repo and are reviewed
 * like code.
 */
export function registerVisual(config: VisualConfig): void {
  const cases: ScreenshotCase[] = expandCases(config.routes, config.viewports, config.diff);
  const collisions = duplicateNames(cases);
  if (collisions.length > 0) {
    throw new Error(`visual: colliding snapshot names would overwrite baselines: ${collisions.join(", ")}`);
  }
  for (const c of cases) {
    test(`visual ${c.path} @ ${c.viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: c.viewport.width, height: c.viewport.height });
      await page.goto(joinUrl(config.baseUrl, c.path), { waitUntil: "networkidle" });
      await expect(page).toHaveScreenshot(c.name, {
        fullPage: c.diff.fullPage,
        animations: c.diff.animations,
        caret: c.diff.caret,
        threshold: c.diff.threshold,
        maxDiffPixelRatio: c.diff.maxDiffPixelRatio,
        maxDiffPixels: c.diff.maxDiffPixels,
        mask: c.mask.map((selector) => page.locator(selector)),
      });
    });
  }
}
