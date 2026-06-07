import { describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  failClosed,
  isEmail,
  isFailClosedStatus,
  parseOrNull,
  verifySharedSecret,
  type SafeParser,
} from "./checks";

describe("worker-contract checks", () => {
  it("constantTimeEqual: equal strings only, length-mismatch and empty are false", () => {
    expect(constantTimeEqual("secret", "secret")).toBe(true);
    expect(constantTimeEqual("secret", "secreT")).toBe(false);
    expect(constantTimeEqual("secret", "secre")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(false);
  });

  it("verifySharedSecret fails closed when either side is missing", () => {
    expect(verifySharedSecret("abc", "abc")).toBe(true);
    expect(verifySharedSecret("abc", "xyz")).toBe(false);
    expect(verifySharedSecret(null, "abc")).toBe(false);
    expect(verifySharedSecret("abc", undefined)).toBe(false);
    expect(verifySharedSecret("", "")).toBe(false);
  });

  it("isEmail accepts well-formed addresses, rejects junk and non-strings", () => {
    expect(isEmail("a@b.com")).toBe(true);
    expect(isEmail("nope")).toBe(false);
    expect(isEmail("a@b")).toBe(false);
    expect(isEmail(123)).toBe(false);
    expect(isEmail(null)).toBe(false);
  });

  it("parseOrNull returns data on success, null on failure (fail-closed)", () => {
    const okSchema: SafeParser<{ email: string }> = {
      safeParse: (i) => ({ success: true, data: i as { email: string } }),
    };
    const badSchema: SafeParser<never> = { safeParse: () => ({ success: false }) };
    expect(parseOrNull(okSchema, { email: "a@b.com" })).toEqual({ email: "a@b.com" });
    expect(parseOrNull(badSchema, { email: "" })).toBeNull();
  });

  it("failClosed builds a JSON deny Response", async () => {
    const res = failClosed(403, "forbidden", "bad signature");
    expect(res.status).toBe(403);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(await res.json()).toEqual({ error: "forbidden", detail: "bad signature" });
  });

  it("isFailClosedStatus is true only for auth-deny statuses", () => {
    expect(isFailClosedStatus(401)).toBe(true);
    expect(isFailClosedStatus(403)).toBe(true);
    expect(isFailClosedStatus(200)).toBe(false);
    expect(isFailClosedStatus(500)).toBe(false);
  });
});
