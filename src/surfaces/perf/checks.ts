/**
 * perf — pure Core Web Vitals budget math (no Lighthouse import, so it unit-tests
 * without a browser). The Lighthouse run + the @lhci/cli wiring live in ./index.ts;
 * the budgets, the median-of-N aggregation, and the budget comparison live here.
 *
 * Honest scope: these are LAB metrics (a clean CI machine), not field data. Lab
 * is reproducible but optimistic, so budgets carry MARGIN — gate below the "good"
 * threshold so a passing lab run leaves headroom for real-world field conditions.
 * Nightly + report-only: perf is noisy run-to-run, so it informs, it does not block
 * a merge. Take the median of 3+ runs to damp the noise.
 */

/**
 * The gateable lab metrics. The three Core Web Vitals are LCP, CLS, and INP; INP
 * has no reliable lab measurement, so TBT (total blocking time) is its standard
 * lab proxy. FCP / SI / TTFB round out the loading-and-responsiveness picture.
 */
export type Metric = "lcp" | "cls" | "tbt" | "fcp" | "si" | "ttfb";

export const METRICS: readonly Metric[] = ["lcp", "cls", "tbt", "fcp", "si", "ttfb"];

/** Metrics measured in milliseconds (everything except the unitless CLS). */
export const MS_METRICS: ReadonlySet<Metric> = new Set<Metric>(["lcp", "tbt", "fcp", "si", "ttfb"]);

/** A budget map: a metric breaches when its measured value EXCEEDS the budget. */
export type Budgets = Partial<Record<Metric, number>>;

/**
 * Default budgets at the standard "good" thresholds (ms for time metrics, unitless
 * for CLS). Tighten with `applyMargin` to bank headroom against field conditions.
 */
export const DEFAULT_BUDGETS: Readonly<Required<Budgets>> = {
  lcp: 2500,
  cls: 0.1,
  tbt: 200,
  fcp: 1800,
  si: 3400,
  ttfb: 800,
};

/**
 * Tighten every budget by `factor` (0..1) to keep margin between the lab gate and
 * the real "good" threshold. 0.9 = gate at 90% of the threshold (10% headroom).
 */
export function applyMargin(budgets: Budgets, factor: number): Budgets {
  const out: Budgets = {};
  for (const m of METRICS) {
    const v = budgets[m];
    if (v !== undefined) out[m] = v * factor;
  }
  return out;
}

/** A single run's measured metrics (any subset). */
export type MetricSample = Partial<Record<Metric, number>>;

/** Median of a numeric list (mean of the two middle values for even counts). */
export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Collapse N runs into one sample of per-metric medians — the noise-damping step.
 * A metric absent from a given run is simply excluded from that metric's median.
 */
export function aggregateRuns(runs: readonly MetricSample[]): MetricSample {
  const out: MetricSample = {};
  for (const m of METRICS) {
    const present = runs.map((r) => r[m]).filter((v): v is number => typeof v === "number");
    if (present.length > 0) out[m] = median(present);
  }
  return out;
}

/** A budget breach: the metric, what it measured, its budget, and the overage. */
export interface Breach {
  metric: Metric;
  measured: number;
  budget: number;
  over: number;
}

/**
 * Which metrics exceed budget. A metric with no budget, or absent from the sample,
 * is not evaluated. Empty array = every measured, budgeted metric held.
 */
export function evaluateVitals(
  sample: MetricSample,
  budgets: Budgets = DEFAULT_BUDGETS,
): Breach[] {
  const breaches: Breach[] = [];
  for (const m of METRICS) {
    const budget = budgets[m];
    const measured = sample[m];
    if (budget === undefined || measured === undefined) continue;
    if (measured > budget) {
      breaches.push({ metric: m, measured, budget, over: measured - budget });
    }
  }
  return breaches;
}

/** One readable line per breach: `lcp 3200ms > 2500ms budget (+700)`. */
export function formatBreaches(breaches: readonly Breach[]): string {
  const unit = (m: Metric, n: number): string =>
    MS_METRICS.has(m) ? `${Math.round(n)}ms` : n.toFixed(3);
  return breaches
    .map(
      (b) =>
        `${b.metric} ${unit(b.metric, b.measured)} > ${unit(b.metric, b.budget)} budget (+${unit(b.metric, b.over)})`,
    )
    .join("\n");
}
