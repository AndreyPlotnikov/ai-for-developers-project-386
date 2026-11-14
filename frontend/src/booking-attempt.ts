import { z } from "zod";

const storageKey = "calendar.booking-attempt";
const attemptSchema = z.object({
  id: z.uuid(),
  meetingTypeId: z.string().min(1),
  startsAt: z.iso.datetime(),
  values: z.object({ guestName: z.string(), guestEmail: z.string() }),
});

export type BookingAttempt = z.infer<typeof attemptSchema>;

export function readBookingAttempt() {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored ? attemptSchema.safeParse(JSON.parse(stored)).data : undefined;
  } catch {
    return undefined;
  }
}

export function storeBookingAttempt(attempt: BookingAttempt) {
  window.localStorage.setItem(storageKey, JSON.stringify(attempt));
}

export function clearBookingAttempt(id: string) {
  if (readBookingAttempt()?.id === id) window.localStorage.removeItem(storageKey);
}
