# Бекенд календаря звонков

TypeScript + Hono на Node.js, контракт TypeSpec и генерация сервера Orval. Состояние сервера доступно через `GET /health`. API типов встреч поддерживает `GET /api/meeting-types`, `POST /api/meeting-types` и `GET /api/meeting-types/{id}`.

Каркас создан официальным `create-hono@0.19.5`, шаблон `nodejs`, затем дополнен генерацией по [Hono getting started](https://hono.dev/docs/getting-started/nodejs) и [руководству Orval](https://orval.dev/docs/guides/hono/).

## Запуск

Версии Node.js и pnpm зафиксированы в корневом `mise.toml`. Установка описана в [README проекта](../README.md). Команды из этого каталога:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

В другом терминале:

```bash
curl --fail http://127.0.0.1:3000/health
```

| Команда                 | Назначение                                                 |
| ----------------------- | ---------------------------------------------------------- |
| `pnpm generate`         | TypeSpec → OpenAPI → сервер Hono                           |
| `pnpm generate:openapi` | Только TypeSpec → OpenAPI                                  |
| `pnpm generate:server`  | Только OpenAPI → Orval, после генерации OpenAPI            |
| `pnpm dev`              | Генерация и запуск с перезапуском при изменении TypeScript |
| `pnpm test`             | Запуск тестов Vitest                                       |
| `pnpm typecheck`        | Проверка TypeScript без сборки                             |
| `pnpm build`            | Генерация и компиляция в `dist/`                           |
| `pnpm start`            | Запуск уже собранного `dist/index.js`                      |

Из корня репозитория используйте `pnpm --dir backend <команда>`. `HOST` по умолчанию равен `127.0.0.1`, `PORT` — `3000`. Для другого порта: `PORT=3001 pnpm start`. Для внешнего доступа можно явно задать `HOST=0.0.0.0`.

## Контракт и генерация

```text
api/main.tsp                    исходный контракт
api/tspconfig.yaml              настройки TypeSpec/OpenAPI
api/generated/openapi.yaml     сгенерированная спецификация
orval.config.ts                 настройки серверной генерации
src/generated/                 маршруты, контексты, модели, валидаторы
src/handlers/                  реализации обработчиков
src/index.ts                   запуск и остановка Node-сервера
```

Изменяйте контракт в `api/main.tsp`, затем выполняйте `pnpm generate`. Сгенерированные OpenAPI и TypeScript-файлы хранятся в репозитории для просмотра изменений; вручную править `api/generated/` и `src/generated/` не нужно.

Сразу после правок TypeSpec запустите из корня проекта `mise run check:openapi`. Команда обновляет `backend/api/generated/openapi.yaml` и проверяет его через Vacuum. После проверки обновите сервер и клиентский SDK и запустите `mise run check`.

В `src/handlers/` Orval создаёт заготовки. Тела обработчиков пишутся вручную. Стратегия `smart` сохраняет пользовательскую реализацию и обновляет принадлежащие генератору импорты/валидаторы. После изменения контракта проверяйте diff обработчиков и запускайте `pnpm typecheck`.

`dev` генерирует код перед запуском и следит за TypeScript. После изменения `.tsp` выполните `pnpm generate` в другом терминале либо перезапустите `pnpm dev`.

Прямые зависимости закреплены точными версиями, транзитивные — `pnpm-lock.yaml`. TypeScript 6.0.3 выбран для совместимости с генераторами, использующими compiler API. `pnpm-workspace.yaml` разрешает install script только для `esbuild`, нужного инструментам разработки. В `.npmrc` указан публичный npm registry и включена проверка версий окружения.

Дымовой тест обращается к `GET /health` через `app.request()` без запуска сетевого сервера. Клиентский SDK генерируется из того же OpenAPI командой `pnpm --dir frontend generate` из корня проекта; здесь Orval генерирует сервер. Для типов встреч используется SQLite. `DATABASE_PATH` задаёт путь к файлу БД, по умолчанию `call-calendar.sqlite` в рабочем каталоге бекенда.

## Рабочее расписание

- `OWNER_TIME_ZONE` задаёт именованный часовой пояс IANA. По умолчанию используется `Europe/Moscow`.
- `OWNER_WORKING_HOURS` задаёт рабочее расписание в JSON. Ключи — `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`. Значение каждого ключа — массив объектов с полями `start` и `end` в формате `HH:MM`. Пропущенный день и пустой массив означают выходной. Если переменная не задана, действуют рабочие дни с понедельника по пятницу с 09:00 до 18:00.
- `SLOT_STEP_MINUTES` задаёт шаг начала встреч от полуночи владельца целым числом от 1 до 1440 минут. По умолчанию шаг равен 15 минутам.

Интервалы не должны пересекаться. Значение `24:00` допустимо как конец интервала. Чтобы задать рабочее время через полночь, укажите конец первого интервала в `24:00` и начало следующего в `00:00`.

```bash
OWNER_TIME_ZONE=Europe/Moscow \
OWNER_WORKING_HOURS='{"monday":[{"start":"09:00","end":"12:00"},{"start":"13:00","end":"18:00"}]}' \
SLOT_STEP_MINUTES=20 \
pnpm --dir backend start
```
