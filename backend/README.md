# Бекенд календаря звонков

TypeScript + Hono на Node.js, контракт TypeSpec и генерация сервера Orval. Сейчас единственный endpoint — `GET /health`, ответ `200 {"status":"ok"}`.

Каркас создан официальным `create-hono@0.19.5`, шаблон `nodejs`, затем дополнен генерацией по [Hono getting started](https://hono.dev/docs/getting-started/nodejs) и [руководству Orval](https://orval.dev/docs/guides/hono/).

## Запуск

Нужны Node.js 24.12.0 (`.node-version`) и pnpm 10.11.0 (`packageManager`). Команды из этого каталога:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

В другом терминале:

```bash
curl --fail http://127.0.0.1:3000/health
```

| Команда | Назначение |
| --- | --- |
| `pnpm generate` | TypeSpec → OpenAPI → сервер Hono |
| `pnpm generate:openapi` | Только TypeSpec → OpenAPI |
| `pnpm generate:server` | Только OpenAPI → Orval, после генерации OpenAPI |
| `pnpm dev` | Генерация и запуск с перезапуском при изменении TypeScript |
| `pnpm typecheck` | Проверка TypeScript без сборки |
| `pnpm build` | Генерация и компиляция в `dist/` |
| `pnpm start` | Запуск уже собранного `dist/index.js` |

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

В `src/handlers/` Orval создаёт заготовки. Тела обработчиков пишутся вручную. Стратегия `smart` сохраняет пользовательскую реализацию и обновляет принадлежащие генератору импорты/валидаторы. После изменения контракта проверяйте diff обработчиков и запускайте `pnpm typecheck`.

`dev` генерирует код перед запуском и следит за TypeScript. После изменения `.tsp` выполните `pnpm generate` в другом терминале либо перезапустите `pnpm dev`.

Прямые зависимости закреплены точными версиями, транзитивные — `pnpm-lock.yaml`. TypeScript 6.0.3 выбран для совместимости с генераторами, использующими compiler API. `pnpm-workspace.yaml` разрешает install script только для `esbuild`, нужного инструментам разработки. В `.npmrc` указан публичный npm registry и включена проверка версий окружения.

Клиентский SDK будет подключён при добавлении фронтенда; здесь Orval генерирует сервер. Реализации бронирования, БД и автоматического тестового runner пока нет.
