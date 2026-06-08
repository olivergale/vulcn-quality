/**
 * module-contract acceptance suite. The headline case is the binance miss
 * (Forum 7061b2c3): an incomplete module MUST fail the gate. Modules are built
 * as temp dirs so the test is self-contained and deterministic.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runContract } from "./checks";

const DOC = "x".repeat(250); // clears MIN_DOC_CHARS
const created: string[] = [];

function mod(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "modcontract-"));
  created.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

afterEach(() => {
  while (created.length > 0) {
    const d = created.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

const errorChecks = (dir: string, tier: "floor" | "tier2" = "tier2"): string[] =>
  runContract(dir, tier).findings.filter((f) => f.severity === "error").map((f) => f.check);

describe("module-contract", () => {
  it("passes a complete tier2 module", () => {
    const dir = mod({
      "module.json": JSON.stringify({
        name: "good",
        version: "0.1.0",
        description: "complete",
        tools: [{ id: "good-list", file: "tools/good-list.ts" }],
        ui: { cards: [{ id: "c", triggers: ["good-list"] }] },
      }),
      "tools/good-list.ts": "export default tool({ async execute() { return {}; } });",
      "transforms/good-list.ts": "export function toCard() { return {}; }",
      "module.spec.ts": "// covers good-list, includes an error case",
      "README.md": DOC,
      "CLAUDE.md": DOC,
    });
    const r = runContract(dir, "tier2");
    expect(r.pass).toBe(true);
    expect(r.findings.filter((f) => f.severity === "error")).toHaveLength(0);
  });

  it("FAILS the binance-miss shape (missing tool impl, no transforms layer)", () => {
    const dir = mod({
      "module.json": JSON.stringify({
        name: "binance",
        version: "0.1.0",
        description: "liq monitor",
        connection: { type: "api_key", provider: "binance" },
        tools: [
          { id: "binance-positions", file: "tools/binance-positions.ts" },
          { id: "binance-subaccounts", file: "tools/binance-subaccounts.ts" },
        ],
      }),
      // declares 2 tools, ships 1; raw output, no transforms/ layer
      "tools/binance-positions.ts": "export default tool({ async execute() { return JSON.stringify({}); } });",
      "typescript/index.ts": "const k = process.env.BINANCE_API_KEY;",
      "module.spec.ts": "// binance-positions binance-subaccounts error",
      "README.md": DOC + " follow-up: balance, funding, marks",
      "CLAUDE.md": DOC,
    });
    const r = runContract(dir, "tier2");
    expect(r.pass).toBe(false);
    const errs = errorChecks(dir);
    expect(errs).toContain("tool-impl"); // binance-subaccounts.ts missing
    expect(errs).toContain("card-completeness"); // no transforms/ — raw JSON
  });

  it("floor tier does not require transforms", () => {
    const dir = mod({
      "module.json": JSON.stringify({ name: "f", version: "0.1.0", description: "d", tools: [{ id: "f-a", file: "tools/f-a.ts" }] }),
      "tools/f-a.ts": "export default tool({});",
      "module.spec.ts": "// f-a error",
      "README.md": DOC,
      "CLAUDE.md": DOC,
    });
    expect(runContract(dir, "floor").pass).toBe(true);
    expect(errorChecks(dir, "tier2")).toContain("card-completeness");
  });

  it("catches a stub marker in code", () => {
    const dir = mod({
      "module.json": JSON.stringify({ name: "s", version: "0.1.0", description: "d", tools: [{ id: "s-a", file: "tools/s-a.ts" }] }),
      "tools/s-a.ts": "export default tool({}); // TODO finish this",
      "transforms/s-a.ts": "export function toCard() { return {}; }",
      "module.spec.ts": "// s-a error",
      "README.md": DOC,
      "CLAUDE.md": DOC,
    });
    expect(errorChecks(dir)).toContain("no-stub");
  });

  it("flags a seeded MCP stub (empty mcp_tools)", () => {
    const dir = mod({
      "module.json": JSON.stringify({ name: "m", version: "0.1.0", description: "d", source: "mcp", mcp_config: { url: "x" }, mcp_tools: [] }),
      "README.md": DOC,
      "CLAUDE.md": DOC,
      "module.spec.ts": "// error",
    });
    expect(errorChecks(dir)).toContain("tool-impl");
  });

  it("flags a keyed module that never reads its env var", () => {
    const dir = mod({
      "module.json": JSON.stringify({
        name: "k",
        version: "0.1.0",
        description: "d",
        connection: { type: "api_key", provider: "k" },
        tools: [{ id: "k-a", file: "tools/k-a.ts" }],
      }),
      "tools/k-a.ts": "export default tool({});",
      "transforms/k-a.ts": "export function toCard() { return {}; }",
      "module.spec.ts": "// k-a error",
      "README.md": DOC,
      "CLAUDE.md": DOC,
    });
    expect(errorChecks(dir)).toContain("connection");
  });
});
