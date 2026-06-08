# vulcn-quality

Composable, reusable QC **surfaces** + project **tiers** for the Vulcn platform. A project plane (Aexodus, BaseTwo, enex, +N) composes its quality gate from the same shared surfaces at a tier set by criticality — not bespoke per project. Services-bucket sibling of `vulcn-render` (a shared library consumed at arm's length).

## Surfaces

| Surface | Checks | Tool |
|---|---|---|
| `web-smoke` | pages 2xx + key elements present | Playwright |
| `worker-contract` | the code we own: auth / fail-closed / schema | vitest-pool-workers + Zod |
| `hygiene` | broken links / console errors / OG+meta / mixed-content | Playwright |
| `a11y` | accessibility zero-violation floor | axe-core/playwright |
| `visual` | screenshot pixel-diff, routes × breakpoints (nightly, opt-in) | Playwright `toHaveScreenshot` (Argos optional) |
| `perf` | Core Web Vitals budgets, median of 3+ w/ margin (nightly, opt-in) | Lighthouse CI (`@lhci/cli`) |
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

`registerTier` composes the built deterministic web surfaces for the tier (web-smoke + hygiene at tier 0; + a11y at tier 1). worker-contract runs in the consumer's own vitest-pool-workers job; the nightly surfaces (`visual` / `perf`) go through `registerNightly` + `quality-nightly.yml` (below); `fan-out-review` (tier 2) lands with VLCN-601.

### Nightly surfaces (visual + perf) — opt-in, report-only

`visual` and `perf` are noisy run-to-run, so they REPORT on a schedule rather than block a PR. Compose `visual` for a tier in one call (mirrors `registerTier`), in a nightly spec (`quality/nightly.spec.ts`):

```ts
import { registerNightly } from "@vulcn/quality/runner";

registerNightly({
  tier: Number(process.env.QUALITY_TIER ?? 0), // tier 0 composes nothing nightly; 1+ adds visual
  baseUrl: process.env.BASE_URL!,
  routes: [{ path: "/", mask: ["#last-updated"] }], // mask dynamic regions
});
```

`perf` runs as a separate Lighthouse CI job. Generate a `lighthouserc` from the shared budgets so they stay consistent across projects:

```js
// lighthouserc.cjs (in the consuming repo) — committed; budgets live in @vulcn/quality
const { lighthouserc } = require("@vulcn/quality/surfaces/perf");
module.exports = lighthouserc({ urls: [process.env.BASE_URL + "/"] }); // median of 3 runs, default budgets
```

…and one caller workflow, on a schedule (never a required check):

```yaml
# .github/workflows/quality-nightly.yml (in the consuming repo)
name: quality-nightly
on:
  schedule: [{ cron: "0 6 * * *" }]
  workflow_dispatch:
jobs:
  nightly:
    uses: olivergale/vulcn-quality/.github/workflows/quality-nightly.yml@main
    with:
      tier: 1
      base_url: https://staging.example.com
```

Visual baselines live in the consumer repo — commit them with a local `npx playwright test --update-snapshots` and review them like code.

Status: v0.2 — `web-smoke` + `hygiene` + `worker-contract` + `a11y` (pre-merge) + `visual` + `perf` (nightly) surfaces, the tier model, `registerTier` / `registerNightly`, and the reusable `quality.yml` + `quality-nightly.yml` workflows. Remaining surface (`fan-out-review`) is tracked on the `vulcn-quality` Linear project.

Canonical scope + decisions: Forum architecture doc `b96b17c1`.
