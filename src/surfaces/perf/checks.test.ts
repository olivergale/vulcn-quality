import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUDGETS,
  aggregateRuns,
  applyMargin,
  evaluateVitals,
  formatBreaches,
  median,
  type MetricSample,
} from "./checks";

describe("perf checks", () => {
  it("median handles odd and even counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5); // mean of 2 and 3
    expect(median([])).toBeNaN();
  });

  it("applyMargin tightens every present budget by the factor", () => {
    const tight = applyMargin({ lcp: 2500, cls: 0.1 }, 0.9);
    expect(tight.lcp).toBe(2250);
    expect(tight.cls).toBeCloseTo(0.09);
    expect(tight.tbt).toBeUndefined(); // absent stays absent
  });

  it("aggregateRuns takes the per-metric median across runs, skipping gaps", () => {
    const runs: MetricSample[] = [
      { lcp: 2000, cls: 0.05 },
      { lcp: 2400, cls: 0.07 },
      { lcp: 2200 }, // cls missing this run
    ];
    const agg = aggregateRuns(runs);
    expect(agg.lcp).toBe(2200);
    expect(agg.cls).toBeCloseTo(0.06); // median of [0.05, 0.07]
  });

  it("evaluateVitals flags only budgeted, measured metrics that exceed budget", () => {
    const sample: MetricSample = { lcp: 3200, cls: 0.05, tbt: 150 };
    const breaches = evaluateVitals(sample, DEFAULT_BUDGETS);
    expect(breaches).toHaveLength(1);
    expect(breaches[0]).toMatchObject({ metric: "lcp", measured: 3200, budget: 2500, over: 700 });
  });

  it("evaluateVitals ignores metrics with no budget or no measurement", () => {
    expect(evaluateVitals({ lcp: 9999 }, { cls: 0.1 })).toEqual([]); // lcp not budgeted
    expect(evaluateVitals({}, DEFAULT_BUDGETS)).toEqual([]); // nothing measured
  });

  it("evaluateVitals treats equal-to-budget as passing (strictly greater breaches)", () => {
    expect(evaluateVitals({ lcp: 2500 }, { lcp: 2500 })).toEqual([]);
    expect(evaluateVitals({ lcp: 2501 }, { lcp: 2500 })).toHaveLength(1);
  });

  it("formatBreaches renders ms metrics rounded and CLS as a unitless decimal", () => {
    const lines = formatBreaches([
      { metric: "lcp", measured: 3200.4, budget: 2500, over: 700.4 },
      { metric: "cls", measured: 0.25, budget: 0.1, over: 0.15 },
    ]);
    expect(lines).toContain("lcp 3200ms > 2500ms budget (+700ms)");
    expect(lines).toContain("cls 0.250 > 0.100 budget (+0.150)");
  });
});
