import { DatabaseSync } from "node:sqlite";
import { serve } from "@hono/node-server";
import { createApp } from "../src/app.js";

const app = createApp(new DatabaseSync(":memory:"));
serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 }, ({ port }) => {
  console.log(`E2E API: http://127.0.0.1:${port}`);
});
