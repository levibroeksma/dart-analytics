import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  branch: (branch) => ({
    protected: branch.name === "main",
    ...(branch.name === "main" ? {} : { parent: "main" }),
    postgres: {
      computeSettings: {
        autoscalingLimitMinCu: 0.25,
        suspendTimeout: "5m",
      },
    },
  }),
});
