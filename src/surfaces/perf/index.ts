/**
 * perf — the Lighthouse CI coupling. The pure budget math lives in ./checks; this
 * maps it onto @lhci/cli: it emits the `assert.assertions` block, assembles a full
 * `lighthouserc` config, and adapts a raw Lighthouse Result (LHR) back into our
 * metric sample for the programmatic path. No `lighthouse` import — we describe
 * the audits structurally — so this still typechecks browser-free in CI.
 */
import {
  DEFAULT_BUDGETS,
  aggregateRuns,
  evaluateVitals,
  type Breach,
  type Budgets,
  type Metric,
  type MetricSample,
} from "./checks";

export * from "./checks";

/** Our metric ids → the Lighthouse audit ids that carry their numeric value. */
export const AUDIT_IDS: Readonly<Record<Metric, string>> = {
  lcp: "largest-contentful-paint",
  cls: "cumulative-layout-shift",
  tbt: "total-blocking-time",
  fcp: "first-contentful-paint",
  si: "speed-index",
  ttfb: "server-response-time",
};

/** A single @lhci/cli assertion: error if the audit's numeric value exceeds max. */
export type LhciAssertion = ["error", { maxNumericValue: number; aggregationMethod: "median" }];

/**
 * The `assert.assertions` block for @lhci/cli — one `maxNumericValue` per budgeted
 * metric, aggregated by median across runs. Drop into a `lighthouserc` directly.
 */
export function lighthouseAssertions(
  budgets: Budgets = DEFAULT_BUDGETS,
): Record<string, LhciAssertion> {
  const assertions: Record<string, LhciAssertion> = {};
  for (const m of Object.keys(AUDIT_IDS) as Metric[]) {
    const budget = budgets[m];
    if (budget === undefined) continue;
    assertions[AUDIT_IDS[m]] = ["error", { maxNumericValue: budget, aggregationMethod: "median" }];
  }
  return assertions;
}

/**
 * Where @lhci/cli sends its reports. `filesystem` keeps them local (the nightly
 * workflow then uploads `.lighthouseci` as a PRIVATE GitHub artifact);
 * `temporary-public-storage` posts to Google's PUBLICLY-reachable sink — a
 * Lighthouse report can embed the audited page's DOM/screenshots, so only opt into
 * it for a non-sensitive URL; `lhci` targets your own server.
 */
export type LhciUpload =
  | { target: "filesystem"; outputDir: string }
  | { target: "temporary-public-storage" }
  | { target: "lhci"; serverBaseUrl: string; token: string };

/** Safe default: write reports locally; no public upload. */
export const DEFAULT_UPLOAD: LhciUpload = { target: "filesystem", outputDir: ".lighthouseci" };

export interface LighthousercConfig {
  /** Absolute URLs to audit (e.g. `${BASE_URL}/`, `${BASE_URL}/deals`). */
  urls: string[];
  /** Budgets to assert against. Defaults to DEFAULT_BUDGETS. */
  budgets?: Budgets;
  /** Lighthouse runs per URL; the median is asserted. Default 3 (the noise floor). */
  numberOfRuns?: number;
  /** Where reports go. Defaults to the local filesystem (no public upload). */
  upload?: LhciUpload;
}

/**
 * A full @lhci/cli config object. A consumer's `lighthouserc.cjs` is one line:
 * `module.exports = lighthouserc({ urls: [process.env.BASE_URL + "/"] })`.
 * Report-only by default — the nightly workflow runs it; it is not a PR gate.
 * Reports stay local unless the consumer explicitly opts into a public sink.
 */
export function lighthouserc(config: LighthousercConfig): {
  ci: {
    collect: { url: string[]; numberOfRuns: number };
    assert: { assertions: Record<string, LhciAssertion> };
    upload: LhciUpload;
  };
} {
  return {
    ci: {
      collect: { url: config.urls, numberOfRuns: config.numberOfRuns ?? 3 },
      assert: { assertions: lighthouseAssertions(config.budgets) },
      upload: config.upload ?? DEFAULT_UPLOAD,
    },
  };
}

/** Minimal structural shape of a Lighthouse Result — avoids a hard `lighthouse` dep. */
export interface LighthouseResult {
  audits?: Record<string, { numericValue?: number | null } | undefined>;
}

/** Pull our metric sample out of one raw Lighthouse Result. */
export function sampleFromLhr(lhr: LighthouseResult): MetricSample {
  const sample: MetricSample = {};
  for (const m of Object.keys(AUDIT_IDS) as Metric[]) {
    const value = lhr.audits?.[AUDIT_IDS[m]]?.numericValue;
    if (typeof value === "number") sample[m] = value;
  }
  return sample;
}

/**
 * Evaluate one-or-more raw Lighthouse Results against budgets — the programmatic
 * path (run lighthouse yourself, feed the LHRs here). Takes the per-metric median
 * across runs, then compares to the budgets. Empty array = every budget held.
 */
export function evaluateLhrs(
  lhrs: readonly LighthouseResult[],
  budgets: Budgets = DEFAULT_BUDGETS,
): Breach[] {
  return evaluateVitals(aggregateRuns(lhrs.map(sampleFromLhr)), budgets);
}
