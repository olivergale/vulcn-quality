# Vulcn Quality — Agent Context

> **v3 shared library** (services bucket, sibling of `vulcn-render`) — NOT a deployed
> service. No Supabase, no Edge Functions, **no Deno**: this is an npm/Node repo
> (vitest + eslint + tsc), so the fleet's deno preflight pin does not apply here.
> Canonical scope + decisions: Forum architecture doc `b96b17c1`; build-fidelity
> doctrine: Forum doc `0db70efc`; platform North Star `a8873cf0`. This file is agent
> context for the `quality` repo specifically.

## What this repo is

Quality plane — composable, reusable QC **surfaces** + project **tiers**. A project
plane (Aexodus, BaseTwo, enex, +N) composes its quality gate from these shared
surfaces at a tier set by criticality, instead of bespoke per-project QC.

- **Surfaces** (`src/surfaces/<name>/`): `web-smoke`, `hygiene`, `worker-contract`,
  `a11y` (pre-merge, blocking) · `visual`, `perf` (nightly, report-only) ·
  `fan-out-review` (Tier 2, advisory until calibrated). Each splits pure logic
  (`checks.ts`, browser-free, unit-tested here) from the consumer-facing API
  (`index.ts`, may register Playwright tests).
- **Tiers** (`src/tiers/`): 0 low-touch site · 1 customer-facing product · 2
  platform; cumulative. `BLOCKING_SURFACES` vs `NIGHTLY_SURFACES` is the
  merge-gate split.
- **Runner** (`src/runner/`): `registerTier` / `registerNightly` — the one-call
  consumer-side composition; paired with the reusable `workflow_call` workflows
  `.github/workflows/quality.yml` + `quality-nightly.yml` that CONSUMER repos call.

Consumption is at arm's length: a consumer pins the git dep
(`"@vulcn/quality": "github:olivergale/vulcn-quality#vX.Y.Z"`), imports a surface
into its own thin spec, and calls the reusable workflow from its own CI. This
repo's own CI never launches a browser — the heavy Playwright execution belongs
to consumer CI.

## Surfaces must have consumers (doctrine P2.7)

**A surface with no registered consumer is mis-homed.** This is the
gate-with-nothing-to-gate lesson: a `module-contract` surface was built here
(PR #6, 2026-06-08) and reverted the next morning (PR #7) because its real home
was the host repo's CI — quality had nothing to run it against.

- `surfaces.registry.json` (repo root) is the registration manifest: one row per
  surface — `{surface, consumer_repo, consumer_workflow, status}`. `status:
  "active"` requires a VERIFIED consumer (fetch the consuming workflow, e.g.
  `gh api repos/<owner>/<repo>/contents/<workflow>` — never invent one);
  `status: "unconsumed"` is the honest empty state.
- `src/surface-parity.test.ts` enforces registry coverage + row shape
  (blocking) and prints unconsumed surfaces via `console.warn` (warn-tier —
  consumer RESOLUTION never blocks this repo's CI; VLCN-631).
- Before building a new surface: name the consuming repo + workflow FIRST, add
  the registry row in the same PR. If you cannot name a consumer, the surface
  belongs in the host repo, not here.

## Ship loop

Operator-direct PRs (v3 — does NOT route through omv2 `bin/wo`).

1. **Branch** (WO shape only; `chore/` is retracted fleet-wide, VLCN-409; manual
   NNN-picking forbidden):
   ```bash
   SLUG=$(~/projects/vulcn/manifold/bin/next-slug.sh)
   git checkout -b "$SLUG/<kebab-description>"
   ```
2. **Preflight** (npm, NOT deno — all three must be green before push):
   ```bash
   npm run lint && npm run typecheck && npm test
   ```
3. **PR** to `main` on `olivergale/vulcn-quality`; reference `VLCN-NNN` in the
   title/body for traceability. Wait for green `manifold-eval`.
4. **Review trio**: `cd ~/projects/vulcn/manifold && source ~/.zshrc &&
   bin/manifold review <PR-url>` — posts the `manifold-review` status to the PR
   head SHA. It is `success` only on a non-block `approve` that names a
   live-boundary signal.
5. **Self-merge on green** (BOTH checks) per [[v3-self-merge-on-green]]:
   `gh pr merge <n> --squash --delete-branch`.
6. **Reconcile** (always, per [[post-merge-local-reconcile]]): `git fetch
   --prune && git checkout main && git pull --ff-only`.

## Naming

Surface convention (enforced by `src/surface-parity.test.ts`):

| Artifact          | Convention                                                            |
| ----------------- | --------------------------------------------------------------------- |
| Surface dir       | `src/surfaces/<kebab-name>/`                                          |
| Required files    | `checks.ts` (pure logic, browser-free) + `index.ts` (public API; may import Playwright — peer dep) + `checks.test.ts` |
| Optional          | `index.test.ts` when `index.ts` carries its own logic (`fan-out-review`, `perf`) |
| Export entry      | `package.json` `exports`: `"./surfaces/<name>": "./src/surfaces/<name>/index.ts"` |
| Registration fn   | `register<PascalName>` for Playwright surfaces (e.g. `registerWebSmoke`) |
| Tier membership   | add to the `Surface` union + `TIER_SURFACES` in `src/tiers/index.ts`; wire `src/runner/checks.ts` `REGISTERABLE_*` only when the runner composes it |
| Consumer registry | row in `surfaces.registry.json` (same PR — see doctrine P2.7 above)    |

Non-code artifacts:

| Artifact            | Convention                                                                  |
| ------------------- | --------------------------------------------------------------------------- |
| Repo path           | `~/projects/vulcn/quality/`                                                 |
| GitHub repo         | `olivergale/vulcn-quality` (**public** since 2026-06-10 — operator call, VLCN-602: consumers npm-install the git-dep anonymously; gate action runs via read-only deploy key)                                        |
| User-facing display | "Vulcn Quality" titlecase                                                   |
| npm name            | `@vulcn/quality` (consumed as a PINNED git dep `github:olivergale/vulcn-quality#vX.Y.Z` — git TAGS are the consumption pin; `package.json` version lags them, bump tracked VLCN-613) |
| Branch shape        | `WO-YYYY-MM-DD-NNN/<kebab>` via `bin/next-slug.sh` (see Ship loop)          |

## CI checks

Required (branch protection on `main`, `enforce_admins=true` — verified via
`gh api .../branches/main/protection` 2026-06-09):

- **`manifold-eval`** — `.github/workflows/manifold-eval.yml`, a thin caller of
  the shared `manifold-eval-gate` composite action (vulcn-manifold), **node
  profile**: branch-shape validation + `npm ci` + `npm run typecheck` +
  `npm run lint` + `npm test`. Fast and browser-free by design.
- **`manifold-review`** — NOT a workflow in this repo; posted to the PR head SHA
  by `bin/manifold review <PR-url>` (vulcn-manifold reviewer trio). Without it
  the merge stays blocked even on green CI.

Informational: none today — there are no other PR-triggered workflows here.
`.github/workflows/quality.yml` and `quality-nightly.yml` are `workflow_call`
REUSABLE workflows that CONSUMER repos call from their own CI; they never run on
this repo's PRs and are not checks here.

## Commands

```bash
npm ci                 # install (lockfile)
npm run lint           # eslint .
npm run typecheck      # tsc --noEmit
npm test               # vitest run (60+ unit tests, browser-free)

# Branch (WO-tracked) — allocate slug atomically, then branch
SLUG=$(~/projects/vulcn/manifold/bin/next-slug.sh)
git checkout -b "$SLUG/<kebab-description>"
```

## Bounded context

Quality does: define reusable QC surfaces (pure checks + registration fns), the
tier model, the reusable consumer workflows, and the consumer registry.

Quality does NOT: run browsers or consumer suites in its own CI; gate consumer
repos from here (consumers call the reusable workflows from their own CI); host
host-repo-specific gates (P2.7 — that was the `module-contract` mistake);
deploy anything; own a Supabase schema; replace manifold-review
(`fan-out-review` is the canonical seat roster + gate semantics that
manifold-review dispatches — quality imports nothing from manifold and vice
versa).

## Read also

- Forum `b96b17c1` — canonical scope + decisions (surfaces, tiers, merge-gate
  semantics)
- Forum `0db70efc` — build-fidelity doctrine (P2.7 consumer rule; VLCN-630/631)
- Forum `a8873cf0` — platform North Star (read first for architectural work)
- `README.md` — consumer-facing usage (tier opt-in, nightly, fan-out-review)
- `~/.claude/projects/-Users-OG-projects/memory/feedback_v3_self_merge_on_green.md`
- `~/.claude/projects/-Users-OG-projects/memory/feedback_v3_does_not_route_through_omv2_bin_wo.md`
- `~/.claude/projects/-Users-OG-projects/memory/feedback_post_merge_local_reconcile.md`
