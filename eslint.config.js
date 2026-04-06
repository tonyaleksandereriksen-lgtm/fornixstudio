import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/", "node_modules/", "tests/", "studio-one-extension/", "dashboard/"],
  },
  {
    rules: {
      // Allow unused vars prefixed with _
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Allow explicit any in MCP tool handlers (SDK types are loose)
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
