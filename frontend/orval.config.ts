import { defineConfig } from "orval";

export default defineConfig({
  validation: {
    input: "../backend/api/generated/openapi.yaml",
    output: {
      target: "./src/generated/validation.ts",
      client: "zod",
      override: {
        zod: { generate: { response: false, param: false } },
      },
    },
  },
  client: {
    input: "../backend/api/generated/openapi.yaml",
    output: {
      target: "./src/generated/api.ts",
      client: "fetch",
    },
  },
});
