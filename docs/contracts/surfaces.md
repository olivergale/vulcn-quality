# Contract — authoring a quality surface

**This is the source of truth** for how a new QC surface ships here. Don't
reconstruct the convention from an exemplar surface — that mechanism is the
ENE-347 failure class (doctrine Forum `0db70efc` P1.1; ticket VLCN-638).
CLAUDE.md §Naming covers identifiers; this doc covers the artifact contract.

## The artifact class

A surface is one folder under `src/surfaces/<name>/` (exemplars: `hygiene`,
`web-smoke`, `worker-contract`) plus its registry row and consumption story:

| Piece            | Where                          | Rule                                                          |
| ---------------- | ------------------------------ | -------------------------------------------------------------- |
| Surface module   | `src/surfaces/<name>/`         | composable; no hidden cross-surface imports                    |
| Registry row     | `surfaces.registry.json` (root)| REQUIRED in the same PR — `status: "active"` only with a VERIFIED consumer (fetch the consuming workflow; never invent one); `"unconsumed"` is the honest empty state |
| Tier wiring      | `src/tiers/`                   | where the surface composes into tier presets                   |
| Consumer surface | consumer repo's CI             | reusable mode (`workflows/quality.yml` workflow_call) or package mode (`@vulcn/quality` git-dep pinned to a TAG) |

**A surface with no registered consumer is mis-homed** (doctrine P2.7): name
the consuming repo + workflow BEFORE building. Don't manufacture surfaces.

## Enforcing CI (what makes this contract real)

`src/surface-parity.test.ts` is the gate (blocking, under `manifold-eval`'s
node profile): every `src/surfaces/*` has a registry row with valid shape
(`status ∈ {active, unconsumed}`; active requires `consumer_repo` +
`consumer_workflow`; unconsumed requires null consumers), and it
console.warns unconsumed surfaces (warn-tier — consumer resolution never
blocks this repo's CI). Nightly, vulcn-manifold's `registry-verify.yml`
re-verifies every active row against the LIVE consumer (reusable-path or
package-manifest reference) and auto-PRs broken rows back to `unconsumed`
(VLCN-641) — a row you flip to active gets machine-checked from then on.

## Conventions that bite

- **Consumption pin is the git TAG** (`github:olivergale/vulcn-quality#vX.Y.Z`),
  not package.json's version field (it lags; VLCN-613). Cutting a release =
  tag push; consumers bump deliberately.
- **This repo is PUBLIC** (VLCN-602) — no secrets, no client names in
  comments/fixtures; the gate action is fetched via a read-only deploy key
  because public repos can't reference private actions.
- **Heavy execution lives in CONSUMER CI** via the reusable tier workflows
  (`workflows/quality.yml`, `quality-nightly.yml` — workflow_call only,
  never checks here). This repo's own gate stays fast and browser-free.

## Ship loop

1. Slug via `~/projects/vulcn/manifold/bin/next-slug.sh` → branch
   `WO-YYYY-MM-DD-NNN/<kebab-slug>`.
2. Author surface + registry row (+ tier wiring) in one PR. Pre-push:
   `npm run lint && npm run typecheck && npm test` (parity test must pass).
3. PR → `manifold-eval` green → trio verdict → self-merge on green.
4. Live pass: the consumer's workflow RUNNING the surface (or resolving the
   package) is the boundary — cite the consumer run, not this repo's CI.

Pointer: repo `CLAUDE.md` → this file. Fleet gate model: vulcn-manifold
`docs/contracts/fleet-ci.md`.
