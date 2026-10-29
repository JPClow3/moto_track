import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import ts from "typescript-eslint";

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs["flat/recommended"],
  ...svelte.configs["flat/prettier"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
      },
    },
  },
  {
    // Manual database verifiers intentionally use Node's CommonJS loader.
    files: ["tests/integration/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    ignores: [
      ".env.*",
      "native/**/bin/",
      "native/**/obj/",
      "native/**/build/",
      "native/packages/",
      "build/",
      ".svelte-kit/",
      // Agent worktrees are full checkouts with their own generated types.
      ".claude/",
      ".wrangler/",
      "coverage/",
      "dist/",
      "playwright-report/",
      "test-results/",
    ],
  },
  {
    rules: {
      "svelte/require-each-key": "off",
      "svelte/no-navigation-without-resolve": "off",
    },
  },
);
