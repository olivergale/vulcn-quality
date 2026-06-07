# vulcn-quality

Composable, reusable QC **surfaces** + project **tiers** for the Vulcn platform. A project plane (Aexodus, BaseTwo, enex, +N) composes its quality gate from the same shared surfaces at a tier set by criticality — not bespoke per project. Services-bucket sibling of `vulcn-render` (a shared library consumed at arm's length).

## Surfaces

| Surface | Checks | Tool |
|---|---|---|
| `web-smoke` | pages 2xx + key elements present | Playwright |
| `worker-contract` | the code we own: auth / fail-closed / schema | vitest-pool-workers + Zod |
| `hygiene` | broken links / console errors / OG+meta / mixed-content | Playwright |
| `a11y` | accessibility zero-violation floor | axe-core/playwright |
| `visual` | screenshot pixel-diff (nightly, opt-in) | Playwright + Argos |
| `perf` | Core Web Vitals budgets (nightly, opt-in) | Lighthouse CI |
| `fan-out-review` | N specialists + adversarial verifier | manifold-review |

## Tiers

- **Tier 0** — low-touch site: `web-smoke` + `worker-contract` + `hygiene`.
- **Tier 1** — customer-facing product: + `a11y` + `visual` + `perf` (nightly).
- **Tier 2** — platform: + `fan-out-review` + pre-promote gates.

Merge gate: all deterministic surfaces green AND no specialist blocker; LLM/vision verdicts advisory until calibrated against a human gold set.

## Use

A consuming repo adds a thin Playwright spec that imports a surface and feeds it the project's routes:

```ts
import { registerWebSmoke } from "@vulcn/quality/surfaces/web-smoke";

registerWebSmoke({
  baseUrl: process.env.BASE_URL!,
  routes: [{ path: "/", mustContain: ["Aexodus"] }],
});
```

### One-line tier opt-in

Rather than wiring each surface by hand, compose a whole tier in one call with `registerTier`, and adopt it in CI with one caller block.

In the consuming repo, one spec (`quality/tier.spec.ts`):

```ts
import { registerTier } from "@vulcn/quality/runner";

registerTier({
  tier: Number(process.env.QUALITY_TIER ?? 0),
  baseUrl: process.env.BASE_URL!,
  routes: [{ path: "/", mustContain: ["Aexodus"] }],
});
```

…and one caller workflow that runs the tier in CI:

```yaml
# .github/workflows/quality.yml (in the consuming repo)
name: quality
on: [pull_request]
jobs:
  quality:
    uses: olivergale/vulcn-quality/.github/workflows/quality.yml@main
    with:
      tier: 0
      base_url: https://staging.example.com
```

`registerTier` composes the built deterministic web surfaces for the tier (web-smoke + hygiene at tier 0; + a11y at tier 1). worker-contract runs in the consumer's own vitest-pool-workers job; `visual` / `perf` (nightly) + `fan-out-review` (tier 2) land with VLCN-600/601.

Status: v0.1 — `web-smoke` + `hygiene` + `worker-contract` + `a11y` surfaces, the tier model, `registerTier`, and the reusable `quality.yml` tier workflow. Remaining surfaces (`visual` / `perf` / `fan-out-review`) are tracked on the `vulcn-quality` Linear project.

Canonical scope + decisions: Forum architecture doc `b96b17c1`.
