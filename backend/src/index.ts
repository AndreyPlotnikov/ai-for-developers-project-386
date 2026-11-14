import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "127.0.0.1";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const database = new DatabaseSync(process.env.DATABASE_PATH ?? "call-calendar.sqlite", {
  timeout: 5000,
});
const app = createApp(database);
const frontendDist = process.env.FRONTEND_DIST;
if (frontendDist) {
  const pages = [
    "/",
    "/book",
    "/book/:id",
    "/admin/meeting-types",
    "/admin/meeting-types/new",
    "/admin/meetings",
  ];
  app.on(["GET", "HEAD"], "/assets/*", serveStatic({ root: frontendDist }));
  app.on(["GET", "HEAD"], pages, serveStatic({ root: frontendDist, path: "index.html" }));
}

const server = serve(
  {
    fetch: app.fetch,
    port,
    hostname,
  },
  (info) => {
    console.log(`Server is running on http://${hostname}:${info.port}`);
  },
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close((error) => {
      database.close();
      if (error) {
        console.error(error);
        process.exitCode = 1;
      }
    });
  });
}
