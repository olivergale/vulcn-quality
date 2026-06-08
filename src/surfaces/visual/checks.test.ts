import { describe, expect, it } from "vitest";
import {
  DEFAULT_DIFF_OPTIONS,
  DEFAULT_VIEWPORTS,
  duplicateNames,
  expandCases,
  slugForPath,
  snapshotName,
  type Viewport,
  type VisualRoute,
} from "./checks";

const vp = (name: string): Viewport => ({ name, width: 100, height: 100 });

describe("visual checks", () => {
  it("slugForPath produces a stable, fs-safe slug; root for /", () => {
    expect(slugForPath("/")).toBe("root");
    expect(slugForPath("")).toBe("root");
    expect(slugForPath("/deals")).toBe("deals");
    expect(slugForPath("/deals/vetted-lp")).toBe("deals-vetted-lp");
    expect(slugForPath("/deals/?tab=open")).toBe("deals-tab-open");
  });

  it("snapshotName joins the path slug and viewport name with a .png extension", () => {
    expect(snapshotName("/", vp("desktop"))).toBe("root-desktop.png");
    expect(snapshotName("/deals", vp("mobile"))).toBe("deals-mobile.png");
  });

  it("expandCases produces the full route × viewport matrix by default", () => {
    const routes: VisualRoute[] = [{ path: "/" }, { path: "/deals" }];
    const cases = expandCases(routes, DEFAULT_VIEWPORTS);
    // 2 routes × 3 viewports
    expect(cases).toHaveLength(6);
    expect(cases.map((c) => c.name)).toEqual([
      "root-mobile.png",
      "root-tablet.png",
      "root-desktop.png",
      "deals-mobile.png",
      "deals-tablet.png",
      "deals-desktop.png",
    ]);
  });

  it("expandCases honours a per-route viewport filter and drops unknown names", () => {
    const cases = expandCases([{ path: "/", viewports: ["desktop", "nope"] }], DEFAULT_VIEWPORTS);
    expect(cases.map((c) => c.viewport.name)).toEqual(["desktop"]);
  });

  it("expandCases merges default diff options with per-route overrides", () => {
    const [c] = expandCases([{ path: "/", diff: { maxDiffPixelRatio: 0.05 } }], [vp("desktop")]);
    expect(c.diff.maxDiffPixelRatio).toBe(0.05); // override wins
    expect(c.diff.animations).toBe(DEFAULT_DIFF_OPTIONS.animations); // default preserved
    expect(c.diff.fullPage).toBe(true);
  });

  it("expandCases carries masks through to each case", () => {
    const cases = expandCases([{ path: "/", mask: ["#clock"] }], [vp("a"), vp("b")]);
    expect(cases.every((c) => c.mask.includes("#clock"))).toBe(true);
  });

  it("duplicateNames flags routes that slug to the same snapshot", () => {
    // "/deals" and "/deals/" slug identically -> collision at a shared viewport
    const cases = expandCases([{ path: "/deals" }, { path: "/deals/" }], [vp("desktop")]);
    expect(duplicateNames(cases)).toEqual(["deals-desktop.png"]);
    // distinct routes never collide
    expect(duplicateNames(expandCases([{ path: "/a" }, { path: "/b" }], [vp("d")]))).toEqual([]);
  });
});
