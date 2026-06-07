/**
 * a11y — pure check logic (no Playwright/axe import, so it unit-tests without a
 * browser). The axe scan itself runs in ./index.ts; everything you DO with the
 * results — the severity floor, the ignore list, the failure message — lives here.
 *
 * Honest scope: axe catches ~30-40% of WCAG, so this is a REGRESSION GATE, not a
 * compliance stamp. The default floor counts every violation; unknown-impact
 * violations are treated as `serious` so they are never silently dropped.
 */

/** axe violation severities, ascending. */
export type AxeImpact = "minor" | "moderate" | "serious" | "critical";

/** Minimal structural shape of an axe NodeResult — avoids a hard axe-core type dep. */
export interface AxeNode {
  /** CSS selector(s) for the offending node (nested arrays for cross-frame targets). */
  target?: unknown[];
  html?: string;
}

/** Minimal structural shape of an axe violation Result. */
export interface AxeViolation {
  id: string;
  impact?: AxeImpact | null;
  help?: string;
  helpUrl?: string;
  nodes?: AxeNode[];
}

export const IMPACT_ORDER: readonly AxeImpact[] = ["minor", "moderate", "serious", "critical"];

/** Default floor: ANY violation counts (a true zero-violation floor). */
export const DEFAULT_MIN_IMPACT: AxeImpact = "minor";

/**
 * Severity rank for ordering/threshold comparison. Unknown/absent impact is
 * treated conservatively as `serious`, so an un-scored violation is never
 * silently dropped at the default floor.
 */
export function impactRank(impact: AxeImpact | null | undefined): number {
  const i = IMPACT_ORDER.indexOf(impact as AxeImpact);
  return i === -1 ? IMPACT_ORDER.indexOf("serious") : i;
}

/** True iff `impact` is at or above `minImpact` in severity. */
export function meetsImpact(
  impact: AxeImpact | null | undefined,
  minImpact: AxeImpact = DEFAULT_MIN_IMPACT,
): boolean {
  return impactRank(impact) >= impactRank(minImpact);
}

export interface ViolationFilter {
  /** Floor: violations at/above this impact breach the gate. Default `minor` (true zero floor). */
  minImpact?: AxeImpact;
  /** axe rule ids to suppress (known-accepted; track the debt elsewhere, e.g. Linear). */
  ignoreRules?: string[];
}

/**
 * The breaching violations: at/above the floor and not explicitly ignored.
 * Empty array = the floor held.
 */
export function filterViolations(
  violations: readonly AxeViolation[],
  filter: ViolationFilter = {},
): AxeViolation[] {
  const minImpact = filter.minImpact ?? DEFAULT_MIN_IMPACT;
  const ignore = new Set(filter.ignoreRules ?? []);
  return violations.filter((v) => !ignore.has(v.id) && meetsImpact(v.impact, minImpact));
}

/** First CSS target of a node as a string (axe targets nest for cross-frame selectors). */
function firstTarget(node: AxeNode | undefined): string {
  const t = node?.target?.[0];
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return t.join(" ");
  return "";
}

/**
 * One line per violation — `id [impact] help (N nodes: <first selector>)` — for a
 * readable assertion message. Empty input yields an empty string.
 */
export function formatViolations(violations: readonly AxeViolation[]): string {
  return violations
    .map((v) => {
      const n = v.nodes?.length ?? 0;
      const where = firstTarget(v.nodes?.[0]);
      const at = where ? `: ${where}` : "";
      return `${v.id} [${v.impact ?? "?"}] ${v.help ?? ""} (${n} node${n === 1 ? "" : "s"}${at})`;
    })
    .join("\n");
}
