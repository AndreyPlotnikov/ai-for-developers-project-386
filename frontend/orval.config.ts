import { defineConfig } from "orval";

export default defineConfig({
  client: {
    input: "../backend/api/generated/openapi.yaml",
    output: {
      target: "./src/generated/api.ts",
      client: "fetch",
    },
  },
});
