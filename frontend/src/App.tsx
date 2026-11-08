import "./App.css";

export default function App() {
  return (
    <div className="page">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
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
          </div>
          <nav aria-label="Основная навигация" className="navigation">
            <button disabled>
              Записаться <span className="visually-hidden">(скоро)</span>
            </button>
            <button disabled>
              Админка <span className="visually-hidden">(скоро)</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        <div className="content">
          <section className="intro" aria-labelledby="page-title">
            <span className="eyebrow">Быстрая запись на звонок</span>
            <h1 id="page-title">Календарь звонков</h1>
            <p>Забронируйте встречу: выберите тип встречи и удобное время.</p>
            <button className="primary-button" disabled>
              Записаться <span aria-hidden="true">→</span>
            </button>
            <p className="availability">Запись и управление встречами скоро появятся</p>
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
      </main>
    </div>
  );
}
