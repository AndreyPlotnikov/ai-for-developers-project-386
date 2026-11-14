import { z } from "zod";
import type { AvailabilitySlot, MeetingTypeAvailability } from "./generated/api.schemas.js";

const windowDays = 14;
const dayMinutes = 1440;
const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
const defaultWorkingDay = [{ start: 9 * 60, end: 18 * 60 }];
const defaultWeek = weekdays.map((_, index) => (index < 5 ? defaultWorkingDay : []));

type WorkingInterval = { start: number; end: number };

const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const workingInterval = z.strictObject({
  start: clockTime,
  end: clockTime.or(z.literal("24:00")),
});
const workingHours = z.partialRecord(z.enum(weekdays), z.array(workingInterval));

function minutesSinceMidnight(time: string) {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
}

function parseWorkingWeek(input: string | undefined) {
  if (input === undefined) return defaultWeek;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("OWNER_WORKING_HOURS must be a JSON object");
  }
  const week = workingHours.safeParse(parsed);
  if (!week.success) {
    throw new Error(
      "OWNER_WORKING_HOURS must map weekday names to arrays of {start, end} times in HH:MM",
    );
  }
  return weekdays.map((day) => {
    const intervals = (week.data[day] ?? [])
      .map(({ start, end }) => ({
        start: minutesSinceMidnight(start),
        end: minutesSinceMidnight(end),
      }))
      .sort((first, second) => first.start - second.start);
    const merged: WorkingInterval[] = [];
    for (const interval of intervals) {
      const previous = merged.at(-1);
      if (interval.end <= interval.start || (previous && interval.start < previous.end)) {
        throw new Error(
          `OWNER_WORKING_HOURS has an empty, reversed or overlapping interval on ${day}`,
        );
      }
      if (previous && interval.start === previous.end) previous.end = interval.end;
      else merged.push(interval);
    }
    return merged;
  });
}

function parseTimeZone(input: string | undefined) {
  const timeZone = input ?? "Europe/Moscow";
  try {
    // Intl accepts numeric offsets as well as named zones.
    if (!/^[a-z]/i.test(timeZone)) throw new RangeError();
    new Intl.DateTimeFormat("en", { timeZone });
    return timeZone;
  } catch {
    throw new Error("OWNER_TIME_ZONE must be a named IANA time zone, such as Europe/Moscow");
  }
}

function parseStep(input: string | undefined) {
  if (input === undefined) return 15;
  const step = Number(input);
  if (!/^\d+$/.test(input) || step < 1 || step > dayMinutes) {
    throw new Error("SLOT_STEP_MINUTES must be an integer between 1 and 1440");
  }
  return step;
}

export class WorkingCalendar {
  readonly timeZone: string;
  private readonly week: WorkingInterval[][];
  private readonly step: number;

  constructor(environment: NodeJS.ProcessEnv) {
    this.timeZone = parseTimeZone(environment.OWNER_TIME_ZONE);
    this.week = parseWorkingWeek(environment.OWNER_WORKING_HOURS);
    this.step = parseStep(environment.SLOT_STEP_MINUTES);
  }

  list(durationMinutes: number, now: Date): MeetingTypeAvailability {
    const currentInstant = Temporal.Instant.fromEpochMilliseconds(now.getTime());
    const today = currentInstant.toZonedDateTimeISO(this.timeZone).toPlainDate();
    const days = Array.from({ length: windowDays }, (_, offset) => {
      const date = today.add({ days: offset });
      const slots: AvailabilitySlot[] = [];
      for (const interval of this.week[date.dayOfWeek - 1]) {
        const firstMinute = Math.ceil(interval.start / this.step) * this.step;
        for (let minute = firstMinute; minute < interval.end; minute += this.step) {
          const local = date.toPlainDateTime({
            hour: Math.floor(minute / 60),
            minute: minute % 60,
          });
          const zoned = local.toZonedDateTime(this.timeZone, { disambiguation: "earlier" });
          const startsAt = zoned.toInstant();
          if (
            Temporal.Instant.compare(startsAt, currentInstant) <= 0 ||
            !local.equals(zoned.toPlainDateTime()) ||
            !this.fits(zoned, durationMinutes)
          )
            continue;
          slots.push({
            startsAt: startsAt.toString(),
            endsAt: startsAt.add({ minutes: durationMinutes }).toString(),
          });
        }
      }
      return { date: date.toString(), slots };
    });
    return { timeZone: this.timeZone, days };
  }

  isAvailable(startsAt: string, durationMinutes: number, now: Date) {
    let instant: Temporal.Instant;
    try {
      instant = Temporal.Instant.from(startsAt);
    } catch {
      return false;
    }
    const currentInstant = Temporal.Instant.fromEpochMilliseconds(now.getTime());
    if (Temporal.Instant.compare(instant, currentInstant) <= 0) return false;

    const today = currentInstant.toZonedDateTimeISO(this.timeZone).toPlainDate();
    const start = instant.toZonedDateTimeISO(this.timeZone);
    const date = start.toPlainDate();
    return (
      Temporal.PlainDate.compare(date, today) >= 0 &&
      Temporal.PlainDate.compare(date, today.add({ days: windowDays })) < 0 &&
      (start.hour * 60 + start.minute) % this.step === 0 &&
      start.toPlainTime().equals({ hour: start.hour, minute: start.minute }) &&
      this.fits(start, durationMinutes)
    );
  }

  private fits(start: Temporal.ZonedDateTime, durationMinutes: number) {
    const minute = start.hour * 60 + start.minute;
    const interval = this.week[start.dayOfWeek - 1].find(
      ({ start, end }) => start <= minute && minute < end,
    );
    if (!interval) return false;
    const nextDay = this.week[start.dayOfWeek % weekdays.length][0];
    const overnight = interval.end === dayMinutes && nextDay?.start === 0 ? nextDay.end : 0;
    return (
      minute + durationMinutes <= interval.end + overnight &&
      avoidsClockChange(start, durationMinutes)
    );
  }
}

function avoidsClockChange(start: Temporal.ZonedDateTime, durationMinutes: number) {
  const startsAt = start.epochNanoseconds;
  const endsAt = start.add({ minutes: durationMinutes }).epochNanoseconds;
  const next = start.getTimeZoneTransition("next");
  if (next) {
    const repeated = Math.max(0, start.offsetNanoseconds - next.offsetNanoseconds);
    if (endsAt > next.epochNanoseconds - BigInt(repeated)) return false;
  }

  // Include a transition at the start itself when checking the second occurrence.
  const previous = start.add({ nanoseconds: 1 }).getTimeZoneTransition("previous");
  if (previous) {
    const repeated =
      previous.subtract({ nanoseconds: 1 }).offsetNanoseconds - previous.offsetNanoseconds;
    if (startsAt < previous.epochNanoseconds + BigInt(repeated)) return false;
  }
  return true;
}
