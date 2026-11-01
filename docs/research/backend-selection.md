# Выбор TypeScript-бекенда для «Календаря звонков»

Дата исследования: **1 ноября 2026 года**. Область: выбор стека для задачи 1 [шага 2](../project-steps/02-application-skeleton.md). **Решение принято:** TypeScript + Hono + Orval, Node.js + pnpm. Каркас размещается в `backend/`, контракт — в `backend/api/`.

**Обязательное ограничение пользователя: бекенд на TypeScript.** Уточнение получено 1 ноября 2026 года и имеет приоритет над свободой выбора языка в учебном задании. Python, Go, Java, C# и Ruby исключены из кандидатов; прежнее предложение выбирать по предпочтению Python больше не применяется. После исследования пользователь выбрал Node.js и pnpm; остальные варианты ниже сохранены как обоснование выбора.

## Вывод после расширения охвата

**Основные кандидаты — Hono и Fastify.** Первоначальная рекомендация Fastify была основана на слишком узком наборе вариантов. После расширения нет оснований считать его единственным очевидным выбором.

- **Hono + Node.js + Orval** предлагается, если хочется генерировать из OpenAPI маршруты, контексты и валидаторы, а вручную писать обработчики. Для этой задачи это полноценный кандидат: небольшой путь генерации и обработки запросов проверен локально, результаты ниже. Официальные основания: [Node.js starter](https://hono.dev/docs/getting-started/nodejs), [Orval Hono](https://orval.dev/docs/guides/hono/).
- **Fastify + TypeScript** предлагается, если удобнее регистрация маршрутов/схем из OpenAPI во время запуска и отдельная типизация обработчиков. Основания: [валидация](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/), [fastify-openapi-glue](https://github.com/seriousme/fastify-openapi-glue).
- **Express, Elysia и LoopBack 4** остаются содержательными альтернативами: знакомый минимальный сервер, схема с выводом типов или встроенная генерация контроллеров соответственно. **NestJS и AdonisJS** стоит выбирать за нужные соглашения и опыт с ними, а не автоматически считать обязательными для маленького API.

Это инженерная рекомендация для конкретного задания, а не рейтинг качества фреймворков. Маленький успешный эксперимент не доказывает поддержку всего будущего контракта. Полная генерация сервера необязательна по заданию; она рассматривается как способ уменьшить ручное дублирование, если её ограничения подходят.

## Требования и критерии

Источники требований: [описание проекта](../project-steps/01-project-description.md), [шаг 2](../project-steps/02-application-skeleton.md) и уточнение пользователя о TypeScript.

- Один владелец календаря, типы встреч, доступные слоты и бронирования; без авторизации, уведомлений и внешних календарей.
- Окно записи 14 календарных дней; пересечения запрещены между любыми типами встреч, в том числе при одновременных запросах. Соседние интервалы разрешены.
- Данные допустимо хранить в памяти процесса. Конечное приложение должно запускаться в Docker.
- Обязательна цепочка **TypeSpec → OpenAPI → клиентский SDK**. Серверная генерация зависит от доступных инструментов; допустима реализация по контракту с проверкой тестами.
- Сейчас выполняется только задача 1: выбор и каркас по официальному getting started. Runner и дымовой тест — задача 3 полного шага, линтеры и CI — следующие задачи.
- Команды и версии должны воспроизводиться. Фронтенд и его конкретный стек пока не утверждены; проверка SDK ниже выполнена для TypeScript.

Порядок критериев: соответствие этим ограничениям; объём интеграции контракта; простота небольшого сервера; типизация и runtime-валидация; воспроизводимость и тестируемость. Скорость, размер бандла и поддержка edge-runtime не получают дополнительных баллов без соответствующих требований и измерений.

## Как выбран расширенный набор

Сравнение покрывает три разных подхода: минимальные HTTP/middleware-фреймворки (**Hono, Express, Koa, H3**), API-фреймворки с механизмами схем и проверки (**Fastify, Elysia, hapi**) и структурированные приложения с генераторами/соглашениями (**NestJS, AdonisJS, LoopBack 4**). Категории условны и пересекаются; они нужны, чтобы не ограничивать поиск одним привычным стилем.

Это обзор **10 вариантов**, а не утверждение, что других TypeScript-фреймворков нет. Критерий отбора — самостоятельный HTTP-бекенд, подходящий для маленького REST API. При появлении дополнительного требования набор можно расширить. Нельзя исключать вариант только потому, что он часто используется на edge, поддерживает Bun или не имеет генератора в одном конкретном каталоге.

| Вариант | Подтверждённые возможности и путь от контракта | Оценка для этой задачи |
| --- | --- | --- |
| **Hono** | Node-адаптер, `app.request` для тестирования; Orval генерирует Hono из OpenAPI. [Node](https://hono.dev/docs/getting-started/nodejs), [тестирование](https://hono.dev/docs/guides/testing), [Orval](https://orval.dev/docs/guides/hono/) | Основной кандидат. Маленький каркас и реальный путь генерации; проверить поведение сложных схем и ошибок. |
| **Fastify** | JSON Schema/Ajv; glue регистрирует маршруты из OpenAPI, TS-артефакты отдельно. [Схемы](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/), [glue](https://github.com/seriousme/fastify-openapi-glue) | Основной кандидат. Нужны явные решения о приведении типов и неизвестных полях. |
| **Express** | Минимальный TS-пример; TypeSpec emitter или OpenAPI Validator. [Старт](https://expressjs.com/en/starter/hello-world/), [validator](https://cdimascio.github.io/express-openapi-validator/) | Хорошая альтернатива при опыте Express; конфигурацию проверок собираем отдельно. |
| **Elysia** | TypeBox и Standard Schema, Node через адаптер. [Валидация](https://elysiajs.com/essential/validation), [Node](https://elysiajs.com/integrations/node) | Сильный вариант по типизации. Для внешнего TypeSpec нужен отдельно проверенный путь импорта схем/маршрутов. Bun не обязателен. |
| **hapi** | TS-декларации, проверки через Joi/функции; у OpenAPI Backend есть hapi-интеграция. [Пакет](https://github.com/hapijs/hapi/blob/master/package.json), [валидация](https://hapi.dev/tutorials/en_us/validation), [адаптер](https://github.com/openapistack/openapi-backend#hapi) | Подходит; преимущество перед двумя основными кандидатами для наших требований не установлено. |
| **Koa** | Минимальное middleware-ядро; OpenAPI Backend документирует подключение Koa. [Ядро](https://koajs.com/), [адаптер](https://github.com/openapistack/openapi-backend#koa) | Подходит; больше самостоятельной сборки вокруг ядра. Выбирать при предпочтении middleware-модели. |
| **H3** | Web Request/Response, модульные утилиты; валидация через Standard Schema. [Старт](https://h3.dev/guide), [валидация](https://h3.dev/examples/validate-data) | Ещё один небольшой вариант. Для внешнего контракта нужно проверить привязку операций и сгенерированных валидаторов. |
| **NestJS** | Модули, контроллеры и DI; есть OpenAPI server generator, BETA. [Старт](https://docs.nestjs.com/first-steps), [генератор](https://openapi-generator.tech/docs/generators/typescript-nestjs-server/) | Оправдан при нужной архитектуре/опыте. Наличие генератора не гарантирует runtime-валидацию. |
| **AdonisJS** | TypeScript, готовый API starter и инструменты приложения. [Введение](https://docs.adonisjs.com/introduction), [установка](https://docs.adonisjs.com/installation) | Подходит, но для текущего объёма многие готовые подсистемы не требуются. Путь от внешнего OpenAPI отдельно не проверен. |
| **LoopBack 4** | `lb4 openapi` генерирует модели, типы и контроллеры из OpenAPI 3.0.x. [Генератор](https://loopback.io/doc/en/lb4/OpenAPI-generator.html) | Содержательная альтернатива при приоритете встроенного contract-first инструментария; принимать вместе с архитектурой LoopBack. |

«Путь не проверен» означает ограничение этого исследования, а не доказанное отсутствие инструмента. Наличие TS-деклараций также не означает автоматический вывод типов всех предметных маршрутов из OpenAPI.

## Сопоставление основных способов работы

| Решение | Где берутся маршруты | Где берётся runtime-проверка | Что остаётся нашим кодом |
| --- | --- | --- | --- |
| Hono + Orval | Сгенерированный TS-модуль Hono | Сгенерированные Zod-схемы и middleware | Тела обработчиков, доменные правила, политика ошибок, запуск Node |
| Fastify + glue | Регистрация из OpenAPI при запуске | Схемы Fastify/Ajv | Обработчики и их типизация, доменные правила, настройки валидации |
| Express + OpenAPI Validator | Собственные маршруты или сопоставление операций | OpenAPI middleware | Обработчики, типизация, интеграция middleware |
| Elysia + схемы из OpenAPI | Собственная привязка операций в исследованном варианте | Подключённые Standard Schema/TypeBox | Маршруты и обработчики, проверка совместимости генератора схем |
| LoopBack 4 + `lb4 openapi` | Сгенерированные контроллеры | Нужно проверить результат на нашем контракте | Реализации контроллеров, границы повторной генерации |

Первые два пути исследованы подробнее, потому что одновременно сохраняют небольшой HTTP-каркас и дают конкретную интеграцию внешнего контракта. Это не исключает остальные варианты по формальным требованиям. Все внешние возможности в этой таблице раскрыты со ссылками в предыдущей таблице и разделах ниже.

## Обязательная цепочка и разные значения «генерации»

```text
TypeSpec — единственный исходный контракт
  ├─ @typespec/openapi3 → OpenAPI → генератор TypeScript SDK → фронтенд
  └─ сервер: прямой emitter TypeSpec ИЛИ адаптер/генератор OpenAPI
              + написанная отдельно бизнес-логика
```

`@typespec/openapi3` генерирует OpenAPI командой `tsp compile . --emit=@typespec/openapi3`; документация позволяет выбрать версии OpenAPI 3.0, 3.1 и 3.2, по умолчанию — 3.0.0. Для первого прохода предлагается явно выбрать 3.0.0 и простые JSON-модели: это консервативная отправная точка, а не доказательство совместимости всех последующих инструментов. [TypeSpec OpenAPI emitter](https://typespec.io/docs/emitters/openapi3/reference/emitter/).

Для TS-фронтенда существуют полноценные SDK-генераторы:

- **Hey API `@hey-api/openapi-ts`**: генерация TypeScript SDK и Fetch-клиент описаны владельцем инструмента. Его можно использовать с OpenAPI любого из сравниваемых серверов; источник контракта в этом проекте должен оставаться TypeSpec. [Начало работы](https://heyapi.dev/docs/openapi/typescript/get-started), [Fetch](https://heyapi.dev/docs/openapi/typescript/clients/fetch).
- **OpenAPI Generator `typescript-fetch`**: тип CLIENT, язык TypeScript, метаданные STABLE; строка `helpTxt` на той же странице всё ещё содержит «beta». Эту несогласованность нельзя выдавать за доказанную нестабильность или гарантию качества. Отдельно проверить представление дат, `additionalProperties` и настройки discriminator. [Карточка генератора](https://openapi-generator.tech/docs/generators/typescript-fetch/).

`openapi-typescript` генерирует статические TypeScript-типы без runtime-проверки. Сам по себе файл типов не равен SDK с вызываемыми HTTP-операциями и не проверяет входящий JSON. Он полезен для типизации серверных обработчиков, но обязательный SDK лучше явно получать отдельным SDK-генератором. [Документация openapi-typescript](https://openapi-ts.dev/introduction).

Нужно разделять четыре результата: **типы компилятора**, **регистрацию маршрутов**, **проверку/преобразование HTTP-данных во время выполнения**, **бизнес-правила**. Наличие одного не доказывает наличие остальных. Например, обычные TS-интерфейсы не подходят как runtime-метаданные для Nest `ValidationPipe`; Nest рекомендует конкретные классы DTO. [Nest validation](https://docs.nestjs.com/techniques/validation).

Генерация OpenAPI из серверного кода — другое направление. `@fastify/swagger` умеет строить документ из схем маршрутов, Nest Swagger — из приложения, FastAPI — из объявлений Python. Это полезные возможности, но сами по себе они не выполняют требование **TypeSpec → OpenAPI**. Для проекта нельзя незаметно сделать их второй независимой спецификацией. [Fastify Swagger](https://github.com/fastify/fastify-swagger), [Nest OpenAPI](https://docs.nestjs.com/openapi/introduction), [FastAPI first steps](https://fastapi.tiangolo.com/tutorial/first-steps/).

## Реальные серверные пути и ограничения

### Hono

Официальный getting started предлагает Node-шаблон `create-hono` и серверный адаптер `@hono/node-server`. Следовательно, Hono не требует Cloudflare/edge-развёртывания. Для нашего Docker-приложения можно выбрать Node; преимущества других runtime здесь не являются требованием. `app.request` позволяет проверять обработку запросов без открытия порта. [Node.js](https://hono.dev/docs/getting-started/nodejs), [тестирование](https://hono.dev/docs/guides/testing).

**TypeSpec → OpenAPI → Orval (`client: 'hono'`)** — документированный путь генерации серверных маршрутов, контекстов, схем и валидаторов. Название настройки `client` здесь не означает, что результат только клиентский. Генератор создаёт шаблоны обработчиков; бизнес-логику добавляет разработчик. Стратегия повторной генерации `smart` обещает сохранять пользовательские тела и обновлять принадлежащие генератору части. Это обещание нужно проверять при изменениях контракта; локально ниже проверено только повторение без изменения спецификации. [Orval Hono](https://orval.dev/docs/guides/hono/).

`hono-openapi` создаёт OpenAPI из кода/схем приложения, а Hono RPC получает тип клиента из типа приложения. Эти возможности сами по себе не заменяют обязательную цепочку от TypeSpec. [hono-openapi](https://hono.dev/examples/hono-openapi), [RPC](https://hono.dev/docs/guides/rpc).

Страница Hono в Hey API на дату чтения имеет статус **Planned / Vote**. Её наличие в меню не доказывает существование готового server plugin. Для испытанного пути использован Orval; Hey API остаётся независимым вариантом клиентского SDK. [Статус Hey API Hono](https://heyapi.dev/docs/openapi/typescript/plugins/hono).

Практические ограничения: фиксировать совместимые версии Hono, Orval, Zod и validator; не считать сгенерированный ответ об ошибке автоматически совпадающим с TypeSpec; проверить форматы дат, nullable и составные схемы. Генератор не реализует атомарное бронирование. Успешная проверка ниже относится к Hono 4.13.16, а не к любой будущей версии.

### Fastify

`fastify-openapi-glue` — отдельный проект, перечисленный в [экосистеме Fastify](https://fastify.dev/docs/latest/Guides/Ecosystem/); это не встроенный emitter TypeSpec. Он читает OpenAPI и регистрирует маршруты и схемы валидации. Обработчики связываются с операциями через `operationId` либо resolver. Это **runtime-построение конфигурации**, которое можно использовать внутри каркаса Fastify. [README](https://github.com/seriousme/fastify-openapi-glue), [serviceHandlers](https://github.com/seriousme/fastify-openapi-glue/blob/master/docs/serviceHandlers.md).

Важно: наличие у пакета `index.d.ts` не означает генерацию предметных типов нашего API. В проверенном README CLI предлагает `javascript` и `standaloneJS`, генерирует проект/заглушки и предупреждает о перезаписи файлов. Поэтому практический TS-путь: **OpenAPI → glue для маршрутов/схем + openapi-typescript для типов + собственные типизированные обработчики**. CLI-генератор целого JS-проекта для этого не обязателен. [Исходный README](https://raw.githubusercontent.com/seriousme/fastify-openapi-glue/master/README.md), [метаданные пакета](https://raw.githubusercontent.com/seriousme/fastify-openapi-glue/master/package.json), [генератор типов](https://openapi-ts.dev/introduction).

Ограничения: glue ориентируется на возможности Fastify; OpenAPI 3.1 со схемами draft-2020-12 требует дополнительного внимания, поскольку стандартный путь использует draft-07. Fastify также может приводить типы, подставлять значения по умолчанию и удалять дополнительные поля. Это поведение нужно согласовать с контрактом. Нельзя просто передать весь OpenAPI-документ как JSON Schema. [Ограничения glue](https://github.com/seriousme/fastify-openapi-glue#notes), [настройки Ajv](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/).

**Вывод:** генерация/автоматическая регистрация для Fastify существует. Её пригодность следует проверить на небольшом контракте; утверждение «для Fastify генераторов нет, всё вручную» необоснованно. Уровень поддержки стороннего плагина нельзя приравнивать к поддержке ядра Fastify.

Есть также **Beta-плагин `fastify` в Hey API для Fastify v5**: документация описывает типизированные `RouteHandlers` из OpenAPI и показывает их использование с glue. Его можно проверить вместо отдельной ручной привязки типов `openapi-typescript`. Это ещё один вариант серверных TS-артефактов, но не доказанная здесь полная замена runtime-регистрации/валидации. [Документация владельца плагина](https://heyapi.dev/docs/openapi/typescript/plugins/fastify).

### Express

У TypeSpec есть прямой `@typespec/http-server-js`: модели, интерфейсы сервисов, статический роутер и функции HTTP-операций. Опция `express: true` добавляет `expressMiddleware`; бизнес-реализации передаются созданному роутеру. Это отдельная ветвь **TypeSpec → сервер**, параллельная обязательной ветви OpenAPI → SDK. [Устройство результата](https://typespec.io/docs/emitters/servers/http-server-js/project/), [опции emitter](https://typespec.io/docs/emitters/servers/http-server-js/reference/emitter/).

Авторы называют пакет **highly experimental**, предупреждают о возможных ошибках и несовместимых изменениях. Описание HTTP-функций говорит о разборе данных и возможной валидации; оно не доказывает поддержку каждого ограничения нашего контракта. До выбора этого пути нужны проверка ошибок/статусов, дат, ограничений полей и повторной генерации. Экспериментален именно emitter, это не оценка Express. [Предупреждение и generated project](https://typespec.io/docs/emitters/servers/http-server-js/project/).

Альтернатива: TypeSpec → OpenAPI → `express-openapi-validator` для проверок и необязательного сопоставления endpoint с обработчиком; типы получать отдельно. Документация заявляет OpenAPI 3.0/3.1 и Express 4/5, проверку запросов и JSON-ответов. Это runtime-интеграция, а не готовая бизнес-реализация. [Документация проекта](https://cdimascio.github.io/express-openapi-validator/).

OpenAPI Generator `nodejs-express-server` тоже существует, но генерирует **JavaScript**, имеет метаданные BETA и предупреждение alpha/breaking changes в описании. Нельзя представлять его как готовый устойчивый TS-генератор Express. [Карточка](https://openapi-generator.tech/docs/generators/nodejs-express-server/).

### NestJS

OpenAPI Generator предоставляет **`typescript-nestjs-server`**, SERVER/BETA, с параметром `nestVersion`, по умолчанию 10.0.0. Это не `typescript-nestjs`: последнее имя относится к **клиентскому** генератору. Наличие серверного шаблона не гарантирует совместимость его результата с текущим CLI Nest — версии надо согласовать. [Сервер](https://openapi-generator.tech/docs/generators/typescript-nestjs-server/), [клиент](https://openapi-generator.tech/docs/generators/typescript-nestjs/).

В просмотренных исходных шаблонах серверный generator создаёт контроллеры, делегирующие операции абстрактному сервису, а обычные модели — TS-интерфейсы. Поэтому **нельзя обещать полную runtime-валидацию DTO автоматически**: потребуется отдельно спроектировать проверку по контракту, а не просто включить `ValidationPipe` для интерфейсов. Это вывод из шаблонов, не из запуска сгенерированного проекта. [controller](https://github.com/OpenAPITools/openapi-generator/blob/master/modules/openapi-generator/src/main/resources/typescript-nestjs-server/controller.mustache), [api](https://github.com/OpenAPITools/openapi-generator/blob/master/modules/openapi-generator/src/main/resources/typescript-nestjs-server/api.mustache), [modelGeneric](https://github.com/OpenAPITools/openapi-generator/blob/master/modules/openapi-generator/src/main/resources/typescript-nestjs-server/modelGeneric.mustache).

**Вывод:** Nest предлагает больше готовых архитектурных соглашений, но не устраняет сложность contract-first. Для нескольких сущностей это не окупается автоматически. Существующий опыт Nest может перевесить этот аргумент.

Дополнительный **Beta-плагин `nestjs` в Hey API для NestJS v11** генерирует типизированные сигнатуры методов контроллеров. В официальном примере HTTP-декораторы и реализации написаны пользователем: эту возможность нельзя приравнивать к генерации всего сервера или runtime-валидаторов. [Документация владельца плагина](https://heyapi.dev/docs/openapi/typescript/plugins/nest).

### Elysia

Elysia связывает схемы TypeBox с типизацией и runtime-проверкой; также поддерживает Standard Schema, включая Zod. Node официально поддерживается через `@elysia/node`, поэтому исключать Elysia как «только Bun» было бы ошибкой. [Валидация](https://elysiajs.com/essential/validation), [Node](https://elysiajs.com/integrations/node).

Официальный OpenAPI plugin строит спецификацию по Elysia-приложению. Для задания направление нужно сохранить обратным: начать с TypeSpec. Возможный путь — сгенерировать Zod/другие подходящие схемы из OpenAPI и подключить их к маршрутам Elysia. Это **предлагаемая интеграция**, здесь не выполненная. Готовый генератор всего Elysia-сервера в проверенных источниках не подтверждён; из этого нельзя заключать, что его нет вообще. [OpenAPI plugin](https://elysiajs.com/plugins/openapi), [Standard Schema](https://elysiajs.com/essential/validation).

**Оценка:** заслуживает места в расширенном списке благодаря типизированным схемам. По доказанности именно нашей цепочки пока уступает проверенному Hono-пути, но это разница объёма проверок, а не доказанное техническое ограничение Elysia.

### hapi и Koa

hapi поставляет TS-декларации и поддерживает проверки данных на уровне маршрутов. Koa предоставляет минимальное middleware-ядро без комплекта встроенных middleware. [hapi package](https://github.com/hapijs/hapi/blob/master/package.json), [hapi validation](https://hapi.dev/tutorials/en_us/validation), [Koa](https://koajs.com/).

Для обоих есть примеры у владельца **OpenAPI Backend**: библиотека читает OpenAPI, сопоставляет операции с обработчиками и проверяет запросы; результат/ошибку нужно правильно передать через API выбранного фреймворка. Это runtime-адаптер, а не генерация предметных TS-типов. Примеры и способы обработки validation failures: [OpenAPI Backend](https://github.com/openapistack/openapi-backend).

**Оценка:** это рабочие направления, их нельзя отбрасывать по причине «нет OpenAPI». Для проекта преимущества относительно Hono/Fastify не установлены; при существующем опыте с одним из них стоимость освоения может решить выбор. Интеграции здесь не запускались.

### AdonisJS, H3 и LoopBack 4

**AdonisJS** — TypeScript-фреймворк с готовым API starter. Текущий initializer предлагает API и API-monorepo; процесс создания включает конфигурацию и миграции. Для отдельного небольшого бекенда не следует автоматически брать весь monorepo. Из проверенного getting started не следует поддержка импорта внешнего OpenAPI; такую интеграцию надо выбирать отдельно. Оценка: полезен за общие соглашения приложения, но их ценность для нынешнего объёма нужно обосновать. [Введение](https://docs.adonisjs.com/introduction), [установка](https://docs.adonisjs.com/installation).

**H3** — ещё один небольшой сервер на Web API с модульными утилитами. Его validation utilities принимают Standard Schema; готовую привязку полного TypeSpec/OpenAPI-контракта здесь не проверяли. Оценка: полноценный кандидат для ручной композиции небольшого сервера, но отдельного преимущества по требованиям сейчас не выявлено. [H3 v2 getting started](https://h3.dev/guide), [validation](https://h3.dev/examples/validate-data).

**LoopBack 4** имеет более прямой инструмент: после создания приложения `lb4 openapi` генерирует серверные контроллеры, модели и типы. Документация явно указывает Swagger 2.0 и OpenAPI 3.0.x; поддержку 3.1/3.2 нельзя предполагать. Оценка: при желании генерировать контроллеры средствами самого фреймворка его стоит предпочесть дополнительной самодельной интеграции. Цена — принятие структуры LoopBack; генерация не доказывает корректность бизнес-логики и безопасную повторную генерацию изменённых файлов. Здесь generator не запускался. [OpenAPI generator](https://loopback.io/doc/en/lb4/OpenAPI-generator.html).

## Конкурентное бронирование

Выбор HTTP-фреймворка не заменяет атомарное правило «проверить пересечения и записать». Для полуоткрытых интервалов `[start, end)` условие пересечения: `newStart < existingEnd && existingStart < newEnd`. Это вывод из [требований](../project-steps/01-project-description.md).

Предлагаемая граница — операция хранилища `tryBook`, объединяющая проверку и запись. В одном Node.js event loop это может быть синхронный участок без `await`; при асинхронной работе нужна сериализация. Это проектное предложение для одного процесса, а не автоматическая гарантия Node. Несколько независимых in-memory экземпляров не обеспечат единый календарь. [Event loop](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick).

## Каркас и воспроизводимость

Выбранный каркас нужно создавать по текущему официальному getting started. Для двух основных кандидатов отправные точки — [Hono Node template](https://hono.dev/docs/getting-started/nodejs) и [Fastify TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/). Для Elysia есть [Node guide](https://elysiajs.com/integrations/node); для Express — [TS hello world](https://expressjs.com/en/starter/hello-world/). Для NestJS, AdonisJS и LoopBack следует использовать их CLI, согласовав версии: [Nest](https://docs.nestjs.com/first-steps), [Adonis](https://docs.adonisjs.com/installation), [LoopBack](https://loopback.io/doc/en/lb4/Command-line-interface.html).

Рекомендуется фиксировать runtime, пакетный менеджер, TypeSpec compiler/emitter, генераторы, валидаторы и lockfile. TypeSpec рекомендует lockfile и `npm ci`. Не подставлять `latest` в сохранённый воспроизводимый процесс; точные версии испытанных пакетов приведены ниже. [TypeSpec reproducibility](https://typespec.io/docs/handbook/reproducibility/).

Docker проверяется отдельно после выбора: ни один успешный тест через `app.request`/`inject` не доказывает сборку образа или доступность порта в контейнере. Задачи линтера, CI, mise/hk и фронтенда не добавляются в каркас автоматически только из-за этого исследования.

## Принятое решение и следующие проверки

Пользователь выбрал **Hono + Orval**, **Node.js + pnpm**, самостоятельный пакет в `backend/` и цепочку **TypeSpec → OpenAPI → Orval → Hono** на `GET /health`, возвращающем `200 {"status":"ok"}`. Согласованный результат задачи 1: команды генерации, разработки, сборки и запуска, инструкция и проверка реальным HTTP-запросом. Фронтенд, тестовый runner, линтеры, CI и Docker относятся к следующим задачам.

Перед расширением контракта остаётся проверить даты, path/query, nullable, `$ref`, успешные и ошибочные ответы, а также изменение схемы при повторной генерации. Правила времени, хранения и конкурентного бронирования фиксируются в последующей спецификации.

## Проверено и не проверено

Внешние факты проверены по документации владельцев фреймворков, генераторов и исходным шаблонам. Оценки сложности — инженерные выводы, не измерения. Страницы `latest`/ветки `master` не являются зафиксированным набором совместимых пакетов.

### Выполненная проверка обязательной цепочки

В рамках этого исследования в отдельном временном каталоге `/tmp/backend-selection-research.GHWkcA` выполнена **TypeSpec → OpenAPI 3.0.0 → Hey API SDK → проверка TypeScript**. Это непосредственное локальное наблюдение, а не вывод из документации. Каталог временный; воспроизводимые входные данные и версии приведены ниже.

| Компонент | Успешно проверенная версия |
| --- | --- |
| Node.js | 24.12.0, запуск через явно выбранный executable |
| `@typespec/compiler`, `@typespec/http`, `@typespec/openapi3` | 1.17.0 каждый |
| `@hey-api/openapi-ts` | 0.99.0 |
| `typescript` | 6.0.3 |
| `@types/node` | 24.19.2 |

Временный `main.tsp`:

```typespec
import "@typespec/http";
import "@typespec/openapi3";
using TypeSpec.Http;

@service(#{ title: "Backend selection smoke test" })
@server("http://localhost:3000", "Local")
namespace Booking;

model Health {
  status: "ok";
}

@route("/health")
@get
op health(): Health;
```

Временный `tspconfig.yaml`:

```yaml
emit:
  - "@typespec/openapi3"
options:
  "@typespec/openapi3":
    openapi-versions:
      - "3.0.0"
```

После установки перечисленных пакетов с точными версиями и отключёнными install scripts следующие локальные команды завершились с кодом 0:

```bash
./node_modules/.bin/tsp compile .
./node_modules/.bin/openapi-ts -i tsp-output/@typespec/openapi3/openapi.yaml -o sdk
./node_modules/.bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM sdk/index.ts
```

Сгенерирован SDK с вызываемой функцией `health`, использующей `client.get`, а не только файл типов. HTTP-вызов этой функции и реальный сервер не проверялись. Эксперимент подтверждает существование работоспособного минимального пути для TS SDK, но не покрытие контракта бронирования.

**Обнаруженная несовместимость:** первоначальная установка разрешила `typescript@7.0.2`; с ней `@hey-api/openapi-ts@0.99.0` завершался ошибкой при обращении к `ts.SyntaxKind.AnyKeyword`. После фиксации TS 6.0.3 генерация и проверка типов прошли. Для отделения влияния Node проверка с TS 6.0.3 также повторена успешно под Node 26.5.0, использованным при первом сбое. Это основание фиксировать проверенную пару версий, а не объявлять всю экосистему несовместимой с TS 7. Источник результата — выполненный локальный эксперимент; upstream-исправление или issue в этом исследовании не проверялись.


### Сопоставимая проверка Hono и Fastify на одном контракте

Временный каталог: `/tmp/backend-hono-research.Icw14P`. Источник доказательств в этом разделе — локально выполненный эксперимент, а не обещания документации. Для генерации OpenAPI использованы TypeSpec compiler/http/openapi3 **1.17.0** и OpenAPI **3.0.0**, как в предыдущей проверке. Runtime явно выбран **Node.js 24.12.0**.

| Пакет | Версия |
| --- | --- |
| `hono` | 4.13.16 |
| `orval` | 8.46.0 |
| `@hono/zod-validator` | 0.9.1 |
| `zod` | 4.6.7 |
| `fastify` | 5.12.7 |
| `fastify-openapi-glue` | 4.12.0 |
| `typescript` | 6.0.3 |
| `@types/node` | 24.19.2 |

`@hono/node-server` 2.1.5 установлен, но сетевой адаптер в этой проверке не запускался. Проверки выполнялись через Hono `app.request` и Fastify `inject`, без TCP-порта. Зависимости устанавливались с точными версиями и `--ignore-scripts`.

Входной TypeSpec; это испытательный контракт, не проектирование API бронирования:

```typespec
import "@typespec/http";
import "@typespec/openapi3";
using TypeSpec.Http;

@service(#{ title: "Hono contract probe" })
@server("http://localhost:3000", "Local")
namespace HonoProbe;

model Health { status: "ok"; }
model EventInput {
  @minLength(1) name: string;
  @minValue(1) @maxValue(120) duration: int32;
}

@route("/health") @get op health(): Health;
@route("/events") @post op createEvent(@body input: EventInput): EventInput;
```

С конфигурацией emitter из предыдущего подраздела выполнена компиляция `tsp compile hono.tsp --output-dir hono-output`; результат `hono-output/@typespec/openapi3/openapi.yaml` скопирован в `openapi.yaml` каталога испытания. Конфигурация `orval.config.ts`:

```typescript
import { defineConfig } from 'orval';
export default defineConfig({
  probe: {
    input: { target: './openapi.yaml' },
    output: {
      mode: 'split',
      client: 'hono',
      target: 'src/api.ts',
      override: { hono: { handlers: 'src/handlers' } },
    },
  },
});
```

После `orval --config orval.config.ts` появились маршруты `/health` и `/events`, типы контекстов, TypeScript-модели, Zod-схемы и middleware. В тела созданных обработчиков добавлено только:

- `health`: `return c.json({ status: 'ok' });`
- `createEvent`: `return c.json(c.req.valid('json'));`

Сгенерированный validator импортирует `@hono/zod-validator`; этот пакет пришлось установить отдельно. После установки TypeScript-проверка и компиляция прошли без `skipLibCheck`. Для запуска испытания использовался CommonJS-вывод, а в `dist/package.json` задано `{"type":"commonjs"}`:

```bash
./node_modules/.bin/tsc --strict --target ES2022 --module CommonJS --moduleResolution Node --ignoreDeprecations 6.0 --esModuleInterop --lib ES2022,DOM --outDir dist src/api.ts
```

CommonJS здесь только способ запустить временную проверку; это не выбранная конфигурация будущего приложения. Повторный запуск Orval **с тем же неизменённым контрактом** сохранил оба изменённых файла обработчиков побайтно. Смена схемы, переименование/удаление операции и стратегия миграции пользовательского кода не проверялись.

Fastify использовал тот же `openapi.yaml` через glue. Его обработчики написаны вручную; для этой проверки использованы TypeScript-модели, уже сгенерированные Orval. Это не проверка собственного генератора TS-типов Fastify:

```typescript
import Fastify, { type FastifyRequest } from 'fastify';
import openapiGlue from 'fastify-openapi-glue';
import type { EventInput, Health } from './src/api.schemas.ts';
export async function buildFastifyProbe() {
  const app = Fastify();
  await app.register(openapiGlue, {
    specification: './openapi.yaml',
    serviceHandlers: {
      health: async (): Promise<Health> => ({ status: 'ok' }),
      createEvent: async (request: FastifyRequest<{Body: EventInput}>): Promise<EventInput> => request.body,
    },
  });
  return app;
}
```

Этот модуль прошёл `tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions --esModuleInterop --lib ES2022,DOM fastify-probe.ts`; затем выполнен под Node 24.12.0. Проверка не гарантирует статическое соответствие всех `operationId` методам: свойство `serviceHandlers` у glue типизировано как объект.

| Запрос | Hono + Orval | Fastify + glue |
| --- | --- | --- |
| `GET /health` | 200, `{"status":"ok"}` | 200, то же тело |
| POST `/events`, `{"name":"Call","duration":30}` | 200, входное тело возвращено | 200, то же тело |
| Отсутствует `name` | 400 | 400 |
| Пустое имя | 400 | 400 |
| `duration: 0` | 400 | 400 |
| `duration: 121` | 400 | 400 |
| `duration: 1.5` | 400 | 400 |
| `duration: "30"` (дополнительная проба) | 400 | 200, число `30` после преобразования |
| Дополнительное поле `extra: true` | 200, в ответе поля нет | 200, в ответе поля нет |

Семь основных проверок прошли в обоих вариантах. Дополнительная проба показала разницу **настроек валидации по умолчанию**: Fastify/Ajv привёл строку к числу, а сгенерированная Zod-схема Hono её отвергла. Это не неизменное свойство фреймворков и не автоматическое преимущество одного: политику преобразования следует явно выбрать и проверить. Из отсутствия `extra` в ответе нельзя делать вывод о месте его удаления внутри обработки запроса.

Тестовый TypeSpec не описывал тело 400-ошибки. Проверка подтвердила отклонение запросов, но **не** полное совпадение error response с контрактом. Сложные даты, `nullable`, объединения, корректность конкурентных бронирований и runtime-отклонение неверного ответа здесь не испытывались.

### Границы доказательств

Практически проверены общий клиентский SDK и маленькие серверные пути **Hono/Orval** и **Fastify/glue**. Для остальных восьми вариантов выводы основаны на первичной документации; их окружения не устанавливались и генераторы не запускались. Нет сравнительных нагрузочных тестов или проверки Docker. Оба испытанных пути дают основание оставить Hono и Fastify основными кандидатами; эксперимент не устанавливает универсального победителя.

На момент экспериментов приложение ещё не создавалось. После исследования пользователь утвердил Hono + Orval и Node.js + pnpm; рабочий каркас и команды описаны в [README бекенда](../../backend/README.md).
