# Фронтенд календаря звонков

React, TypeScript, Vite и Mantine. Инструкции по установке и запуску фронтенда и бекенда находятся в [корневом README](../README.md).

`pnpm generate` обновляет OpenAPI из TypeSpec в `backend/` и генерирует клиентский SDK в `src/generated/`. `pnpm build` запускает генерацию и проверку типов перед сборкой. Сгенерированный код не редактируется вручную.

## E2E-тесты

После `mise run install` установите Chromium и запустите тесты из корня проекта.

```bash
mise exec -- pnpm --dir frontend exec playwright install --only-shell chromium
mise exec -- pnpm --dir frontend test:e2e
```

Playwright запускает Hono и Vite на свободных локальных портах. Для каждого прогона создаётся SQLite в памяти. GitHub Actions запускает эти тесты после `mise run check`. Трассы упавших тестов доступны в `frontend/test-results/`.
