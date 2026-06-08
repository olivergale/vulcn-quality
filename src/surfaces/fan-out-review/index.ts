/**
 * fan-out-review — the dispatch + aggregation surface for Tier 2. The pure gate
 * lives in ./checks; this exposes the canonical fan-out PLAN that a dispatcher
 * (manifold-review) runs, and a structural adapter that maps a review tool's
 * per-seat output back into verdicts for the gate.
 *
 * At Tier 2 the dispatcher IS manifold-review — it already runs independent
 * specialists + an adversarial verifier and unions their blockers, which is
 * exactly this design. This surface is the canonical seat roster + the gate
 * semantics, so any dispatcher (manifold-review today, another tomorrow) produces
 * the same decision. No manifold import — the adapter is structural — so it stays
 * unit-testable and tool-agnostic.
 */
import {
  ADVERSARIAL_VERIFIER,
  SPECIALISTS,
  aggregate,
  type AggregateOptions,
  type Outcome,
  type Seat,
  type SeatId,
  type Severity,
  type Verdict,
} from "./checks";

export * from "./checks";

export interface ReviewPlan {
  /** The five independent specialist seats. */
  specialists: readonly Seat[];
  /** The adversarial critic, run alongside the specialists. */
  verifier: Seat;
  /** One-line statement of the gate the dispatcher must honour. */
  gate: string;
}

/**
 * The canonical fan-out plan a Tier-2 dispatcher runs: five specialists + one
 * adversarial verifier, six independent seats. The gate is union-of-blockers, NOT
 * a vote — wire the dispatcher to surface every seat's findings, never a majority.
 */
export function reviewPlan(): ReviewPlan {
  return {
    specialists: SPECIALISTS,
    verifier: ADVERSARIAL_VERIFIER,
    gate: "union of blockers (not a vote); deterministic evidence blocks, LLM/vision advisory until calibrated",
  };
}

/** All seats the plan dispatches, in order (specialists then the verifier). */
export function reviewSeats(): SeatId[] {
  return [...SPECIALISTS.map((s) => s.id), ADVERSARIAL_VERIFIER.id];
}

/** Minimal structural shape of one seat's output from a review tool. */
export interface SeatResult {
  seat: SeatId;
  findings: Array<{
    severity: Severity;
    title: string;
    detail?: string;
    grounded?: boolean;
  }>;
}

/** Map a review tool's per-seat results into verdicts the gate consumes. */
export function fromSeatResults(results: readonly SeatResult[]): Verdict[] {
  return results.map((r) => ({
    seat: r.seat,
    findings: r.findings.map((f) => ({ seat: r.seat, ...f })),
  }));
}

/**
 * End-to-end gate from a review tool's raw seat results: adapt, then aggregate.
 * Pass `calibrated` to promote a calibrated seat's model findings to blocking.
 */
export function reviewOutcome(
  results: readonly SeatResult[],
  opts: AggregateOptions = {},
): Outcome {
  return aggregate(fromSeatResults(results), opts);
}
