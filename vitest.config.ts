import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      // server-only throws in non-Next.js runtimes (Vitest/jsdom). Alias it to
      // a no-op so tests that mock the importing module can still run. The real
      // build-time enforcement comes from Next.js, not Vitest.
      "server-only": path.resolve(__dirname, "vitest-server-only-stub.ts"),
    },
  },
});
