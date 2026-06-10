import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // .manifold-gate is the CI-time checkout of the private gate-action repo
  // (see .github/workflows/manifold-eval.yml) — not this package's code.
  { ignores: ["dist", "node_modules", "coverage", ".manifold-gate"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
