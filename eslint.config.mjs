// filename: eslint.config.mjs
import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";
export default defineConfig([
  ...next,
  ...ts,
  // Native anchors intentionally keep public navigation independent of client JS.
  { rules: { "@next/next/no-html-link-for-pages": "off" } },
  // These images use the bounded app-owned Sharp endpoint. Next's public image
  // cache must never retain draft/private images after access is revoked.
  {
    files: [
      "components/content.tsx",
      "app/preview/**/*.tsx",
      "admin/editor.tsx",
      "admin/management.tsx",
      "components/shell.tsx",
    ],
    rules: { "@next/next/no-img-element": "off" },
  },
  globalIgnores([
    ".next/**",
    ".next-analyze/**",
    "reports/**",
    "test-results/**",
    ".test-runtime/**",
    "lib/onyx/generated.ts",
  ]),
]);
