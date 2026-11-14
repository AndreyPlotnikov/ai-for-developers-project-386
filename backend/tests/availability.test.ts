import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { createApp } from "../src/app.js";

async function createType(app: ReturnType<typeof createApp>, durationMinutes: number) {
  const response = await app.request("/api/meeting-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Консультация", durationMinutes }),
  });
  expect(response.status).toBe(201);
  const meetingType = await response.json();
  return `/api/meeting-types/${meetingType.id}/availability`;
}

test("lists the next 14 owner dates and default future working slots", async () => {
  using database = new DatabaseSync(":memory:");
  const app = createApp(database, {
    environment: {},
    now: () => new Date("2026-02-02T06:00:00Z"),
  });
  const path = await createType(app, 17);

  const response = await app.request(path);
  expect(response.status).toBe(200);
  const availability = await response.json();
  expect(availability.timeZone).toBe("Europe/Moscow");
  expect(availability.days).toHaveLength(14);
  expect(availability.days[0].date).toBe("2026-02-02");
  expect(availability.days[13].date).toBe("2026-02-15");
  expect(availability.days[0].slots[0]).toEqual({
    startsAt: "2026-02-02T06:15:00Z",
    endsAt: "2026-02-02T06:32:00Z",
  });
  expect(availability.days[0].slots.at(-1)).toEqual({
    startsAt: "2026-02-02T14:30:00Z",
    endsAt: "2026-02-02T14:47:00Z",
  });
  expect(availability.days[5]).toEqual({ date: "2026-02-07", slots: [] });
});

test("uses a midnight-based grid across touching intervals and moves the window at owner midnight", async () => {
  using database = new DatabaseSync(":memory:");
  let now = new Date("2026-02-02T20:59:59.999Z");
  const app = createApp(database, {
    now: () => now,
    environment: {
      OWNER_WORKING_HOURS: JSON.stringify({
        monday: [{ start: "23:00", end: "24:00" }],
        tuesday: [
          { start: "00:07", end: "00:30" },
          { start: "00:00", end: "00:07" },
          { start: "00:45", end: "01:00" },
        ],
      }),
      SLOT_STEP_MINUTES: "17",
    },
  });
  const path = await createType(app, 13);

  const beforeMidnight = await (await app.request(path)).json();
  expect(beforeMidnight.days[0]).toEqual({
    date: "2026-02-02",
    slots: [],
  });
  expect(beforeMidnight.days[1].slots).toEqual([
    { startsAt: "2026-02-02T21:00:00Z", endsAt: "2026-02-02T21:13:00Z" },
    { startsAt: "2026-02-02T21:17:00Z", endsAt: "2026-02-02T21:30:00Z" },
  ]);
  now = new Date("2026-02-02T21:00:00Z");
  const afterMidnight = await (await app.request(path)).json();
  expect(afterMidnight.days[0]).toEqual({
    date: "2026-02-03",
    slots: [{ startsAt: "2026-02-02T21:17:00Z", endsAt: "2026-02-02T21:30:00Z" }],
  });
  expect(afterMidnight.days[13]).toEqual({
    date: "2026-02-16",
    slots: [
      { startsAt: "2026-02-16T20:14:00Z", endsAt: "2026-02-16T20:27:00Z" },
      { startsAt: "2026-02-16T20:31:00Z", endsAt: "2026-02-16T20:44:00Z" },
      { startsAt: "2026-02-16T20:48:00Z", endsAt: "2026-02-16T21:01:00Z" },
    ],
  });
});

test.each([
  [{ OWNER_TIME_ZONE: "Mars/Olympus" }, "OWNER_TIME_ZONE"],
  [{ OWNER_TIME_ZONE: "+03:00" }, "OWNER_TIME_ZONE"],
  [{ SLOT_STEP_MINUTES: "1.5" }, "SLOT_STEP_MINUTES"],
  [{ SLOT_STEP_MINUTES: "0" }, "SLOT_STEP_MINUTES"],
  [{ SLOT_STEP_MINUTES: "1441" }, "SLOT_STEP_MINUTES"],
  [{ OWNER_WORKING_HOURS: "{" }, "OWNER_WORKING_HOURS"],
  [{ OWNER_WORKING_HOURS: '{"holiday":[]}' }, "OWNER_WORKING_HOURS"],
  [{ OWNER_WORKING_HOURS: '{"monday":[{"start":"24:00","end":"24:00"}]}' }, "OWNER_WORKING_HOURS"],
  [
    {
      OWNER_WORKING_HOURS:
        '{"monday":[{"start":"09:00","end":"10:00"},{"start":"09:30","end":"11:00"}]}',
    },
    "OWNER_WORKING_HOURS",
  ],
])("rejects invalid startup configuration %j", (environment, key) => {
  using database = new DatabaseSync(":memory:");
  expect(() => createApp(database, { environment })).toThrow(key);
});

test.each([
  {
    timeZone: "America/New_York",
    now: "2026-03-08T04:00:00Z",
    date: "2026-03-08",
    hours: { start: "01:00", end: "04:00" },
    durationMinutes: 40,
    slots: [
      { startsAt: "2026-03-08T06:00:00Z", endsAt: "2026-03-08T06:40:00Z" },
      { startsAt: "2026-03-08T07:00:00Z", endsAt: "2026-03-08T07:40:00Z" },
    ],
  },
  {
    timeZone: "America/New_York",
    now: "2026-11-01T03:00:00Z",
    date: "2026-11-01",
    hours: { start: "00:00", end: "03:00" },
    durationMinutes: 40,
    slots: [
      { startsAt: "2026-11-01T04:00:00Z", endsAt: "2026-11-01T04:40:00Z" },
      { startsAt: "2026-11-01T07:00:00Z", endsAt: "2026-11-01T07:40:00Z" },
    ],
  },
  {
    timeZone: "Australia/Lord_Howe",
    now: "2026-04-04T12:00:00Z",
    date: "2026-04-05",
    hours: { start: "01:00", end: "03:00" },
    durationMinutes: 30,
    slots: [
      { startsAt: "2026-04-04T14:00:00Z", endsAt: "2026-04-04T14:30:00Z" },
      { startsAt: "2026-04-04T15:30:00Z", endsAt: "2026-04-04T16:00:00Z" },
      { startsAt: "2026-04-04T16:00:00Z", endsAt: "2026-04-04T16:30:00Z" },
    ],
  },
])(
  "excludes clock-change gaps and repeated times in $timeZone on $date",
  async ({ timeZone, now, date, hours, durationMinutes, slots }) => {
    using database = new DatabaseSync(":memory:");
    const app = createApp(database, {
      now: () => new Date(now),
      environment: {
        OWNER_TIME_ZONE: timeZone,
        OWNER_WORKING_HOURS: JSON.stringify({ sunday: [hours] }),
        SLOT_STEP_MINUTES: "30",
      },
    });
    const path = await createType(app, durationMinutes);
    const response = await app.request(path);
    expect(response.status).toBe(200);
    const availability = await response.json();
    expect(availability.timeZone).toBe(timeZone);
    expect(availability.days).toContainEqual({ date, slots });
  },
);

test("availability for an unknown meeting type returns a structured 404", async () => {
  using database = new DatabaseSync(":memory:");
  const app = createApp(database);
  const response = await app.request("/api/meeting-types/unknown/availability");
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ message: "Тип встречи не найден" });
});
