import "./App.css";
import { useState } from "react";
import { readBookingAttempt } from "./booking-attempt";
import { MeetingTypePage, MeetingTypesPage } from "./MeetingTypes";
import { NewMeetingType } from "./NewMeetingType";

export default function App() {
  const [attempt] = useState(readBookingAttempt);
  const path = window.location.pathname.replace(/\/$/, "");
  const detail = /^\/book\/([^/]+)$/.exec(path);
  let page = <Home />;
  if (path === "/book") page = <MeetingTypesPage />;
  if (detail) page = <MeetingTypePage id={detail[1]} />;
  if (attempt && (path === "/book" || detail)) {
    page = <MeetingTypePage id={attempt.meetingTypeId} initialAttempt={attempt} />;
  }
  if (path === "/admin/meeting-types") page = <MeetingTypesPage ownerView />;
  if (path === "/admin/meeting-types/new") page = <NewMeetingType />;

  return (
    <div className="page">
      <header className="header">
        <div className="header-inner">
          <a className="brand" href="/">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M7 3v4M17 3v4M3 10h18" />
              <circle cx="16" cy="16" r="3.5" fill="white" />
              <path d="M16 14.5V16l1 1" />
            </svg>
            <span>Календарь звонков</span>
          </a>
          <nav aria-label="Основная навигация" className="navigation">
            <a href="/book">Записаться</a>
            <a href="/admin/meeting-types">Админка</a>
          </nav>
        </div>
      </header>

      <main className="main">{page}</main>
    </div>
  );
}

function Home() {
  return (
    <div className="content">
      <section className="intro" aria-labelledby="page-title">
        <span className="eyebrow">Быстрая запись на звонок</span>
        <h1 id="page-title">Календарь звонков</h1>
        <p>Забронируйте встречу: выберите тип встречи и удобное время.</p>
        <a className="primary-button" href="/book">
          Записаться <span aria-hidden="true">→</span>
        </a>
      </section>

      <section className="features" aria-labelledby="features-title">
        <h2 id="features-title">Возможности</h2>
        <ul>
          <li>Выбор типа встречи и удобного времени.</li>
          <li>Бронирование встречи с подтверждением.</li>
          <li>Управление типами встреч и просмотр предстоящих встреч владельцем.</li>
        </ul>
      </section>
    </div>
  );
}
