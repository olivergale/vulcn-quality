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

Status: v0.1 — `web-smoke` + `hygiene` + `worker-contract` + `a11y` surfaces + the tier model. Remaining surfaces and the reusable tier CI workflows are tracked on the `vulcn-quality` Linear project.

Canonical scope + decisions: Forum architecture doc `b96b17c1`.
