/**
 * hygiene — pure check logic (no Playwright import, so it unit-tests without a
 * browser). Extracted from the Aexodus smoke spec's console-error filtering.
 * Targets how a republished site silently rots. Registration lives in ./index.ts.
 */

/** Console-error substrings that are noise, not regressions (favicon, blocked 3rd-parties, etc.). */
export const DEFAULT_CONSOLE_IGNORES: RegExp[] = [
  /Failed to load resource.*favicon/i,
  /net::ERR_BLOCKED/i,
  /turnstile/i,
];

/** Keep only console errors NOT matched by any ignore pattern. */
export function filterConsoleErrors(
  errors: string[],
  ignore: RegExp[] = DEFAULT_CONSOLE_IGNORES,
): string[] {
  return errors.filter((e) => !ignore.some((re) => re.test(e)));
}

/** On an HTTPS page, any http:// sub-resource is mixed content. Returns the offenders. */
export function findMixedContent(pageUrl: string, resourceUrls: string[]): string[] {
  if (!pageUrl.startsWith("https://")) return [];
  return resourceUrls.filter((u) => u.startsWith("http://"));
}

export interface PageMeta {
  title?: string | null;
  description?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
}

export const REQUIRED_META: (keyof PageMeta)[] = [
  "title",
  "description",
  "ogTitle",
  "ogDescription",
];

/** Which required meta fields are missing/empty. Empty array = OG+meta intact. */
export function missingMeta(meta: PageMeta, required: (keyof PageMeta)[] = REQUIRED_META): string[] {
  return required.filter((k) => {
    const v = meta[k];
    return v == null || v.trim() === "";
  });
}
