import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  MeetingType,
  MeetingTypeAttemptResult,
  MeetingTypeInput,
} from "./generated/api.schemas.js";
import { withImmediateTransaction } from "./sqlite.js";

export const ownerName = "Андрей Плотников";

export class MeetingTypes {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS meeting_types (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        durationMinutes INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS meeting_type_attempts (
        id TEXT PRIMARY KEY,
        meetingTypeId TEXT REFERENCES meeting_types(id)
      ) STRICT;
    `);
  }

  create(input: MeetingTypeInput, attemptId?: string): MeetingType | undefined {
    if (attemptId === undefined) return this.insert(input);

    return this.withAttempt(attemptId, (id, existing) => {
      if (existing) return existing.status === "saved" ? existing.meetingType : undefined;
      const meetingType = this.insert(input);
      this.database
        .prepare("INSERT INTO meeting_type_attempts (id, meetingTypeId) VALUES (?, ?)")
        .run(id, meetingType.id);
      return meetingType;
    });
  }

  checkAttempt(attemptId: string): MeetingTypeAttemptResult {
    return this.withAttempt(attemptId, (id, existing) => {
      if (existing) return existing;
      // Close the attempt before declaring it absent, even if its POST is still in flight.
      this.database.prepare("INSERT INTO meeting_type_attempts (id) VALUES (?)").run(id);
      return { status: "not_saved" };
    });
  }

  private withAttempt<T>(
    attemptId: string,
    resolve: (id: string, result: MeetingTypeAttemptResult | undefined) => T,
  ): T {
    return withImmediateTransaction(this.database, () => {
      const id = attemptId.toLowerCase();
      return resolve(id, this.getAttempt(id));
    });
  }

  private getAttempt(id: string): MeetingTypeAttemptResult | undefined {
    const row = this.database
      .prepare("SELECT meetingTypeId FROM meeting_type_attempts WHERE id = ?")
      .get(id);
    if (!row) return undefined;
    if (row.meetingTypeId === null) return { status: "not_saved" };

    const meetingType = typeof row.meetingTypeId === "string" && this.get(row.meetingTypeId);
    if (!meetingType) throw new Error("Invalid stored meeting type attempt");
    return { status: "saved", meetingType };
  }

  private insert(input: MeetingTypeInput): MeetingType {
    const meetingType = { ...input, name: input.name.trim(), id: randomUUID() };
    this.database
      .prepare(
        "INSERT INTO meeting_types (id, name, description, durationMinutes) VALUES (?, ?, ?, ?)",
      )
      .run(
        meetingType.id,
        meetingType.name,
        meetingType.description ?? null,
        meetingType.durationMinutes,
      );
    return meetingType;
  }

  list(): MeetingType[] {
    return this.database
      .prepare("SELECT id, name, description, durationMinutes FROM meeting_types ORDER BY rowid")
      .all()
      .map(readMeetingType);
  }

  get(id: string): MeetingType | undefined {
    const row = this.database
      .prepare("SELECT id, name, description, durationMinutes FROM meeting_types WHERE id = ?")
      .get(id);
    return row && readMeetingType(row);
  }
}

function readMeetingType(row: Record<string, unknown>): MeetingType {
  const { id, name, description, durationMinutes } = row;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    (description !== null && typeof description !== "string") ||
    typeof durationMinutes !== "number"
  ) {
    throw new Error("Invalid stored meeting type");
  }
  return { id, name, description: description ?? undefined, durationMinutes };
}

export type MeetingTypeEnv = { Variables: { meetingTypes: MeetingTypes } };
