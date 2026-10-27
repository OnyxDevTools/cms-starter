// filename: vitest.config.ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./tests/fixture/server-only.ts", import.meta.url),
      ),
    },
  },
  test: { include: ["tests/unit/**/*.test.ts"], testTimeout: 15000 },
});
