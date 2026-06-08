/**
 * module-contract surface — public API.
 *
 * The first STATIC quality-plane surface: a deterministic completeness gate for
 * code modules (enex marketplace adapters today). The other surfaces check a
 * running site (Playwright/axe/Lighthouse); this one checks a module's source
 * tree. Composed at Tier 2 for module repos; invoked directly by the repo's CI
 * (see the `module-contract` bin) rather than through the web `registerTier`.
 *
 * Forum plan 7061b2c3; architecture b96b17c1.
 *
 * ```ts
 * import { runContract, formatResult } from "@vulcn/quality/surfaces/module-contract";
 * const result = runContract("modules/binance", "tier2");
 * if (!result.pass) { console.error(formatResult(result)); process.exit(1); }
 * ```
 */
export * from "./checks";
