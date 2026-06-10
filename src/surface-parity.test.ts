/**
 * Surface parity + consumer registry — repo-wide structural gates (VLCN-631;
 * build-fidelity doctrine Forum 0db70efc).
 *
 * 1. Surface convention parity: every dir under src/surfaces/<name>/ ships
 *    checks.ts + index.ts + checks.test.ts AND is exported as
 *    "./surfaces/<name>" in package.json — both directions, no grandfathering.
 * 2. Registry parity (doctrine P2.7 — a surface with no registered consumer is
 *    mis-homed): surfaces.registry.json carries exactly one row per surface and
 *    every row parses. Registry COVERAGE + SHAPE block; consumer RESOLUTION is
 *    warn-tier by design — unconsumed surfaces are printed via console.warn,
 *    never failed on, so adoption gaps stay honest without blocking this repo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SRC_DIR, "..");
const SURFACES_DIR = path.join(SRC_DIR, "surfaces");

const REQUIRED_FILES = ["checks.ts", "index.ts", "checks.test.ts"] as const;

const surfaceDirs = fs
  .readdirSync(SURFACES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as {
  exports?: Record<string, string>;
};
const exportEntries = pkg.exports ?? {};

describe("surface convention parity", () => {
  it("discovers the surface dirs (a glob bug must not pass vacuously)", () => {
    expect(surfaceDirs.length).toBeGreaterThanOrEqual(7);
  });

  for (const surface of surfaceDirs) {
    describe(`surfaces/${surface}`, () => {
      for (const file of REQUIRED_FILES) {
        it(`ships ${file}`, () => {
          expect(
            fs.existsSync(path.join(SURFACES_DIR, surface, file)),
            `src/surfaces/${surface}/${file} is required by the surface convention (CLAUDE.md "Naming")`,
          ).toBe(true);
        });
      }

      it(`is exported as "./surfaces/${surface}" in package.json`, () => {
        expect(
          exportEntries[`./surfaces/${surface}`],
          `package.json exports must map "./surfaces/${surface}" to the surface's index.ts`,
        ).toBe(`./src/surfaces/${surface}/index.ts`);
      });
    });
  }

  it("has no package.json surface export without a backing surface dir", () => {
    const exported = Object.keys(exportEntries)
      .filter((key) => key.startsWith("./surfaces/"))
      .map((key) => key.slice("./surfaces/".length))
      .sort();
    expect(exported).toEqual(surfaceDirs);
  });
});

interface RegistryRow {
  surface?: unknown;
  consumer_repo?: unknown;
  consumer_workflow?: unknown;
  status?: unknown;
  notes?: unknown;
}

const registry = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "surfaces.registry.json"), "utf8"),
) as { surfaces?: unknown };
const rows: RegistryRow[] = Array.isArray(registry.surfaces)
  ? (registry.surfaces as RegistryRow[])
  : [];

describe("surfaces.registry.json (doctrine P2.7 consumer registry)", () => {
  it("covers every surface dir exactly once, and nothing else", () => {
    const named = rows.map((row) => String(row.surface)).sort();
    expect(named).toEqual(surfaceDirs);
  });

  it("every row parses: status enum + verified-consumer fields when active", () => {
    for (const row of rows) {
      expect(typeof row.surface, "surface must be a string").toBe("string");
      expect(
        ["active", "unconsumed"],
        `row "${String(row.surface)}": status must be "active" (verified consumer) or "unconsumed" (honest empty state)`,
      ).toContain(row.status);
      if (row.status === "active") {
        expect(
          row.consumer_repo,
          `row "${String(row.surface)}": active requires consumer_repo "owner/repo"`,
        ).toMatch(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
        expect(
          typeof row.consumer_workflow === "string" && row.consumer_workflow.length > 0,
          `row "${String(row.surface)}": active requires a non-empty consumer_workflow`,
        ).toBe(true);
      }
    }
  });

  it("unconsumed rows are honest (null consumers) and warn-tier, never blocking", () => {
    const unconsumed = rows.filter((row) => row.status === "unconsumed");
    for (const row of unconsumed) {
      expect(
        row.consumer_repo,
        `row "${String(row.surface)}": unconsumed must not name a consumer_repo`,
      ).toBeNull();
      expect(
        row.consumer_workflow,
        `row "${String(row.surface)}": unconsumed must not name a consumer_workflow`,
      ).toBeNull();
    }
    if (unconsumed.length > 0) {
      console.warn(
        `[quality] ${unconsumed.length}/${rows.length} surface(s) have no verified consumer ` +
          `(doctrine P2.7 — a surface nobody consumes is mis-homed): ` +
          `${unconsumed.map((row) => String(row.surface)).join(", ")}. ` +
          `Register the consuming repo+workflow in surfaces.registry.json when adoption lands.`,
      );
    }
  });
});
