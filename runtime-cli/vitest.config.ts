import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@rien7/skill-action-runtime": path.resolve(__dirname, "../runtime/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
    },
  },
});
