import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONSOLE_IGNORES,
  filterConsoleErrors,
  findMixedContent,
  missingMeta,
} from "./checks";

describe("hygiene checks", () => {
  it("filters known-noise console errors, keeps real ones", () => {
    const errors = [
      "Failed to load resource: the server responded ... /favicon.ico 404",
      "net::ERR_BLOCKED_BY_CLIENT",
      "Uncaught TypeError: x is not a function",
    ];
    expect(filterConsoleErrors(errors)).toEqual(["Uncaught TypeError: x is not a function"]);
  });

  it("flags http resources on an https page only", () => {
    expect(
      findMixedContent("https://x.com/", ["http://a.com/x.js", "https://b.com/y.css"]),
    ).toEqual(["http://a.com/x.js"]);
    expect(findMixedContent("http://x.com/", ["http://a.com/x.js"])).toEqual([]);
  });

  it("reports missing/empty required meta", () => {
    expect(
      missingMeta({ title: "T", description: "D", ogTitle: "O", ogDescription: "OD" }),
    ).toEqual([]);
    expect(missingMeta({ title: "", description: null })).toEqual([
      "title",
      "description",
      "ogTitle",
      "ogDescription",
    ]);
  });

  it("exposes default console ignore patterns", () => {
    expect(DEFAULT_CONSOLE_IGNORES.length).toBeGreaterThan(0);
  });
});
