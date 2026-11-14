import { useEffect, useState } from "react";
import { BookingCalendar } from "./BookingCalendar";
import {
  meetingTypesGetMeetingType,
  meetingTypesListMeetingTypes,
  type MeetingType,
} from "./generated/api";

async function loadCatalog(signal: AbortSignal) {
  const response = await meetingTypesListMeetingTypes({ signal, cache: "no-store" });
  if (response.status !== 200) throw new Error("Catalog unavailable");
  return response.data;
}

function useLoad<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then(
      (value) => {
        if (controller.signal.aborted) return;
        setData(value);
        setStatus("ready");
      },
      () => {
        if (!controller.signal.aborted) setStatus("error");
      },
    );
    return () => controller.abort();
  }, [load, revision]);

  return {
    data,
    status,
    refresh() {
      if (status === "loading") return;
      setStatus("loading");
      setRevision((value) => value + 1);
    },
  };
}

function LoadStatus({
  resource,
  message,
}: {
  resource: { data: unknown; status: string; refresh: () => void };
  message: string;
}) {
  const { data, status, refresh } = resource;
  return (
    <div className="load-status">
      <p role="status">{status === "loading" ? "Загрузка…" : ""}</p>
      {status === "error" && (
        <p role="alert">
          {message} {data !== undefined && "Показаны ранее загруженные данные."}
        </p>
      )}
      <button
        className="secondary-button"
        type="button"
        onClick={refresh}
        aria-disabled={status === "loading"}
      >
        {status === "error" ? "Повторить" : "Обновить"}
      </button>
    </div>
  );
}

export function MeetingTypesPage({ ownerView = false }: { ownerView?: boolean }) {
  const catalog = useLoad(loadCatalog);
  return (
    <section className="meeting-page">
      {ownerView ? (
        <div className="page-actions">
          <h1>Типы встреч</h1>
          <a className="primary-button" href="/admin/meeting-types/new">
            Создать тип встречи
          </a>
        </div>
      ) : (
        <div className="owner-panel">
          <p>Владелец календаря</p>
          <h1>{catalog.data?.ownerName ?? "Каталог встреч"}</h1>
          <h2>Выберите тип встречи</h2>
        </div>
      )}
      <LoadStatus resource={catalog} message="Не удалось загрузить типы встреч." />
      {catalog.data?.meetingTypes.length === 0 && (
        <p>
          {ownerView
            ? "Вы пока не создали ни одного типа встречи."
            : "Пока нет доступных типов встреч"}
        </p>
      )}
      {!!catalog.data?.meetingTypes.length && (
        <ul className="meeting-grid">
          {catalog.data.meetingTypes.map((meetingType) => (
            <li className="meeting-card" key={meetingType.id}>
              <h3>
                <a className="meeting-card-link" href={meetingTypePath(meetingType.id)}>
                  {meetingType.name}
                </a>
              </h3>
              <MeetingTypeDetails meetingType={meetingType} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MeetingTypePage({ id }: { id: string }) {
  const [load] = useState(() => async (signal: AbortSignal) => {
    const response = await meetingTypesGetMeetingType(id, { signal, cache: "no-store" });
    if (response.status === 404) return null;
    if (response.status !== 200) throw new Error("Meeting type unavailable");
    return response.data;
  });
  const meetingType = useLoad(load);

  return (
    <section className="meeting-page">
      <a href="/book">К каталогу типов встреч</a>
      {meetingType.data ? (
        <article className="meeting-panel">
          <h1>{meetingType.data.name}</h1>
          <MeetingTypeDetails meetingType={meetingType.data} />
        </article>
      ) : (
        <h1>{meetingType.data === null ? "Тип встречи не найден" : "Тип встречи"}</h1>
      )}
      <LoadStatus resource={meetingType} message="Не удалось загрузить тип встречи." />
      {meetingType.data && <BookingCalendar meetingTypeId={meetingType.data.id} />}
    </section>
  );
}

function MeetingTypeDetails({ meetingType }: { meetingType: MeetingType }) {
  return (
    <>
      <p>{meetingType.durationMinutes} мин</p>
      {meetingType.description && <p className="meeting-description">{meetingType.description}</p>}
    </>
  );
}

export function meetingTypePath(id: string) {
  return `/book/${encodeURIComponent(id)}`;
}
