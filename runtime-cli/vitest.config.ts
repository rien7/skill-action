import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@rien7/skill-action-runtime": "/Users/rien7/Developer/skill-action/runtime/src/index.ts",
    },
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
    },
  },
});

