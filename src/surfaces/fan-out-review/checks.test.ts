import { describe, expect, it } from "vitest";
import {
  aggregate,
  blocks,
  formatOutcome,
  groundedDefault,
  isGrounded,
  type Finding,
  type SeatId,
  type Verdict,
} from "./checks";

const f = (seat: SeatId, severity: Finding["severity"], extra: Partial<Finding> = {}): Finding => ({
  seat,
  severity,
  title: `${seat} ${severity}`,
  ...extra,
});

const verdict = (seat: SeatId, ...findings: Finding[]): Verdict => ({ seat, findings });

describe("fan-out-review gate", () => {
  it("groundedDefault: deterministic + deterministic-floor are grounded; vision/llm are not", () => {
    expect(groundedDefault("correctness")).toBe(true);
    expect(groundedDefault("security")).toBe(true);
    expect(groundedDefault("a11y")).toBe(true); // deterministic floor (axe)
    expect(groundedDefault("brand-visual")).toBe(false); // vision
    expect(groundedDefault("adversarial")).toBe(false); // llm
  });

  it("UNION not vote: one grounded blocker blocks even when every other seat passes", () => {
    const out = aggregate([
      verdict("security", f("security", "blocker")), // the lone correct minority
      verdict("correctness"),
      verdict("a11y"),
      verdict("perf"),
      verdict("brand-visual"),
      verdict("adversarial"),
    ]);
    expect(out.decision).toBe("block");
    expect(out.blockers).toHaveLength(1);
    expect(out.blockers[0].seat).toBe("security");
  });

  it("an un-calibrated vision/llm blocker is ADVISORY, never blocking", () => {
    const out = aggregate([
      verdict("brand-visual", f("brand-visual", "blocker")),
      verdict("adversarial", f("adversarial", "blocker")),
    ]);
    expect(out.decision).toBe("pass");
    expect(out.blockers).toHaveLength(0);
    expect(out.advisories).toHaveLength(2);
  });

  it("calibrating a seat promotes its model blockers to blocking", () => {
    const verdicts = [verdict("brand-visual", f("brand-visual", "blocker"))];
    expect(aggregate(verdicts).decision).toBe("pass");
    expect(aggregate(verdicts, { calibrated: ["brand-visual"] }).decision).toBe("block");
  });

  it("per-finding grounded overrides the seat default both ways", () => {
    // adversarial critic lands a deterministic repro -> grounded -> blocks
    expect(blocks(f("adversarial", "blocker", { grounded: true }))).toBe(true);
    // a deterministic seat flags a speculative aside as ungrounded -> advisory
    expect(blocks(f("security", "blocker", { grounded: false }))).toBe(false);
    expect(isGrounded(f("a11y", "blocker", { grounded: false }))).toBe(false);
  });

  it("only blocker severity can block — a grounded major/minor does not", () => {
    expect(blocks(f("correctness", "major"))).toBe(false);
    expect(blocks(f("correctness", "minor"))).toBe(false);
    const out = aggregate([verdict("correctness", f("correctness", "major"), f("correctness", "nit"))]);
    expect(out.decision).toBe("pass");
    expect(out.advisories).toHaveLength(2);
  });

  it("formatOutcome names the decision and lists grounded blockers", () => {
    const blocked = formatOutcome(aggregate([verdict("security", f("security", "blocker"))]));
    expect(blocked).toContain("BLOCK");
    expect(blocked).toContain("[security]");
    const passed = formatOutcome(aggregate([verdict("perf", f("perf", "minor"))]));
    expect(passed).toContain("PASS");
  });
});
