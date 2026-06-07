/**
 * worker-contract surface — public API.
 *
 * The reusable value is the vetted primitives in ./checks (constant-time secret
 * comparison, fail-closed verification, schema parse-or-null). A consumer writes
 * its endpoint-specific contract test with @cloudflare/vitest-pool-workers and
 * these helpers — the per-endpoint shape can't be generalized, but the security
 * primitives must not be reimplemented per repo.
 *
 * Pattern (in a consuming Worker repo, `*.contract.test.ts`):
 *
 * ```ts
 * import { env, SELF } from "cloudflare:test";
 * import { describe, expect, it } from "vitest";
 * import { isFailClosedStatus } from "@vulcn/quality/surfaces/worker-contract";
 *
 * describe("/attio-webhook contract", () => {
 *   it("fails closed when the signature is missing", async () => {
 *     const res = await SELF.fetch("https://x/attio-webhook", { method: "POST", body: "{}" });
 *     expect(isFailClosedStatus(res.status)).toBe(true); // denied, not 2xx, not 5xx
 *   });
 * });
 * ```
 */
export * from "./checks";
