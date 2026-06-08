/**
 * module-contract — deterministic completeness gate for code MODULES.
 *
 * The first *static* surface (the others are web/runtime: Playwright, axe,
 * Lighthouse). It answers one question mechanically: "is this module COMPLETE
 * against its declared contract?" — the gap that let an incomplete enex binance
 * adapter ship (2/5 tools, no transforms, raw JSON, an envelope bug). Forum plan
 * 7061b2c3, origin ENE-334.
 *
 * Deterministic only: no LLM, no network. File-existence + content checks — the
 * enex check-manifests.js pattern, applied to adapter MODULES not templates. The
 * judgment layer (scope-match, quality) is the Imperium adversarial-verify tier;
 * the live-truth layer is the nightly live-contract. This is the floor they build on.
 *
 * Pure: same input -> same output; no clock / env / network reads.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

export type Severity = "error" | "warn";

/** Completeness tier. `tier2` (full bar) adds the card-layer requirement. */
export type ContractTier = "floor" | "tier2";

export interface Finding {
  check: string;
  severity: Severity;
  message: string;
}

export interface ContractResult {
  module: string;
  tier: ContractTier;
  pass: boolean;
  findings: Finding[];
}

/** Markers that betray deferred / incomplete work shipped as "done". */
const CODE_STUB_MARKERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bTODO\b/, "TODO"],
  [/\bFIXME\b/, "FIXME"],
  [/\bXXX\b/, "XXX"],
  [/\bSTUB\b/i, "STUB"],
  [/\bplaceholder\b/i, "placeholder"],
  [/\bnot[ -]?implemented\b/i, "not-implemented"],
  [/\bcoming soon\b/i, "coming-soon"],
];

const MIN_DOC_CHARS = 200;

interface ToolDecl {
  id: string;
  file: string;
}

function read(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function listFiles(dir: string): string[] {
  try {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...listFiles(p));
      else out.push(p);
    }
    return out;
  } catch {
    return [];
  }
}

function parseTools(manifest: Record<string, unknown>): ToolDecl[] {
  const raw = manifest.tools;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t): ToolDecl => {
      if (typeof t === "string") return { id: t, file: `tools/${t}.ts` };
      const o = t as Record<string, unknown>;
      const id = String(o.id ?? "");
      return { id, file: String(o.file ?? `tools/${id}.ts`) };
    })
    .filter((t) => t.id.length > 0);
}

/** MCP/composio modules get their tools from an external server — different contract. */
function isMcpModule(m: Record<string, unknown>): boolean {
  return m.source === "mcp" || m.source === "composio" || (m.mcp_config != null && Array.isArray(m.mcp_tools));
}

function checkManifest(dir: string): { findings: Finding[]; manifest: Record<string, unknown> | null } {
  const p = join(dir, "module.json");
  if (!existsSync(p)) {
    return { findings: [{ check: "manifest", severity: "error", message: "module.json missing" }], manifest: null };
  }
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(read(p)) as Record<string, unknown>;
  } catch (e) {
    return {
      findings: [{ check: "manifest", severity: "error", message: `module.json invalid JSON: ${(e as Error).message}` }],
      manifest: null,
    };
  }
  const f: Finding[] = [];
  for (const k of ["name", "version", "description"]) {
    if (!m[k]) f.push({ check: "manifest", severity: "error", message: `module.json missing "${k}"` });
  }
  if (typeof m.version === "string" && !/^\d+\.\d+\.\d+$/.test(m.version)) {
    f.push({ check: "manifest", severity: "error", message: `version not semver: ${String(m.version)}` });
  }
  const hasSurface =
    (Array.isArray(m.tools) && m.tools.length > 0) ||
    (Array.isArray(m.skills) && m.skills.length > 0) ||
    (Array.isArray(m.mcp_tools) && (m.mcp_tools as unknown[]).length > 0);
  if (!hasSurface) {
    f.push({ check: "manifest", severity: "error", message: "module declares no tools, skills, or mcp_tools" });
  }
  return { findings: f, manifest: m };
}

function checkToolImpls(dir: string, m: Record<string, unknown>): Finding[] {
  const f: Finding[] = [];
  if (isMcpModule(m)) {
    const mcp = Array.isArray(m.mcp_tools) ? (m.mcp_tools as unknown[]) : [];
    if (mcp.length === 0) {
      f.push({ check: "tool-impl", severity: "error", message: "MCP module has empty mcp_tools — seeded stub; regenerate against the live server" });
    }
    if (!m.mcp_schema_generated_at) {
      f.push({ check: "tool-impl", severity: "error", message: "MCP module missing mcp_schema_generated_at — tools unverified against the live server" });
    }
    return f;
  }
  for (const t of parseTools(m)) {
    const p = join(dir, t.file);
    if (!existsSync(p)) {
      f.push({ check: "tool-impl", severity: "error", message: `tool "${t.id}": implementation file ${t.file} missing` });
      continue;
    }
    if (!/export\s+default\s+tool\s*\(/.test(read(p))) {
      f.push({ check: "tool-impl", severity: "error", message: `tool "${t.id}": ${t.file} has no \`export default tool(\` export` });
    }
  }
  return f;
}

/** Tier 2: tools must render cards (a transforms/ layer), not return raw output. */
function checkCards(dir: string, m: Record<string, unknown>): Finding[] {
  const f: Finding[] = [];
  if (isMcpModule(m)) return f; // MCP cards infer from response shape (mcp_card_inference)
  const tools = parseTools(m);
  if (tools.length === 0) return f;
  const transformsDir = join(dir, "transforms");
  const transformNames = existsSync(transformsDir) ? listFiles(transformsDir).map((p) => basename(p)) : [];
  if (transformNames.length === 0) {
    f.push({ check: "card-completeness", severity: "error", message: "no transforms/ — tools return raw output instead of rendering cards (Tier 2 requires a card layer)" });
    return f;
  }
  const ui = m.ui as Record<string, unknown> | undefined;
  const cards = ui && Array.isArray(ui.cards) ? (ui.cards as Array<Record<string, unknown>>) : [];
  for (const t of tools) {
    const mapped =
      transformNames.includes(`${t.id}.ts`) ||
      cards.some((c) => Array.isArray(c.triggers) && (c.triggers as string[]).includes(t.id));
    // Per-tool mapping is a WARN, not error: transform file names vary by domain,
    // so deterministic name-matching would false-positive. The hard error above
    // catches the real failure (no card layer at all); Imperium-verify judges the rest.
    if (!mapped) {
      f.push({ check: "card-completeness", severity: "warn", message: `tool "${t.id}": no obviously-mapped transform/card (add transforms/${t.id}.ts or a ui.cards trigger)` });
    }
  }
  return f;
}

function checkTests(dir: string, m: Record<string, unknown>): Finding[] {
  const f: Finding[] = [];
  const specPath = join(dir, "module.spec.ts");
  if (!existsSync(specPath)) {
    f.push({ check: "test", severity: "error", message: "module.spec.ts missing" });
    return f;
  }
  if (isMcpModule(m)) return f;
  const spec = read(specPath);
  for (const t of parseTools(m)) {
    if (!spec.includes(t.id)) {
      f.push({ check: "test", severity: "error", message: `tool "${t.id}" not referenced in module.spec.ts — no test coverage` });
    }
  }
  if (!/error/i.test(spec)) {
    f.push({ check: "test", severity: "warn", message: "module.spec.ts has no error-case coverage" });
  }
  return f;
}

function checkNoStub(dir: string): Finding[] {
  const f: Finding[] = [];
  for (const p of listFiles(dir)) {
    const isCode = p.endsWith(".ts") && !p.endsWith(".spec.ts") && !p.includes("__tests__");
    const isDoc = p.endsWith(".md");
    if (!isCode && !isDoc) continue;
    const src = read(p);
    for (const [rx, name] of CODE_STUB_MARKERS) {
      if (rx.test(src)) {
        f.push({ check: "no-stub", severity: isCode ? "error" : "warn", message: `${basename(p)}: contains "${name}" marker (incomplete work shipped as done)` });
      }
    }
    if (isDoc && /\bfollow[ -]?up\b/i.test(src)) {
      f.push({ check: "no-stub", severity: "warn", message: `${basename(p)}: mentions "follow-up" — confirm the declared scope is fully shipped, not deferred` });
    }
  }
  return f;
}

function checkDocs(dir: string, tier: ContractTier): Finding[] {
  const f: Finding[] = [];
  const readme = join(dir, "README.md");
  if (!existsSync(readme)) f.push({ check: "docs", severity: "error", message: "README.md missing" });
  else if (read(readme).trim().length < MIN_DOC_CHARS) f.push({ check: "docs", severity: "warn", message: `README.md is thin (< ${MIN_DOC_CHARS} chars)` });

  const claude = join(dir, "CLAUDE.md");
  if (!existsSync(claude)) {
    f.push({ check: "docs", severity: tier === "tier2" ? "error" : "warn", message: "CLAUDE.md missing (agent context per dir)" });
  } else if (read(claude).trim().length < MIN_DOC_CHARS) {
    f.push({ check: "docs", severity: "warn", message: `CLAUDE.md is thin (< ${MIN_DOC_CHARS} chars)` });
  }
  return f;
}

function checkConnection(dir: string, m: Record<string, unknown>): Finding[] {
  const conn = m.connection as Record<string, unknown> | undefined;
  if (!conn || conn.type !== "api_key") return [];
  const code = listFiles(dir)
    .filter((p) => p.endsWith(".ts") && !p.endsWith(".spec.ts"))
    .map(read)
    .join("\n");
  if (!/process\.env\.[A-Z0-9_]+/.test(code)) {
    return [{ check: "connection", severity: "error", message: "connection.type=api_key but no process.env.* read in module code — key declared, never used" }];
  }
  return [];
}

/**
 * Run the full module-contract against a module directory.
 *
 * A module PASSES when it has zero `error`-severity findings; `warn` findings are
 * advisory. `floor` tier drops the card-completeness requirement.
 */
export function runContract(dir: string, tier: ContractTier = "tier2"): ContractResult {
  const { findings: manifestFindings, manifest } = checkManifest(dir);
  const findings: Finding[] = [...manifestFindings];
  if (manifest) {
    findings.push(...checkToolImpls(dir, manifest));
    findings.push(...checkTests(dir, manifest));
    findings.push(...checkNoStub(dir));
    findings.push(...checkDocs(dir, tier));
    findings.push(...checkConnection(dir, manifest));
    if (tier === "tier2") findings.push(...checkCards(dir, manifest));
  }
  const pass = !findings.some((x) => x.severity === "error");
  return { module: basename(dir), tier, pass, findings };
}

/** Render a result as human-readable lines (for the CLI / CI logs). */
export function formatResult(r: ContractResult): string {
  const head = `${r.pass ? "PASS" : "FAIL"}  ${r.module}  (tier=${r.tier})`;
  const lines = r.findings.map((f) => `  [${f.severity}] ${f.check}: ${f.message}`);
  return [head, ...lines].join("\n");
}
