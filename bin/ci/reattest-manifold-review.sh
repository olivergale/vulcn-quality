#!/usr/bin/env bash
# VLCN-541: re-attest `manifold-review` across a no-op rebase.
#
# Problem: branch protection on main is `strict` (up-to-date required) AND
# `manifold-review` is a required commit status tied to the PR HEAD SHA. Every
# rebase to satisfy strict-up-to-date mints a new head SHA, so the prior
# `manifold-review` status no longer applies and a full reviewer re-run (~3 min)
# is required. Under multi-agent contention on main, another merge lands during
# that window and the PR is BEHIND again — merge starvation (the PR-merge-layer
# instance of the parallel-safety class VLCN-330 addresses at the WO layer).
#
# Fix: when a `synchronize` (push/rebase) did NOT change the PR's actual diff
# content — proven by BOTH an identical `git patch-id --stable` of the PR's
# three-dot diff (the same logical change relative to a possibly-advanced base)
# AND byte-identical PR-owned changed files between the two heads (a two-dot diff;
# closes patch-id's whitespace-blindness) — the prior `manifold-review` verdict is
# still valid for the unchanged diff. Copy it to the new head SHA so the
# reviewer's diff-judgment is carried without a re-run.
#
# Safety: `manifold-eval` (the OTHER required check) STILL re-runs on the new SHA
# independently, so base-integration breakage introduced by the rebase is caught.
# This only carries the reviewer's *diff* judgment, and ONLY when the diff is
# patch-content-identical AND the prior verdict was a `success` bearing a
# reviewer/carry provenance marker. It cannot pass an unreviewed or changed diff.
# Every guard fails SAFE (skip → a normal review is still required); it never
# posts a `failure` or weakens the gate. The workflow runs the TRUSTED base-ref
# copy of this script (never the PR-head copy) so a PR cannot rewrite this logic.
set -euo pipefail

REPO="${REPO:?REPO (owner/repo) required}"
BASE_REF="${BASE_REF:?BASE_REF (PR base branch) required}"
HEAD_SHA="${HEAD_SHA:?HEAD_SHA (new head after the push) required}"
BEFORE_SHA="${BEFORE_SHA:?BEFORE_SHA (github.event.before) required}"
DRY_RUN="${DRY_RUN:-0}"
CONTEXT="manifold-review"

log() { echo "[reattest] $*" >&2; }

# A brand-new branch / first push carries an all-zero `before` SHA — nothing to
# carry forward.
if [[ "$BEFORE_SHA" =~ ^0+$ ]]; then
  log "before SHA is all-zero (new branch) — nothing to re-attest"
  exit 0
fi

if [[ "$BEFORE_SHA" == "$HEAD_SHA" ]]; then
  log "before == head — no push delta; nothing to do"
  exit 0
fi

# Ensure all three objects are local (the rebased-away `before` SHA is no longer
# on any ref, so fetch it explicitly).
if ! git fetch --no-tags --quiet origin "$BASE_REF" "$HEAD_SHA" "$BEFORE_SHA" 2>/dev/null; then
  log "could not fetch base/head/before objects — skipping (a normal review applies)"
  exit 0
fi

# patch-id of the PR's three-dot diff (the PR's own changes since its merge-base
# with the base branch). --stable hashes the patch CONTENT, independent of commit
# SHAs / surrounding base commits, so a clean rebase preserves it and a real diff
# change breaks it.
pid_of() {
  git diff "origin/${BASE_REF}...$1" 2>/dev/null | git patch-id --stable | awk '{print $1}'
}
OLD_PID="$(pid_of "$BEFORE_SHA")"
NEW_PID="$(pid_of "$HEAD_SHA")"
log "old_pid=${OLD_PID:0:16} new_pid=${NEW_PID:0:16}"

if [[ -z "$NEW_PID" || "$OLD_PID" != "$NEW_PID" ]]; then
  log "PR diff changed across the push (or empty) — a fresh manifold review is required"
  exit 0
fi

# patch-id --stable is whitespace/offset-blind, so the match above does NOT prove
# byte-equality: a "rebase" could sneak a whitespace-only-but-semantically-
# meaningful edit (Python indentation = block structure; YAML re-indentation
# re-parents keys — directly relevant since this feature governs .github/workflows
# + bin/ci) and carry the verdict with no re-read (VLCN-541 security review, High).
# Close it: require the PR's OWN changed files to be byte-identical between before
# and after. A true no-op rebase only shifts the base, so the PR's files are
# untouched (two-dot diff empty); any whitespace-significant edit makes it
# non-empty → fall back to a fresh review. (If the base advanced INTO one of the
# PR's files, the merged content differs → also a fresh review, correctly.)
# (portable array fill — avoid `mapfile`, absent on macOS bash 3.2)
changed_paths=()
while IFS= read -r _p; do [[ -n "$_p" ]] && changed_paths+=("$_p"); done \
  < <(git diff --name-only "origin/${BASE_REF}...${HEAD_SHA}" 2>/dev/null)
if [[ ${#changed_paths[@]} -eq 0 ]] ||
  ! git diff --quiet "${BEFORE_SHA}" "${HEAD_SHA}" -- "${changed_paths[@]}" 2>/dev/null; then
  log "PR's own files are not byte-identical before/after (whitespace-significant or merged edit) — a fresh manifold review is required"
  exit 0
fi

# The PR diff is byte-identical (stable patch-id + byte-identical changed files).
# Carry the prior verdict — but ONLY if it was a success (never re-attest a
# request_changes / failure / absent status).
PRIOR="$(gh api "repos/${REPO}/commits/${BEFORE_SHA}/statuses" \
  --jq "[.[] | select(.context==\"${CONTEXT}\")] | first // {}" 2>/dev/null || echo '{}')"
PRIOR_STATE="$(jq -r '.state // "none"' <<<"$PRIOR")"
PRIOR_DESC="$(jq -r '.description // ""' <<<"$PRIOR")"
log "prior ${CONTEXT} on ${BEFORE_SHA:0:12}: state=${PRIOR_STATE}"

if [[ "$PRIOR_STATE" != "success" ]]; then
  log "prior ${CONTEXT} was not success (${PRIOR_STATE}) — not re-attesting; a normal review applies"
  exit 0
fi

# Provenance guard (VLCN-541 security review, High): only PROPAGATE a success that
# is itself either a genuine reviewer verdict (deriveReviewStatus descriptions
# start with "verdict=approve") or a prior valid carry from this workflow (the
# "re-attested across no-op rebase" marker). Combined with the PPE closure in the
# workflow (only the trusted base-ref script runs with statuses:write, so these
# descriptions cannot be forged by PR-head code), this binds every carried success
# to a real reviewer-posted root — closing the "trusts ANY success" propagation
# path. An operator override posts its own description; if a future override needs
# to seed a carry chain it must include one of these markers.
REVIEWER_PREFIX="verdict=approve"
CARRY_MARKER="re-attested across no-op rebase"
if [[ "$PRIOR_DESC" != "$REVIEWER_PREFIX"* && "$PRIOR_DESC" != *"$CARRY_MARKER"* ]]; then
  log "prior ${CONTEXT} success has no reviewer/carry provenance marker — not re-attesting (a normal review applies)"
  exit 0
fi

DESC="${CARRY_MARKER} (VLCN-541): ${PRIOR_DESC}"
DESC="${DESC:0:140}"

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY_RUN: would post ${CONTEXT}=success to ${HEAD_SHA} — \"${DESC}\""
  exit 0
fi

gh api -X POST "repos/${REPO}/statuses/${HEAD_SHA}" \
  -f state=success \
  -f context="${CONTEXT}" \
  -f "description=${DESC}" >/dev/null
log "re-attested ${CONTEXT}=success to ${HEAD_SHA:0:12} (identical patch-id ${NEW_PID:0:16})"
