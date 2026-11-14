import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { MeetingType, MeetingTypeInput } from "./generated/api.schemas.js";

export class MeetingTypes {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS meeting_types (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        durationMinutes INTEGER NOT NULL
      ) STRICT
    `);
  }

  create(input: MeetingTypeInput): MeetingType {
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
