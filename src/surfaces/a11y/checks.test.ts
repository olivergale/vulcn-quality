import { describe, expect, it } from "vitest";
import {
  DEFAULT_MIN_IMPACT,
  filterViolations,
  formatViolations,
  impactRank,
  meetsImpact,
  type AxeViolation,
} from "./checks";

const v = (id: string, impact: AxeViolation["impact"], nodes = 1): AxeViolation => ({
  id,
  impact,
  help: `${id} help`,
  nodes: Array.from({ length: nodes }, () => ({ target: [`#${id}`], html: "<x/>" })),
});

describe("a11y checks", () => {
  it("impactRank orders severities and treats unknown impact as serious", () => {
    expect(impactRank("minor")).toBeLessThan(impactRank("critical"));
    expect(impactRank(null)).toBe(impactRank("serious"));
    expect(impactRank(undefined)).toBe(impactRank("serious"));
  });

  it("meetsImpact: default floor counts every real violation", () => {
    expect(DEFAULT_MIN_IMPACT).toBe("minor");
    expect(meetsImpact("minor")).toBe(true);
    expect(meetsImpact("critical", "serious")).toBe(true);
    expect(meetsImpact("minor", "serious")).toBe(false);
  });

  it("filterViolations honors the floor and the ignore list", () => {
    const violations = [
      v("color-contrast", "serious"),
      v("region", "moderate"),
      v("label", "minor"),
    ];
    // default floor (minor): all three breach
    expect(filterViolations(violations).map((x) => x.id)).toEqual([
      "color-contrast",
      "region",
      "label",
    ]);
    // raise the floor to serious: only color-contrast remains
    expect(filterViolations(violations, { minImpact: "serious" }).map((x) => x.id)).toEqual([
      "color-contrast",
    ]);
    // suppress a known-accepted rule
    expect(
      filterViolations(violations, { ignoreRules: ["color-contrast"] }).map((x) => x.id),
    ).toEqual(["region", "label"]);
  });

  it("filterViolations treats unknown impact as serious (counted at the default floor)", () => {
    const violations = [v("mystery", null)];
    expect(filterViolations(violations)).toHaveLength(1);
    expect(filterViolations(violations, { minImpact: "critical" })).toHaveLength(0);
  });

  it("formatViolations renders id, impact, node count, and first selector", () => {
    expect(formatViolations([])).toBe("");
    const line = formatViolations([v("image-alt", "critical", 2)]);
    expect(line).toContain("image-alt");
    expect(line).toContain("[critical]");
    expect(line).toContain("2 nodes");
    expect(line).toContain("#image-alt");
  });
});
