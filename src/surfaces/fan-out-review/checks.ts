/**
 * fan-out-review — pure review-aggregation logic (no runner/manifold import, so it
 * unit-tests in isolation). The dispatch to N reviewers happens in ./index.ts (and,
 * at Tier 2, in manifold-review); what you DO with their verdicts — the gate — is
 * here.
 *
 * The load-bearing design choice (Forum b96b17c1): specialists, NOT voters.
 * Multi-agent consensus VOTING underperforms the best single agent — the
 * "popularity trap" buries a minority-correct finding. So this is a UNION of
 * findings: a SINGLE grounded blocker from ONE seat blocks; we never count votes.
 *
 * Calibration gate: deterministic evidence (tests / axe floor / Lighthouse /
 * worker-tests) blocks; LLM/vision judgements are ADVISORY until calibrated against
 * a human gold set. So a blocker-severity finding only blocks if it is grounded
 * (or its seat has been explicitly calibrated).
 */

/** The five independent specialist seats — distinct rubrics, not redundant voters. */
export type SpecialistId = "correctness" | "a11y" | "perf" | "brand-visual" | "security";

/** Any reviewing seat: the five specialists plus the adversarial verifier. */
export type SeatId = SpecialistId | "adversarial";

/**
 * How a seat's findings are grounded — this is what the calibration gate keys off.
 * `deterministic`: tests/Lighthouse/worker-tests produce hard evidence.
 * `deterministic-floor`: a deterministic floor (axe) PLUS an advisory LLM gap pass.
 * `vision` / `llm`: a model judgement, advisory until calibrated.
 */
export type Evidence = "deterministic" | "deterministic-floor" | "vision" | "llm";

export interface Seat {
  id: SeatId;
  title: string;
  /** What this seat reviews. */
  rubric: string;
  evidence: Evidence;
}

/** The five specialists. Union of findings — any blocker blocks; never a vote. */
export const SPECIALISTS: readonly Seat[] = [
  {
    id: "correctness",
    title: "Correctness / functional",
    rubric: "Does the change do what it claims? Logic, edge cases, types; tests as evidence.",
    evidence: "deterministic",
  },
  {
    id: "a11y",
    title: "Accessibility",
    rubric: "axe zero-violation floor (deterministic) + keyboard / screen-reader / contrast gaps (LLM).",
    evidence: "deterministic-floor",
  },
  {
    id: "perf",
    title: "Performance",
    rubric: "Core Web Vitals budgets + render/bundle cost; Lighthouse as evidence.",
    evidence: "deterministic",
  },
  {
    id: "brand-visual",
    title: "Brand / visual",
    rubric: "Brand + visual correctness — the vision-model seat. Advisory until calibrated.",
    evidence: "vision",
  },
  {
    id: "security",
    title: "Security",
    rubric: "Worker auth / fail-closed / schema — the security boundary; worker-tests as evidence.",
    evidence: "deterministic",
  },
];

/** The adversarial critic — tries to BREAK the change, not score it. */
export const ADVERSARIAL_VERIFIER: Seat = {
  id: "adversarial",
  title: "Adversarial verifier",
  rubric: "Try to break it: fail-open paths, edge cases, assumptions the specialists trusted. Advisory unless it lands a deterministic repro.",
  evidence: "llm",
};

const SEAT_EVIDENCE: Readonly<Record<SeatId, Evidence>> = {
  correctness: "deterministic",
  a11y: "deterministic-floor",
  perf: "deterministic",
  "brand-visual": "vision",
  security: "deterministic",
  adversarial: "llm",
};

/**
 * Whether a seat's findings are deterministically grounded BY DEFAULT. An a11y
 * finding from the axe floor is grounded; an a11y LLM-gap finding is not — so a
 * per-finding `grounded` override (see Finding) wins over this default.
 */
export function groundedDefault(seat: SeatId): boolean {
  const e = SEAT_EVIDENCE[seat];
  return e === "deterministic" || e === "deterministic-floor";
}

export type Severity = "blocker" | "major" | "minor" | "nit";

export interface Finding {
  seat: SeatId;
  severity: Severity;
  title: string;
  detail?: string;
  /**
   * Override the seat's default grounding. Set true for an LLM/vision seat that
   * lands hard evidence (e.g. the adversarial critic with a failing repro); set
   * false for a deterministic seat's speculative aside.
   */
  grounded?: boolean;
}

/** One seat's verdict: the findings it raised (empty = clean). */
export interface Verdict {
  seat: SeatId;
  findings: Finding[];
}

export interface AggregateOptions {
  /** Seats whose LLM/vision findings are calibrated, so their blockers DO block. */
  calibrated?: SeatId[];
}

export interface Outcome {
  decision: "block" | "pass";
  /** Grounded (or calibrated) blocker-severity findings — the UNION across seats. */
  blockers: Finding[];
  /** Everything else worth surfacing, incl. un-calibrated blocker findings. */
  advisories: Finding[];
}

/** Whether a finding is grounded, honouring its override then the seat default. */
export function isGrounded(finding: Finding): boolean {
  return finding.grounded ?? groundedDefault(finding.seat);
}

/**
 * Whether a finding actually blocks the merge: it must be blocker-severity AND
 * either grounded or raised by a calibrated seat. This is the calibration gate —
 * an un-calibrated LLM/vision blocker is loud but advisory.
 */
export function blocks(finding: Finding, opts: AggregateOptions = {}): boolean {
  if (finding.severity !== "blocker") return false;
  const calibrated = new Set(opts.calibrated ?? []);
  return isGrounded(finding) || calibrated.has(finding.seat);
}

/**
 * Aggregate seat verdicts into a gate decision. UNION semantics, NOT a vote: one
 * grounded blocker blocks. Un-calibrated blockers and all lower-severity findings
 * are surfaced as advisories. Pass `calibrated` to promote a calibrated seat's
 * model findings to blocking.
 */
export function aggregate(verdicts: readonly Verdict[], opts: AggregateOptions = {}): Outcome {
  const all = verdicts.flatMap((v) => v.findings);
  const blockers: Finding[] = [];
  const advisories: Finding[] = [];
  for (const f of all) {
    if (blocks(f, opts)) blockers.push(f);
    else advisories.push(f);
  }
  return { decision: blockers.length > 0 ? "block" : "pass", blockers, advisories };
}

/** A short, readable gate summary. */
export function formatOutcome(outcome: Outcome): string {
  const head =
    outcome.decision === "block"
      ? `BLOCK — ${outcome.blockers.length} grounded blocker(s)`
      : `PASS — ${outcome.advisories.length} advisory finding(s)`;
  const lines = outcome.blockers.map((b) => `  ✗ [${b.seat}] ${b.title}`);
  return [head, ...lines].join("\n");
}
