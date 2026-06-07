import { expect, test } from "@playwright/test";
import { isOkStatus, missingMarkers, resolveUrl, type WebSmokeConfig } from "./checks";

export * from "./checks";

/**
 * Register the web-smoke surface as Playwright tests: every route returns a
 * non-error status and (optionally) contains its key markers. Call this from a
 * thin spec in a consuming repo.
 */
export function registerWebSmoke(config: WebSmokeConfig): void {
  for (const route of config.routes) {
    test(`web-smoke ${route.path} returns ok + key elements`, async ({ page }) => {
      const url = resolveUrl(config.baseUrl, route.path);
      const resp = await page.goto(url, { waitUntil: "domcontentloaded" });
      expect(isOkStatus(resp?.status(), config.maxStatus), `status for ${route.path}`).toBe(true);
      if (route.mustContain?.length) {
        const body = await page.content();
        expect(missingMarkers(body, route.mustContain), `missing markers on ${route.path}`).toEqual(
          [],
        );
      }
    });
  }
}
