import { expect, test, type Page } from "@playwright/test";
import {
  DEFAULT_CONSOLE_IGNORES,
  filterConsoleErrors,
  findMixedContent,
  missingMeta,
  type PageMeta,
} from "./checks";

export * from "./checks";

export interface HygieneConfig {
  baseUrl: string;
  paths: string[];
  /** Override the default console-error ignore patterns. */
  consoleIgnores?: RegExp[];
}

function attachConsoleSink(page: Page, sink: string[]): void {
  page.on("console", (msg) => {
    if (msg.type() === "error") sink.push(msg.text());
  });
  page.on("pageerror", (err) => sink.push(err.message));
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Register the hygiene surface: no un-ignored console errors, no mixed content,
 * OG+meta intact. Call this from a thin spec in a consuming repo.
 */
export function registerHygiene(config: HygieneConfig): void {
  const ignore = config.consoleIgnores ?? DEFAULT_CONSOLE_IGNORES;
  for (const path of config.paths) {
    test(`hygiene ${path} clean console + meta + no mixed content`, async ({ page }) => {
      const errors: string[] = [];
      attachConsoleSink(page, errors);
      const url = joinUrl(config.baseUrl, path);
      await page.goto(url, { waitUntil: "networkidle" });

      expect(filterConsoleErrors(errors, ignore), `console errors on ${path}`).toEqual([]);

      const resources = await page.$$eval("[src],[href]", (els) =>
        els
          .map((el) => el.getAttribute("src") ?? el.getAttribute("href") ?? "")
          .filter((u) => u.length > 0),
      );
      expect(findMixedContent(url, resources), `mixed content on ${path}`).toEqual([]);

      const meta: PageMeta = await page.evaluate(() => ({
        title: document.title,
        description:
          document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null,
        ogTitle:
          document.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? null,
        ogDescription:
          document.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? null,
      }));
      expect(missingMeta(meta), `missing meta on ${path}`).toEqual([]);
    });
  }
}
