import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { DatabaseSync } from "node:sqlite";
import { WorkingCalendar } from "./availability.js";
import routes from "./generated/app.js";
import { MeetingTypes, type MeetingTypeEnv } from "./meeting-types.js";

import { Meetings } from "./meetings.js";

type AppOptions = { environment?: NodeJS.ProcessEnv; now?: () => Date };

export type CalendarEnv = {
  Variables: MeetingTypeEnv["Variables"] & {
    availability: WorkingCalendar;
    now: () => Date;
    meetings: Meetings;
  };
};

export function createApp(database: DatabaseSync, options: AppOptions = {}) {
  const availability = new WorkingCalendar(options.environment ?? process.env);
  const now = options.now ?? (() => new Date());
  const meetingTypes = new MeetingTypes(database);
  const meetings = new Meetings(database, meetingTypes, availability, now);
  return new Hono<CalendarEnv>()
    .use("/api/meeting-types/*", async (c, next) => {
      c.set("meetingTypes", meetingTypes);
      c.set("availability", availability);
      c.set("now", now);
      c.set("meetings", meetings);
      await next();
    })
    .route("/", routes)
    .onError((error, c) => {
      if (error instanceof HTTPException) {
        if (
          error.status === 400 &&
          c.req.method === "POST" &&
          (c.req.path === "/api/meeting-types" ||
            /^\/api\/meeting-types\/[^/]+\/bookings$/.test(c.req.path))
        ) {
          return c.json({ fieldErrors: {}, message: "Некорректное тело запроса" }, 400);
        }
        return error.getResponse();
      }
      console.error(error);
      return c.text("Internal Server Error", 500);
    });
}
