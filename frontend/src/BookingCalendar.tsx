import { useEffect, useState } from "react";
import { formatCalendarDate, formatSlotTime } from "./calendar-time";
import {
  meetingTypesGetAvailability,
  type AvailabilitySlot,
  type MeetingTypeAvailability,
} from "./generated/api";

type CalendarState = {
  data?: MeetingTypeAvailability;
  selectedDate?: string;
  status: "loading" | "ready" | "error";
  revision: number;
};

export function BookingCalendar({ meetingTypeId }: { meetingTypeId: string }) {
  const [calendar, setCalendar] = useState<CalendarState>({ status: "loading", revision: 0 });
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot>();
  const { data, selectedDate, status, revision } = calendar;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await meetingTypesGetAvailability(meetingTypeId, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.status !== 200) throw new Error("Availability unavailable");
        const data = response.data;
        if (controller.signal.aborted) return;
        setCalendar((current) => {
          if (current.revision !== revision) return current;
          const selectedDate = data.days.some((day) => day.date === current.selectedDate)
            ? current.selectedDate
            : data.days.find((day) => day.slots.length > 0)?.date;
          return { data, selectedDate, status: "ready", revision };
        });
      } catch {
        if (controller.signal.aborted) return;
        setCalendar((current) =>
          current.revision === revision ? { ...current, status: "error" } : current,
        );
      }
    }
    void load();
    return () => controller.abort();
  }, [meetingTypeId, revision]);

  function refresh(date = selectedDate) {
    setSelectedSlot(undefined);
    setCalendar((current) => ({
      ...current,
      selectedDate: date,
      status: "loading",
      revision: current.revision + 1,
    }));
  }

  const day = data?.days.find((day) => day.date === selectedDate);
  return (
    <section className="meeting-panel booking-calendar" aria-labelledby="availability-title">
      <h2 id="availability-title">Доступное время</h2>
      {data && <p>Часовой пояс владельца: {data.timeZone}</p>}
      <p className="calendar-status" role="status">
        {status === "loading" ? "Загрузка доступного времени…" : ""}
      </p>
      {status === "error" && (
        <p role="alert">
          Не удалось загрузить доступное время. {data && "Показаны ранее загруженные данные."}
        </p>
      )}
      {data || status === "error" || revision > 0 ? (
        <button
          className="secondary-button"
          type="button"
          aria-disabled={status === "loading"}
          onClick={() => {
            if (status !== "loading") refresh();
          }}
        >
          {status === "error" ? "Повторить" : "Обновить доступное время"}
        </button>
      ) : null}
      {data && (
        <>
          <h3 id="availability-dates">Даты</h3>
          <ul className="calendar-dates" aria-labelledby="availability-dates">
            {data.days.map(({ date, slots }) => (
              <li key={date}>
                <button
                  className="secondary-button calendar-date"
                  type="button"
                  aria-pressed={date === selectedDate}
                  onClick={() => refresh(date)}
                >
                  {formatCalendarDate(date)}
                  {slots.length === 0 && <small>Нет времени</small>}
                </button>
              </li>
            ))}
          </ul>
          <div role="status" className="calendar-status">
            {day?.slots.length === 0 && "На эту дату нет свободного времени. Выберите другую дату."}
            {!day && "Нет свободного времени на ближайшие 14 дней."}
          </div>
          {!!day?.slots.length && (
            <>
              <h3 id="availability-slots">Время начала</h3>
              <ul className="calendar-slots" aria-labelledby="availability-slots">
                {day.slots.map((slot) => (
                  <li key={slot.startsAt}>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={status !== "ready"}
                      aria-pressed={selectedSlot?.startsAt === slot.startsAt}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {formatSlotTime(slot.startsAt, data.timeZone)}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
