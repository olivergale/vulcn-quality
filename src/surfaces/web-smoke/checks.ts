/**
 * web-smoke — pure check logic (no Playwright import, so it unit-tests without a
 * browser). The Playwright registration lives in ./index.ts.
 */

/** A route to smoke-test: its path and optional markers that must render. */
export interface SmokeRoute {
  path: string;
  /** Substrings that must appear in the rendered page (key elements present). */
  mustContain?: string[];
}

export interface WebSmokeConfig {
  baseUrl: string;
  routes: SmokeRoute[];
  /** A response status at or above this fails the route (default 400). */
  maxStatus?: number;
}

export const DEFAULT_MAX_STATUS = 400;

/** True iff `status` is a real, non-error HTTP status under `maxStatus`. */
export function isOkStatus(status: number | undefined, maxStatus = DEFAULT_MAX_STATUS): boolean {
  return typeof status === "number" && status > 0 && status < maxStatus;
}

/** Join a base URL and a route path without double slashes. */
export function resolveUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const rel = path.startsWith("/") ? path : `/${path}`;
  return `${base}${rel}`;
}

/** Which `mustContain` markers are absent from `body`. Empty array = all present. */
export function missingMarkers(body: string, mustContain: string[] | undefined): string[] {
  if (!mustContain?.length) return [];
  return mustContain.filter((m) => !body.includes(m));
}
