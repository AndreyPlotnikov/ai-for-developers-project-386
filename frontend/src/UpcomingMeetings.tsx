import { formatMeetingTime } from "./calendar-time";
import { listUpcomingMeetings } from "./generated/api";
import { LoadStatus, useLoad } from "./load-resource";

async function loadUpcomingMeetings(signal: AbortSignal) {
  const response = await listUpcomingMeetings({ signal, cache: "no-store" });
  if (response.status !== 200) throw new Error("Upcoming meetings unavailable");
  return response.data;
}

export function UpcomingMeetingsPage() {
  const upcoming = useLoad(loadUpcomingMeetings);
  const data = upcoming.data;

  return (
    <section className="meeting-page">
      <a href="/admin/meeting-types">Типы встреч</a>
      <h1>Предстоящие встречи</h1>
      <LoadStatus resource={upcoming} message="Не удалось загрузить предстоящие встречи." />
      {data?.meetings.length === 0 && <p>Предстоящих встреч нет</p>}
      {!!data?.meetings.length && (
        <ol className="upcoming-meetings" role="list">
          {data.meetings.map((meeting) => (
            <li className="meeting-card" key={meeting.id}>
              <h2>{meeting.meetingTypeName}</h2>
              <p>{formatMeetingTime(meeting.startsAt, meeting.endsAt, data.timeZone)}</p>
              <dl>
                <dt>Имя гостя</dt>
                <dd>{meeting.guestName}</dd>
                <dt>Email гостя</dt>
                <dd>{meeting.guestEmail}</dd>
              </dl>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
