import { describe, expect, it } from "vitest";
import { isOkStatus, missingMarkers, resolveUrl } from "./checks";

describe("web-smoke checks", () => {
  it("accepts 2xx/3xx, rejects 4xx/5xx and undefined", () => {
    expect(isOkStatus(200)).toBe(true);
    expect(isOkStatus(301)).toBe(true);
    expect(isOkStatus(399)).toBe(true);
    expect(isOkStatus(404)).toBe(false);
    expect(isOkStatus(500)).toBe(false);
    expect(isOkStatus(undefined)).toBe(false);
  });

  it("resolveUrl avoids double slashes either way", () => {
    expect(resolveUrl("https://x.com/", "/deals")).toBe("https://x.com/deals");
    expect(resolveUrl("https://x.com", "deals")).toBe("https://x.com/deals");
    expect(resolveUrl("https://x.com//", "/a/b")).toBe("https://x.com/a/b");
  });

  it("missingMarkers returns only absent substrings", () => {
    expect(missingMarkers("<h1>Aexodus</h1>", ["Aexodus"])).toEqual([]);
    expect(missingMarkers("<h1>Aexodus</h1>", ["Aexodus", "Deals"])).toEqual(["Deals"]);
    expect(missingMarkers("anything", undefined)).toEqual([]);
  });
});
