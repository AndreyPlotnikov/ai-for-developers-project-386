const dateLabel = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const fullDateLabel = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  weekday: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatCalendarDate(date: string, full = false) {
  return (full ? fullDateLabel : dateLabel).format(new Date(date));
}

export function formatSlotTime(instant: string, timeZone: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(instant));
}
