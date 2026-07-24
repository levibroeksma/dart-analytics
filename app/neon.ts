import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  branch: (branch) => ({
    ...(branch.name === "main" ? {} : { parent: "main" }),
    postgres: {
      computeSettings: {
        autoscalingLimitMinCu: 0.25,
      },
    },
  }),
});
