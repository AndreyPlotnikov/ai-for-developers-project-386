import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { createApp } from "../src/app.js";
import type { Meeting, MeetingType } from "../src/generated/api.schemas.js";

const upcomingPath = "/api/owner/meetings";
type App = ReturnType<typeof createApp>;

async function createBooking(
  app: App,
  name: string,
  durationMinutes: number,
  startsAt: string,
  guestName: string,
  guestEmail: string,
) {
  const meetingType = await app.request("/api/meeting-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, durationMinutes }),
  });
  expect(meetingType.status).toBe(201);
  const { id }: MeetingType = await meetingType.json();
  const booking = await app.request(`/api/meeting-types/${id}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
    body: JSON.stringify({ startsAt, guestName, guestEmail }),
  });
  expect(booking.status).toBe(201);
  const meeting: Meeting = await booking.json();
  return meeting.id;
}

test("lists all future bookings by start time, independently of the working hours and booking window", async () => {
  using database = new DatabaseSync(":memory:");
  let now = new Date("2026-02-01T23:30:00Z");
  const bookingApp = createApp(database, {
    environment: {
      OWNER_WORKING_HOURS:
        '{"monday":[{"start":"09:00","end":"17:00"}],"sunday":[{"start":"09:00","end":"17:00"}]}',
    },
    now: () => now,
  });
  const later = {
    id: await createBooking(
      bookingApp,
      "Разбор проекта",
      45,
      "2026-02-15T06:00:00Z",
      "Мария",
      "m@example.com",
    ),
    meetingTypeName: "Разбор проекта",
    startsAt: "2026-02-15T06:00:00Z",
    endsAt: "2026-02-15T06:45:00Z",
    guestName: "Мария",
    guestEmail: "m@example.com",
  };
  const earlier = {
    id: await createBooking(bookingApp, "Знакомство", 30, "2026-02-02T06:15:00Z", "Алекс", "a@b.c"),
    meetingTypeName: "Знакомство",
    startsAt: "2026-02-02T06:15:00Z",
    endsAt: "2026-02-02T06:45:00Z",
    guestName: "Алекс",
    guestEmail: "a@b.c",
  };
  const timeZone = "America/New_York";
  const ownerApp = createApp(database, {
    environment: { OWNER_TIME_ZONE: timeZone, OWNER_WORKING_HOURS: "{}" },
    now: () => now,
  });
  const all = await ownerApp.request(upcomingPath);
  expect(all.status).toBe(200);
  expect(all.headers.get("Cache-Control")).toBe("no-store");
  expect(await all.json()).toEqual({ timeZone, meetings: [earlier, later] });

  now = new Date("2026-02-02T06:14:59.999Z");
  expect(await (await ownerApp.request(upcomingPath)).json()).toEqual({
    timeZone,
    meetings: [earlier, later],
  });
  now = new Date("2026-02-02T06:15:00Z");
  expect(await (await ownerApp.request(upcomingPath)).json()).toEqual({
    timeZone,
    meetings: [later],
  });
  now = new Date("2026-02-15T06:00:00Z");
  expect(await (await ownerApp.request(upcomingPath)).json()).toEqual({ timeZone, meetings: [] });
});
