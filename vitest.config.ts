import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["server/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@server": new URL("./server", import.meta.url).pathname,
    },
  },
});
