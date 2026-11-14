import { mkdtempDisposableSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../src/app.js";

test("a new meeting type appears in the catalog and can be opened by ID", async () => {
  using database = new DatabaseSync(":memory:");
  const app = createApp(database);
  const created = await app.request("/api/meeting-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "  Консультация  ", durationMinutes: 30 }),
  });

  expect(created.status).toBe(201);
  const meetingType = await created.json();
  expect(meetingType).toMatchObject({ name: "Консультация", durationMinutes: 30 });

  const catalog = await app.request("/api/meeting-types");
  expect(catalog.status).toBe(200);
  expect(await catalog.json()).toEqual({ meetingTypes: [meetingType] });

  const detail = await app.request(`/api/meeting-types/${meetingType.id}`);
  expect(detail.status).toBe(200);
  expect(await detail.json()).toEqual(meetingType);
});

test.each([
  [{ name: " \t " }, "name"],
  [{ name: "я".repeat(101) }, "name"],
  [{ name: "😀".repeat(101) }, "name"],
  [{ name: 42 }, "name"],
  [{ description: "я".repeat(1001) }, "description"],
  [{ description: null }, "description"],
  [{ durationMinutes: 4 }, "durationMinutes"],
  [{ durationMinutes: 481 }, "durationMinutes"],
  [{ durationMinutes: 5.5 }, "durationMinutes"],
  [{ durationMinutes: "30" }, "durationMinutes"],
])("rejects %j with an error for %s and saves nothing", async (input, field) => {
  using database = new DatabaseSync(":memory:");
  const app = createApp(database);
  const created = await app.request("/api/meeting-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "A", durationMinutes: 30, ...input }),
  });

  expect(created.status).toBe(400);
  expect(await created.json()).toEqual({ fieldErrors: { [field]: expect.any(String) } });
  expect(await (await app.request("/api/meeting-types")).json()).toEqual({ meetingTypes: [] });
});

test("same-name types at the input limits keep distinct links after restart", async () => {
  using directory = mkdtempDisposableSync(join(tmpdir(), "call-calendar-"));
  const path = join(directory.path, "calendar.sqlite");

  async function createTypes() {
    using database = new DatabaseSync(path);
    const app = createApp(database);
    const name = "😀".repeat(100);
    const description = "<strong>Текст</strong>".padEnd(1000, ".");
    const types = [];
    for (const durationMinutes of [5, 480]) {
      const response = await app.request("/api/meeting-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `  ${name}\n`, description, durationMinutes }),
      });
      expect(response.status).toBe(201);
      const type = await response.json();
      expect(type).toMatchObject({ name, description, durationMinutes });
      types.push(type);
    }
    return types;
  }

  const types = await createTypes();
  expect(types[0].id).not.toBe(types[1].id);
  using database = new DatabaseSync(path);
  const app = createApp(database);
  expect(await (await app.request("/api/meeting-types")).json()).toEqual({ meetingTypes: types });
  for (const type of types) {
    expect(await (await app.request(`/api/meeting-types/${type.id}`)).json()).toEqual(type);
  }
});

test("returns a not-found response for an unknown meeting type", async () => {
  using database = new DatabaseSync(":memory:");
  const app = createApp(database);
  const response = await app.request("/api/meeting-types/unknown");

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ message: "Тип встречи не найден" });
});

test("can retry after a confirmed storage failure", async () => {
  using directory = mkdtempDisposableSync(join(tmpdir(), "call-calendar-"));
  const path = join(directory.path, "calendar.sqlite");
  using database = new DatabaseSync(path);
  createApp(database);
  const request = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "A", durationMinutes: 30 }),
  };

  {
    using readOnlyDatabase = new DatabaseSync(path, { readOnly: true });
    const readOnlyApp = createApp(readOnlyDatabase);
    const failed = await readOnlyApp.request("/api/meeting-types", request);
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({ code: "not_saved" });
    expect(await (await readOnlyApp.request("/api/meeting-types")).json()).toEqual({
      meetingTypes: [],
    });
  }

  const writableApp = createApp(database);
  expect((await writableApp.request("/api/meeting-types", request)).status).toBe(201);
});

test("returns a JSON validation error for a malformed request body", async () => {
  using database = new DatabaseSync(":memory:");
  const app = createApp(database);
  const response = await app.request("/api/meeting-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });

  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ fieldErrors: {}, message: expect.any(String) });
});

test("recovers the same created type through HTTP after the application restarts", async () => {
  using directory = mkdtempDisposableSync(join(tmpdir(), "call-calendar-"));
  const path = join(directory.path, "calendar.sqlite");
  const attemptId = "88f6cbf1-5158-4b80-9476-777326aec804";
  const request = {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": attemptId },
    body: JSON.stringify({ name: "Консультация", durationMinutes: 30 }),
  };

  async function createType() {
    using database = new DatabaseSync(path);
    const app = createApp(database);
    const created = await app.request("/api/meeting-types", request);
    expect(created.status).toBe(201);
    return created.json();
  }

  const meetingType = await createType();
  using database = new DatabaseSync(path);
  const app = createApp(database);
  const recovered = await app.request(`/api/meeting-types/attempts/${attemptId}/check`, {
    method: "POST",
  });
  expect(recovered.status).toBe(200);
  expect(await recovered.json()).toEqual({ status: "saved", meetingType });

  const replay = await app.request("/api/meeting-types", request);
  expect(replay.status).toBe(201);
  expect(await replay.json()).toEqual(meetingType);
  expect(await (await app.request("/api/meeting-types")).json()).toEqual({
    meetingTypes: [meetingType],
  });
});

test("a confirmed missing attempt cannot create a type through a delayed submission", async () => {
  using directory = mkdtempDisposableSync(join(tmpdir(), "call-calendar-"));
  const path = join(directory.path, "calendar.sqlite");
  const attemptId = "266220a0-052c-4bd1-ab96-cb45e9280dbc";
  const checkUrl = `/api/meeting-types/attempts/${attemptId}/check`;

  {
    using database = new DatabaseSync(path);
    const app = createApp(database);
    const result = await app.request(checkUrl, { method: "POST" });
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ status: "not_saved" });
  }

  using database = new DatabaseSync(path);
  const app = createApp(database);
  const request = {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": attemptId },
    body: JSON.stringify({ name: "Встреча", durationMinutes: 30 }),
  };
  const delayed = await app.request("/api/meeting-types", request);
  expect(delayed.status).toBe(409);
  expect(await delayed.json()).toMatchObject({ code: "not_saved" });
  expect(await (await app.request("/api/meeting-types")).json()).toEqual({ meetingTypes: [] });
  expect(await (await app.request(checkUrl, { method: "POST" })).json()).toEqual({
    status: "not_saved",
  });

  const newAttemptId = "1ad11474-b0a8-43a6-8f6f-c20a53db9e80";
  const resubmitted = await app.request("/api/meeting-types", {
    ...request,
    headers: {
      ...request.headers,
      "Idempotency-Key": newAttemptId,
    },
  });
  expect(resubmitted.status).toBe(201);
});
