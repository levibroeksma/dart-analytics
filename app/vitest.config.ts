import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@auth": path.resolve(__dirname, "./src/lib/auth"),
      "@client": path.resolve(__dirname, "./src/lib/client"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@stores": path.resolve(__dirname, "./src/stores"),
      "@forms": path.resolve(__dirname, "./src/forms"),
      "@modules": path.resolve(__dirname, "./src/modules"),
      "@utils": path.resolve(__dirname, "./src/lib/utils"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@repositories": path.resolve(__dirname, "./src/repositories"),
      "@db": path.resolve(__dirname, "./src/db"),
      "@routes": path.resolve(__dirname, "./src/pages/api"),
      "@server": path.resolve(__dirname, "./src/lib/server"),
    },
  },
});
