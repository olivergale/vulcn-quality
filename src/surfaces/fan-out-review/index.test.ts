import { describe, expect, it } from "vitest";
import {
  fromSeatResults,
  reviewOutcome,
  reviewPlan,
  reviewSeats,
  type SeatResult,
} from "./index";

describe("fan-out-review — dispatch plan + adapter", () => {
  it("reviewPlan exposes five specialists, the verifier, and a union-not-vote gate", () => {
    const plan = reviewPlan();
    expect(plan.specialists).toHaveLength(5);
    expect(plan.specialists.map((s) => s.id)).toEqual([
      "correctness",
      "a11y",
      "perf",
      "brand-visual",
      "security",
    ]);
    expect(plan.verifier.id).toBe("adversarial");
    expect(plan.gate).toMatch(/union of blockers/i);
    expect(plan.gate).toMatch(/not a vote/i);
  });

  it("reviewSeats lists all six dispatched seats, verifier last", () => {
    expect(reviewSeats()).toEqual([
      "correctness",
      "a11y",
      "perf",
      "brand-visual",
      "security",
      "adversarial",
    ]);
  });

  it("fromSeatResults stamps each finding with its seat", () => {
    const results: SeatResult[] = [
      { seat: "security", findings: [{ severity: "blocker", title: "fail-open path" }] },
    ];
    const verdicts = fromSeatResults(results);
    expect(verdicts[0].findings[0].seat).toBe("security");
  });

  it("reviewOutcome blocks on a grounded security blocker straight from seat results", () => {
    const results: SeatResult[] = [
      { seat: "correctness", findings: [] },
      { seat: "security", findings: [{ severity: "blocker", title: "missing auth check" }] },
      { seat: "brand-visual", findings: [{ severity: "blocker", title: "off-brand hue" }] },
    ];
    const out = reviewOutcome(results);
    expect(out.decision).toBe("block"); // security grounded blocks
    expect(out.blockers.map((b) => b.seat)).toEqual(["security"]); // brand-visual stays advisory
    expect(out.advisories.map((a) => a.seat)).toEqual(["brand-visual"]);
  });
});
