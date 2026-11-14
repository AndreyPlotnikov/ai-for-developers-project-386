import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtempDisposableSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Worker } from "node:worker_threads";
import { expect, test } from "vitest";
import { createApp } from "../src/app.js";
import type { MeetingType, MeetingTypeAvailability } from "../src/generated/api.schemas.js";

const options = { environment: {}, now: () => new Date("2026-02-02T06:00:00Z") };
const input = {
  startsAt: "2026-02-02T06:15:00Z",
  guestName: "  Алекс  ",
  guestEmail: "a@b.c",
};
type App = ReturnType<typeof createApp>;

async function createType(app: App, durationMinutes = 30) {
  const response = await app.request("/api/meeting-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Консультация", durationMinutes }),
  });
  expect(response.status).toBe(201);
  const type: MeetingType = await response.json();
  return type.id;
}

function book(
  app: App,
  id: string,
  values: Record<string, unknown> = input,
  key: string = randomUUID(),
) {
  return app.request(bookingPath(id), bookingRequest(values, key));
}

function bookingPath(id: string) {
  return `/api/meeting-types/${id}/bookings`;
}

function bookingRequest(values: Record<string, unknown>, key: string) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(values),
  };
}

test("saves a booking and returns the original confirmation details", async () => {
  using database = new DatabaseSync(":memory:");
  const app = createApp(database, options);
  const id = await createType(app);

  const created = await book(app, id);
  expect(created.status).toBe(201);
  expect(await created.json()).toEqual({
    id: expect.any(String),
    meetingTypeId: id,
    meetingTypeName: "Консультация",
    ownerName: "Андрей Плотников",
    startsAt: "2026-02-02T06:15:00Z",
    endsAt: "2026-02-02T06:45:00Z",
    timeZone: "Europe/Moscow",
    guestName: "Алекс",
    guestEmail: "a@b.c",
  });
});

test.each([
  [{ guestName: " \t " }, "guestName"],
  [{ guestName: "я".repeat(101) }, "guestName"],
  [{ guestName: undefined }, "guestName"],
  [{ guestEmail: "a@@b.c" }, "guestEmail"],
  [{ guestEmail: "a@.com" }, "guestEmail"],
  [{ guestEmail: "a@b..com" }, "guestEmail"],
  [{ guestEmail: "a@b.c." }, "guestEmail"],
  [{ guestEmail: "guest@localhost" }, "guestEmail"],
  [{ guestEmail: "@b.c" }, "guestEmail"],
  [{ guestEmail: "a@b .c" }, "guestEmail"],
  [{ guestEmail: " a@b.c" }, "guestEmail"],
  [{ guestEmail: "a@b.c " }, "guestEmail"],
  [{ guestEmail: "a\tb@b.c" }, "guestEmail"],
  [{ guestEmail: `${"a".repeat(251)}@b.c` }, "guestEmail"],
  [{ guestEmail: undefined }, "guestEmail"],
  [{ startsAt: "malformed" }, "startsAt"],
])("rejects invalid booking input %j before reserving the slot", async (values, field) => {
  using database = new DatabaseSync(":memory:");
  const app = createApp(database, options);
  const id = await createType(app);
  const rejected = await book(app, id, { ...input, ...values });
  expect(rejected.status).toBe(400);
  expect(await rejected.json()).toEqual({ fieldErrors: { [field]: expect.any(String) } });
  expect((await book(app, id)).status).toBe(201);
});

test("accepts an email and a trimmed name at their length limits", async () => {
  using database = new DatabaseSync(":memory:");
  const app = createApp(database, options);
  const id = await createType(app);
  const guestName = "я".repeat(100);
  const guestEmail = `${"a".repeat(250)}@b.c`;
  const saved = await book(app, id, {
    ...input,
    guestName: ` ${guestName} `,
    guestEmail,
  });
  expect(saved.status).toBe(201);
  expect(await saved.json()).toMatchObject({ guestName, guestEmail });
});

test.each([
  "2026-02-02T06:00:00Z",
  "2026-02-02T06:16:00Z",
  "2026-02-02T06:15:00.001Z",
  "2026-02-02T14:45:00Z",
  "2026-02-07T06:15:00Z",
  "2026-02-16T06:15:00Z",
])("checks the current time, schedule, grid and window again for %s", async (startsAt) => {
  using database = new DatabaseSync(":memory:");
  const app = createApp(database, options);
  const id = await createType(app);
  const conflict = await book(app, id, { ...input, startsAt });
  expect(conflict.status).toBe(409);
  expect(await conflict.json()).toMatchObject({ code: "slot_unavailable" });
});

test.each(["2026-11-01T05:00:00Z", "2026-11-01T06:00:00Z"])(
  "rejects booking a repeated local time %s",
  async (startsAt) => {
    using database = new DatabaseSync(":memory:");
    const app = createApp(database, {
      environment: {
        OWNER_TIME_ZONE: "America/New_York",
        OWNER_WORKING_HOURS: '{"sunday":[{"start":"00:00","end":"03:00"}]}',
      },
      now: () => new Date("2026-11-01T03:00:00Z"),
    });
    const id = await createType(app);
    expect((await book(app, id, { ...input, startsAt })).status).toBe(409);
  },
);

async function firstDayStarts(app: App, id: string) {
  const result = await app.request(`/api/meeting-types/${id}/availability`);
  expect(result.status).toBe(200);
  const availability: MeetingTypeAvailability = await result.json();
  return availability.days[0].slots.map((slot) => slot.startsAt);
}

test("removes entirely and partially overlapping slots for all types and keeps touching slots free", async () => {
  using database = new DatabaseSync(":memory:");
  const app = createApp(database, options);
  const long = await createType(app, 45);
  const short = await createType(app, 15);
  const startsAt = "2026-02-02T06:30:00Z";
  expect(await firstDayStarts(app, short)).toContain(startsAt);
  expect(await firstDayStarts(app, long)).toContain(startsAt);
  expect((await book(app, short, { ...input, startsAt })).status).toBe(201);

  expect((await firstDayStarts(app, long)).slice(0, 2)).toEqual([
    "2026-02-02T06:45:00Z",
    "2026-02-02T07:00:00Z",
  ]);
  expect((await firstDayStarts(app, short)).slice(0, 2)).toEqual([
    "2026-02-02T06:15:00Z",
    "2026-02-02T06:45:00Z",
  ]);
  expect((await book(app, long)).status).toBe(409);
  expect((await book(app, long, { ...input, startsAt: "2026-02-02T06:45:00Z" })).status).toBe(201);
});

test("confirms exactly one of two concurrent intersecting bookings of different types", async () => {
  using directory = mkdtempDisposableSync(join(tmpdir(), "booking-race-"));
  const path = join(directory.path, "calendar.sqlite");
  using database = new DatabaseSync(path);
  const app = createApp(database, options);
  const long = await createType(app, 45);
  const short = await createType(app, 15);
  const start = bookingSignal();
  const workers = [
    bookingWorker(path, long, input, { start: start.buffer }),
    bookingWorker(
      path,
      short,
      { ...input, startsAt: "2026-02-02T06:30:00Z" },
      { start: start.buffer },
    ),
  ];
  try {
    expect(await Promise.all(workers.map((worker) => once(worker, "message")))).toEqual([
      ["ready"],
      ["ready"],
    ]);
    const bookings = Promise.all(workers.map((worker) => once(worker, "message")));
    signalBookingWorkers(start);
    expect((await bookings).flat().sort()).toEqual([201, 409]);
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
});

test("reports an unknown outcome while SQLite is busy and rejects an overlap on retry", async () => {
  using directory = mkdtempDisposableSync(join(tmpdir(), "booking-contention-"));
  const path = join(directory.path, "calendar.sqlite");
  using database = new DatabaseSync(path, { timeout: 0 });
  const app = createApp(database, options);
  const long = await createType(app, 45);
  const short = await createType(app, 15);
  const releaseLock = bookingSignal();
  const worker = bookingWorker(path, long, input, { releaseLock: releaseLock.buffer });
  const shortInput = { ...input, startsAt: "2026-02-02T06:30:00Z" };
  const key = randomUUID();
  try {
    expect(await once(worker, "message")).toEqual(["validating"]);
    const busy = await book(app, short, shortInput, key);
    expect(busy.status).toBe(503);
    expect(await busy.json()).toMatchObject({ code: "unknown" });

    const saved = once(worker, "message");
    signalBookingWorkers(releaseLock);
    expect(await saved).toEqual([201]);

    const rejected = await book(app, short, shortInput, key);
    expect(rejected.status).toBe(409);
    expect(await rejected.json()).toMatchObject({ code: "slot_unavailable" });
  } finally {
    await worker.terminate();
  }
});

function bookingWorker(
  path: string,
  id: string,
  values: Record<string, unknown>,
  signals: { start?: SharedArrayBuffer; releaseLock?: SharedArrayBuffer },
) {
  return new Worker(new URL("./booking-worker.ts", import.meta.url), {
    execArgv: ["--import", "tsx"],
    workerData: {
      path,
      url: bookingPath(id),
      options: bookingRequest(values, randomUUID()),
      ...signals,
    },
  });
}

function bookingSignal() {
  return new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
}

function signalBookingWorkers(signal: Int32Array<SharedArrayBuffer>) {
  Atomics.store(signal, 0, 1);
  Atomics.notify(signal, 0);
}

test("replays the original booking after restart and a schedule change", async () => {
  using directory = mkdtempDisposableSync(join(tmpdir(), "booking-replay-"));
  const path = join(directory.path, "calendar.sqlite");
  const key = randomUUID();
  let id: string;
  let confirmation: unknown;
  {
    using database = new DatabaseSync(path);
    const app = createApp(database, options);
    id = await createType(app);
    const saved = await book(app, id, input, key);
    expect(saved.status).toBe(201);
    confirmation = await saved.json();
  }
  using database = new DatabaseSync(path);
  const app = createApp(database, {
    ...options,
    environment: { OWNER_TIME_ZONE: "Europe/Podgorica", OWNER_WORKING_HOURS: "{}" },
  });
  const replay = await book(app, id, input, key.toUpperCase());
  expect(replay.status).toBe(201);
  expect(await replay.json()).toEqual(confirmation);
  expect((await book(app, id)).status).toBe(409);
  expect(await firstDayStarts(createApp(database, options), id)).not.toContain(input.startsAt);
});

test("reports a confirmed storage failure and accepts a new booking after storage recovers", async () => {
  using directory = mkdtempDisposableSync(join(tmpdir(), "booking-failure-"));
  const path = join(directory.path, "calendar.sqlite");
  using database = new DatabaseSync(path);
  const app = createApp(database, options);
  const id = await createType(app);

  {
    using readOnly = new DatabaseSync(path, { readOnly: true });
    const failed = await book(createApp(readOnly, options), id);
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({ code: "not_saved" });
  }

  expect((await book(app, id)).status).toBe(201);
});

function checkBookingAttempt(app: App, key: string) {
  return app.request(`/api/meeting-types/booking-attempts/${key}/check`, { method: "POST" });
}

test("checks a saved booking after restarting and returns the original confirmation", async () => {
  using directory = mkdtempDisposableSync(join(tmpdir(), "booking-check-"));
  const path = join(directory.path, "calendar.sqlite");
  const key = randomUUID();
  let confirmation: unknown;
  {
    using database = new DatabaseSync(path);
    const app = createApp(database, options);
    const saved = await book(app, await createType(app), input, key);
    expect(saved.status).toBe(201);
    confirmation = await saved.json();
  }
  using database = new DatabaseSync(path);
  const app = createApp(database, options);
  const otherType = await createType(app);
  const checked = await checkBookingAttempt(app, key.toUpperCase());
  expect(checked.status).toBe(200);
  expect(await checked.json()).toEqual({ status: "saved", meeting: confirmation });
  expect(await firstDayStarts(app, otherType)).not.toContain(input.startsAt);
  expect(await firstDayStarts(app, otherType)).toContain("2026-02-02T06:45:00Z");
});

test("closes an unsaved attempt before a delayed request can create a meeting", async () => {
  using directory = mkdtempDisposableSync(join(tmpdir(), "booking-absent-"));
  const path = join(directory.path, "calendar.sqlite");
  const key = randomUUID();
  let id: string;
  {
    using database = new DatabaseSync(path);
    const app = createApp(database, options);
    id = await createType(app);
    using readOnly = new DatabaseSync(path, { readOnly: true });
    const unknown = await checkBookingAttempt(createApp(readOnly, options), key);
    expect(unknown.status).toBe(503);
    expect(await unknown.json()).toMatchObject({ code: "unknown" });
    const checked = await checkBookingAttempt(app, key);
    expect(checked.status).toBe(200);
    expect(await checked.json()).toEqual({ status: "not_saved" });
  }
  using database = new DatabaseSync(path);
  const app = createApp(database, options);
  const delayed = await book(app, id, input, key);
  expect(delayed.status).toBe(409);
  expect(await delayed.json()).toMatchObject({ code: "not_saved" });
  expect(await firstDayStarts(app, id)).toContain(input.startsAt);
  expect(await (await checkBookingAttempt(app, key)).json()).toEqual({ status: "not_saved" });
  expect((await book(app, id)).status).toBe(201);
});
