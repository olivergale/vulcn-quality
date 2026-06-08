import { describe, expect, it } from "vitest";
import {
  REGISTERABLE_NIGHTLY_SURFACES,
  REGISTERABLE_WEB_SURFACES,
  nightlySurfacesForTier,
  webSurfacesForTier,
} from "./checks";

describe("runner tier composition", () => {
  it("tier 0 wires web-smoke + hygiene (no a11y)", () => {
    expect(webSurfacesForTier(0)).toEqual(["web-smoke", "hygiene"]);
  });

  it("tier 1 adds a11y", () => {
    expect(webSurfacesForTier(1)).toEqual(["web-smoke", "hygiene", "a11y"]);
  });

  it("tier 2 is cumulative over tier 1's registerable web surfaces", () => {
    for (const s of webSurfacesForTier(1)) {
      expect(webSurfacesForTier(2)).toContain(s);
    }
  });

  it("web composition never returns a nightly, non-Playwright, or not-yet-built surface", () => {
    const all = new Set(([0, 1, 2] as const).flatMap((t) => webSurfacesForTier(t)));
    for (const s of all) expect(REGISTERABLE_WEB_SURFACES).toContain(s);
    for (const absent of ["visual", "perf", "fan-out-review", "worker-contract"] as const) {
      expect(all.has(absent)).toBe(false);
    }
  });

  it("nightly composition is empty at tier 0 and wires visual at tiers 1+", () => {
    expect(nightlySurfacesForTier(0)).toEqual([]);
    expect(nightlySurfacesForTier(1)).toEqual(["visual"]);
    expect(nightlySurfacesForTier(2)).toEqual(["visual"]);
  });

  it("nightly composition only returns registerable nightly surfaces (perf runs via @lhci/cli)", () => {
    const all = new Set(([0, 1, 2] as const).flatMap((t) => nightlySurfacesForTier(t)));
    for (const s of all) expect(REGISTERABLE_NIGHTLY_SURFACES).toContain(s);
    expect(all.has("perf")).toBe(false);
  });
});
