import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { WorkingCalendar } from "./availability.js";
import type {
  BookingAttemptResult,
  BookingInput,
  Meeting,
  MeetingTypeAvailability,
  UpcomingMeetings,
} from "./generated/api.schemas.js";
import { MeetingTypes, ownerName } from "./meeting-types.js";
import { withImmediateTransaction } from "./sqlite.js";

type BookingResult =
  | { status: "saved"; meeting: Meeting }
  | { status: "not_found" | "slot_unavailable" | "attempt_closed" | "not_saved" | "unknown" };

export class Meetings {
  constructor(
    private readonly database: DatabaseSync,
    private readonly meetingTypes: MeetingTypes,
    private readonly calendar: WorkingCalendar,
    private readonly now: () => Date,
  ) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY,
        meetingTypeId TEXT NOT NULL REFERENCES meeting_types(id),
        meetingTypeName TEXT NOT NULL,
        ownerName TEXT NOT NULL,
        guestName TEXT NOT NULL,
        guestEmail TEXT NOT NULL,
        startsAt INTEGER NOT NULL,
        endsAt INTEGER NOT NULL CHECK (endsAt > startsAt),
        timeZone TEXT NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS meetings_starts_at ON meetings(startsAt);
      CREATE INDEX IF NOT EXISTS meetings_ends_at ON meetings(endsAt);

      CREATE TABLE IF NOT EXISTS booking_attempts (
        id TEXT PRIMARY KEY,
        meetingId TEXT REFERENCES meetings(id)
      ) STRICT;
    `);
  }

  book(meetingTypeId: string, input: BookingInput, attemptId: string): BookingResult {
    let checkedNewAttempt = false;
    try {
      return withImmediateTransaction(
        this.database,
        () => {
          const id = attemptId.toLowerCase();
          const original = this.readAttempt(id);
          if (original?.status === "saved") return original;
          if (original) return { status: "attempt_closed" };
          checkedNewAttempt = true;

          const meetingType = this.meetingTypes.get(meetingTypeId);
          if (!meetingType) return { status: "not_found" };
          if (!this.calendar.isAvailable(input.startsAt, meetingType.durationMinutes, this.now())) {
            return { status: "slot_unavailable" };
          }
          const startsAt = Temporal.Instant.from(input.startsAt).epochMilliseconds;
          const endsAt = startsAt + meetingType.durationMinutes * 60_000;
          const overlaps = this.database
            .prepare("SELECT 1 FROM meetings WHERE endsAt > ? AND startsAt < ? LIMIT 1")
            .get(startsAt, endsAt);
          if (overlaps) return { status: "slot_unavailable" };

          const meeting = {
            id: randomUUID(),
            meetingTypeId,
            meetingTypeName: meetingType.name,
            ownerName,
            guestName: input.guestName,
            guestEmail: input.guestEmail,
            startsAt,
            endsAt,
            timeZone: this.calendar.timeZone,
          };
          this.database
            .prepare(`
            INSERT INTO meetings
              (id, meetingTypeId, meetingTypeName, ownerName, guestName, guestEmail, startsAt, endsAt, timeZone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
            .run(
              meeting.id,
              meeting.meetingTypeId,
              meeting.meetingTypeName,
              meeting.ownerName,
              meeting.guestName,
              meeting.guestEmail,
              meeting.startsAt,
              meeting.endsAt,
              meeting.timeZone,
            );
          this.database
            .prepare("INSERT INTO booking_attempts (id, meetingId) VALUES (?, ?)")
            .run(id, meeting.id);
          return { status: "saved", meeting: readMeeting(meeting) };
        },
        (error) => {
          if (checkedNewAttempt) {
            throw new BookingRolledBack("Booking write rolled back", { cause: error });
          }
        },
      );
    } catch (error) {
      console.error("Could not save booking", error);
      return { status: error instanceof BookingRolledBack ? "not_saved" : "unknown" };
    }
  }

  checkAttempt(attemptId: string): BookingAttemptResult {
    return withImmediateTransaction(this.database, () => {
      const id = attemptId.toLowerCase();
      const original = this.readAttempt(id);
      if (original) return original;

      // Close the attempt before reporting that an in-flight POST did not save it.
      this.database.prepare("INSERT INTO booking_attempts (id) VALUES (?)").run(id);
      return { status: "not_saved" };
    });
  }

  listUpcoming(): UpcomingMeetings {
    const rows = this.database
      .prepare("SELECT * FROM meetings WHERE startsAt > ? ORDER BY startsAt")
      .all(this.now().getTime());
    const meetings = rows.map((row) => {
      const { id, meetingTypeName, guestName, guestEmail, startsAt, endsAt } = readMeeting(row);
      return { id, meetingTypeName, guestName, guestEmail, startsAt, endsAt };
    });
    return { timeZone: this.calendar.timeZone, meetings };
  }

  freeSlots(durationMinutes: number): MeetingTypeAvailability {
    const availability = this.calendar.list(durationMinutes, this.now());
    const slots = availability.days.flatMap((day) => day.slots);
    const first = slots[0];
    const last = slots.at(-1);
    if (!first || !last) return availability;

    const busy = this.database
      .prepare(
        "SELECT startsAt, endsAt FROM meetings WHERE endsAt > ? AND startsAt < ? ORDER BY startsAt",
      )
      .all(Date.parse(first.startsAt), Date.parse(last.endsAt));
    let index = 0;
    for (const day of availability.days) {
      day.slots = day.slots.filter((slot) => {
        const startsAt = Date.parse(slot.startsAt);
        while (index < busy.length && Number(busy[index].endsAt) <= startsAt) index++;
        return index === busy.length || Number(busy[index].startsAt) >= Date.parse(slot.endsAt);
      });
    }
    return availability;
  }

  private readAttempt(id: string): BookingAttemptResult | undefined {
    const row = this.database
      .prepare(
        `SELECT booking_attempts.meetingId, meetings.* FROM booking_attempts
         LEFT JOIN meetings ON booking_attempts.meetingId = meetings.id
         WHERE booking_attempts.id = ?`,
      )
      .get(id);
    if (!row) return undefined;
    if (row.meetingId === null) return { status: "not_saved" };
    return { status: "saved", meeting: readMeeting(row) };
  }
}

class BookingRolledBack extends Error {}

function readMeeting(row: Record<string, unknown>): Meeting {
  const {
    id,
    meetingTypeId,
    meetingTypeName,
    ownerName,
    guestName,
    guestEmail,
    startsAt,
    endsAt,
    timeZone,
  } = row;
  if (
    typeof id !== "string" ||
    typeof meetingTypeId !== "string" ||
    typeof meetingTypeName !== "string" ||
    typeof ownerName !== "string" ||
    typeof guestName !== "string" ||
    typeof guestEmail !== "string" ||
    typeof startsAt !== "number" ||
    typeof endsAt !== "number" ||
    typeof timeZone !== "string"
  ) {
    throw new Error("Invalid stored meeting");
  }
  return {
    id,
    meetingTypeId,
    meetingTypeName,
    ownerName,
    guestName,
    guestEmail,
    startsAt: Temporal.Instant.fromEpochMilliseconds(startsAt).toString(),
    endsAt: Temporal.Instant.fromEpochMilliseconds(endsAt).toString(),
    timeZone,
  };
}
