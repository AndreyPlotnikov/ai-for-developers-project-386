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

function updateStoredAttempt<T>(update: () => T): Promise<T> {
  if (navigator.locks) return navigator.locks.request(storageKey, update);
  return Promise.resolve().then(update);
}

export function claimBookingAttempt(attempt: BookingAttempt) {
  return updateStoredAttempt(() => {
    if (readBookingAttempt()) return false;
    window.localStorage.setItem(storageKey, JSON.stringify(attempt));
    return true;
  });
}

export function clearBookingAttempt(id: string) {
  return updateStoredAttempt(() => {
    if (readBookingAttempt()?.id === id) window.localStorage.removeItem(storageKey);
  });
}
