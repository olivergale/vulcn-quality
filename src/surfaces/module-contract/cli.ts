#!/usr/bin/env node
/**
 * module-contract CLI — run the gate over module dirs in CI.
 *
 *   module-contract <module-dir...> [--tier floor|tier2] [--json]
 *
 * Exit 0 = all pass (no error-severity findings); 1 = a failure; 2 = bad usage.
 * Run under a TS-aware runtime (Bun/tsx). enex-modules CI wires it as a required
 * check: `bun run .../cli.ts modules/* --tier tier2`.
 */
import { formatResult, runContract, type ContractResult, type ContractTier } from "./checks";

function parse(argv: string[]): { dirs: string[]; tier: ContractTier; json: boolean } {
  const dirs: string[] = [];
  let tier: ContractTier = "tier2";
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tier") {
      const v = argv[i + 1];
      i++;
      tier = v === "floor" ? "floor" : "tier2";
    } else if (a === "--json") {
      json = true;
    } else if (a !== undefined) {
      dirs.push(a);
    }
  }
  return { dirs, tier, json };
}

function main(): void {
  const { dirs, tier, json } = parse(process.argv.slice(2));
  if (dirs.length === 0) {
    console.error("usage: module-contract <module-dir...> [--tier floor|tier2] [--json]");
    process.exit(2);
  }
  const results: ContractResult[] = dirs.map((d) => runContract(d, tier));
  if (json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const r of results) console.log(formatResult(r));
    console.log(`\n${results.length} module(s) checked, ${results.filter((r) => !r.pass).length} failing.`);
  }
  process.exit(results.some((r) => !r.pass) ? 1 : 0);
}

main();
