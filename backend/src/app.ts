import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { DatabaseSync } from "node:sqlite";
import routes from "./generated/app.js";
import { MeetingTypes, type MeetingTypeEnv } from "./meeting-types.js";

export function createApp(database: DatabaseSync) {
  const meetingTypes = new MeetingTypes(database);
  return new Hono<MeetingTypeEnv>()
    .use("/api/meeting-types/*", async (c, next) => {
      c.set("meetingTypes", meetingTypes);
      await next();
    })
    .route("/", routes)
    .onError((error, c) => {
      if (error instanceof HTTPException) {
        if (
          error.status === 400 &&
          c.req.method === "POST" &&
          c.req.path === "/api/meeting-types"
        ) {
          return c.json({ fieldErrors: {}, message: "Некорректное тело запроса" }, 400);
        }
        return error.getResponse();
      }
      console.error(error);
      return c.text("Internal Server Error", 500);
    });
}
