import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  DEFAULT_MIN_IMPACT,
  filterViolations,
  formatViolations,
  type AxeImpact,
  type AxeViolation,
} from "./checks";

export * from "./checks";

/** WCAG rule tags axe evaluates by default — the standard A + AA (2.0 + 2.1) floor. */
export const DEFAULT_TAGS: readonly string[] = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

export interface A11yConfig {
  baseUrl: string;
  paths: string[];
  /** Floor: violations at/above this impact fail. Default `minor` (true zero-violation floor). */
  minImpact?: AxeImpact;
  /** axe rule ids to suppress (known-accepted; track the debt in Linear, not here). */
  ignoreRules?: string[];
  /** WCAG tag set axe evaluates. Default A + AA (2.0 + 2.1). */
  tags?: readonly string[];
  /** Optional CSS selector to scope the scan to a region (default: whole document). */
  include?: string;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Register the a11y surface: each path is scanned with axe-core and must hold the
 * zero-violation floor (no violation at/above `minImpact`, default any). Honest
 * scope — a regression gate, not a WCAG compliance stamp. Call this from a thin
 * spec in a consuming repo.
 */
export function registerA11y(config: A11yConfig): void {
  const minImpact = config.minImpact ?? DEFAULT_MIN_IMPACT;
  const tags = [...(config.tags ?? DEFAULT_TAGS)];
  for (const path of config.paths) {
    test(`a11y ${path} holds the zero-violation floor`, async ({ page }) => {
      await page.goto(joinUrl(config.baseUrl, path), { waitUntil: "networkidle" });
      const builder = new AxeBuilder({ page }).withTags(tags);
      if (config.include) builder.include(config.include);
      const { violations } = await builder.analyze();
      const breaches = filterViolations(violations as AxeViolation[], {
        minImpact,
        ignoreRules: config.ignoreRules,
      });
      expect(breaches, `a11y violations on ${path}:\n${formatViolations(breaches)}`).toEqual([]);
    });
  }
}
