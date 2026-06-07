/**
 * worker-contract — the code we own: auth / fail-closed / schema.
 *
 * Runtime-agnostic primitives a Cloudflare Worker (or its vitest-pool-workers
 * contract test) shares instead of reimplementing inline. Extracted from the
 * Aexodus worker, where `constantTimeEqual` / `isEmail` / the fail-closed secret
 * check lived per-repo. The security boundary: fail-open is the worst outcome.
 *
 * No `cloudflare:test` / vitest import here, so this unit-tests in plain Node.
 */

/** Length-checked, constant-time string comparison for shared secrets. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Pragmatic email check matching the shape a Worker accepts at a form gate. */
export function isEmail(s: unknown): s is string {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Fail-closed shared-secret check: rejects when EITHER side is empty/absent, so a
 * misconfigured Worker (missing secret binding) DENIES rather than allows.
 * Constant-time on the comparison path.
 */
export function verifySharedSecret(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!provided || !expected) return false;
  return constantTimeEqual(provided, expected);
}

/** Minimal structural shape of a Zod (or compatible) schema — avoids a hard zod dep. */
export interface SafeParser<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
}

/** Parse `input` with `schema`, returning the data or null (fail-closed on invalid input). */
export function parseOrNull<T>(schema: SafeParser<T>, input: unknown): T | null {
  const result = schema.safeParse(input);
  return result.success ? result.data : null;
}

export interface FailClosedBody {
  error: string;
  detail?: string;
}

/** Build a fail-closed JSON Response (default 401). A Worker returns this on auth/schema failure. */
export function failClosed(status = 401, error = "unauthorized", detail?: string): Response {
  const body: FailClosedBody = detail ? { error, detail } : { error };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * A request that SHOULD be rejected is fail-closed iff it returns an auth-deny
 * (401/403) — not a 2xx (wrongly allowed) and not a 5xx (crash/leak).
 */
export function isFailClosedStatus(status: number): boolean {
  return status === 401 || status === 403;
}
