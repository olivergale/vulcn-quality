/**
 * vulcn-quality — public API.
 *
 * Surfaces are reusable QC modules; tiers compose them by project criticality.
 * Import a surface's registration fn into a consumer's Playwright spec, or read
 * the tier model to drive CI composition. Canonical scope: Forum b96b17c1.
 */
export * as tiers from "./tiers/index";
export * as webSmoke from "./surfaces/web-smoke/index";
export * as hygiene from "./surfaces/hygiene/index";
export * as workerContract from "./surfaces/worker-contract/index";
export * as a11y from "./surfaces/a11y/index";
