import { describe, expect, it } from "vitest";
import {
  blockingSurfacesForTier,
  NIGHTLY_SURFACES,
  surfacesForTier,
  TIER_SURFACES,
} from "./index";

describe("tiers", () => {
  it("tier 0 is the low-touch site set", () => {
    expect(surfacesForTier(0)).toEqual(["web-smoke", "worker-contract", "hygiene"]);
  });

  it("higher tiers are cumulative supersets", () => {
    const t1 = new Set(surfacesForTier(1));
    const t2 = new Set(surfacesForTier(2));
    for (const s of surfacesForTier(0)) expect(t1.has(s)).toBe(true);
    for (const s of surfacesForTier(1)) expect(t2.has(s)).toBe(true);
  });

  it("nightly surfaces are never in the blocking set", () => {
    for (const s of NIGHTLY_SURFACES) {
      expect(blockingSurfacesForTier(2)).not.toContain(s);
    }
  });

  it("tier 2 adds fan-out-review on top of tier 1", () => {
    expect(surfacesForTier(2)).toContain("fan-out-review");
    expect(TIER_SURFACES[2].length).toBe(TIER_SURFACES[1].length + 1);
  });
});
