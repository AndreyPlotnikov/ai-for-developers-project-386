import { defineConfig } from 'orval';

export default defineConfig({
  backend: {
    input: './api/generated/openapi.yaml',
    output: {
      mode: 'split',
      client: 'hono',
      target: './src/generated/api.ts',
      tsconfig: './tsconfig.json',
      override: {
        hono: {
          handlers: './src/handlers',
          compositeRoute: './src/generated/app.ts',
          handlerGenerationStrategy: 'smart',
        },
      },
    },
  },
});
