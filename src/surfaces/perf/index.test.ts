import { describe, expect, it } from "vitest";
import {
  AUDIT_IDS,
  evaluateLhrs,
  lighthouseAssertions,
  lighthouserc,
  sampleFromLhr,
  type LighthouseResult,
} from "./index";

const lhr = (audits: Record<string, number>): LighthouseResult => ({
  audits: Object.fromEntries(Object.entries(audits).map(([k, v]) => [k, { numericValue: v }])),
});

describe("perf — Lighthouse CI coupling", () => {
  it("lighthouseAssertions maps each budget to its audit id as a median maxNumericValue", () => {
    const assertions = lighthouseAssertions({ lcp: 2500, cls: 0.1 });
    expect(assertions[AUDIT_IDS.lcp]).toEqual([
      "error",
      { maxNumericValue: 2500, aggregationMethod: "median" },
    ]);
    expect(assertions[AUDIT_IDS.cls][1].maxNumericValue).toBe(0.1);
    expect(Object.keys(assertions)).toHaveLength(2); // only budgeted metrics asserted
  });

  it("lighthouserc assembles a runnable @lhci/cli config with a default of 3 runs", () => {
    const config = lighthouserc({ urls: ["https://staging.example.com/"] });
    expect(config.ci.collect.url).toEqual(["https://staging.example.com/"]);
    expect(config.ci.collect.numberOfRuns).toBe(3);
    expect(config.ci.assert.assertions[AUDIT_IDS.lcp][1].maxNumericValue).toBe(2500);
    expect(config.ci.upload.target).toBe("temporary-public-storage");
  });

  it("lighthouserc honours an explicit run count", () => {
    expect(lighthouserc({ urls: ["x"], numberOfRuns: 5 }).ci.collect.numberOfRuns).toBe(5);
  });

  it("sampleFromLhr extracts numericValues by audit id and skips missing audits", () => {
    const sample = sampleFromLhr(
      lhr({ "largest-contentful-paint": 2100, "cumulative-layout-shift": 0.04 }),
    );
    expect(sample).toEqual({ lcp: 2100, cls: 0.04 });
  });

  it("evaluateLhrs medians across runs then compares to budgets", () => {
    const runs = [
      lhr({ "largest-contentful-paint": 2600 }),
      lhr({ "largest-contentful-paint": 3000 }),
      lhr({ "largest-contentful-paint": 2800 }),
    ];
    // median LCP = 2800 > 2500 default budget
    const breaches = evaluateLhrs(runs);
    expect(breaches).toHaveLength(1);
    expect(breaches[0]).toMatchObject({ metric: "lcp", measured: 2800, budget: 2500 });
  });
});
