import "@typespec/http";
import "@typespec/openapi3";

using TypeSpec.Http;

/** API приложения Call Calendar. */
@service(#{ title: "Call Calendar API" })
@server("/", "Текущий сервер приложения")
namespace CallCalendar;

/** Состояние приложения. */
@example(#{ status: "ok" })
model Health {
  /** Состояние доступного приложения. */
  @example("ok")
  status: "ok";
}

/** Проверка доступности HTTP-сервера. */
@tag("Health")
@opExample(#{ returnType: #{ status: "ok" } })
@route("/health")
@get
op health(): Health;

/** Ввод для создания типа встречи. */
model MeetingTypeInput {
  /** Введите название длиной от 1 до 100 символов без учёта пробелов по краям. */
  @minLength(1)
  @maxLength(100)
  @example("Консультация")
  name: string;

  /** Введите описание обычным текстом длиной до 1000 символов. */
  @maxLength(1000)
  @example("Обсудим вопросы по проекту.")
  description?: string;

  /** Введите длительность в минутах целым числом от 5 до 480. */
  @minValue(5)
  @maxValue(480)
  @example(30)
  durationMinutes: int32;
}

/** Данные типа встречи. */
model MeetingType {
  /** Уникальный идентификатор для прямой ссылки. */
  @example("451f0834-690a-4312-8efb-ec573c057493")
  id: string;

  ...MeetingTypeInput;
}

/** Каталог типов встреч. */
model MeetingTypeCatalog {
  /** Доступные типы встреч. */
  @example(#[#{ id: "451f0834-690a-4312-8efb-ec573c057493", name: "Консультация", durationMinutes: 30 }])
  meetingTypes: MeetingType[];
}

/** Ошибки полей формы создания. */
model MeetingTypeValidationError {
  /** Ошибки по имени поля. */
  @example(#{ name: "Введите название длиной от 1 до 100 символов" })
  fieldErrors: Record<string>;

  /** Общая ошибка запроса без привязки к полю. */
  @example("Некорректное тело запроса")
  message?: string;
}

/** Тип встречи отсутствует. */
model MeetingTypeNotFound {
  /** Сообщение для гостя. */
  @example("Тип встречи не найден")
  message: string;
}

/** Сохранение типа завершилось сбоем. */
model MeetingTypeSaveError {
  /** Сервер подтвердил, что тип не был сохранён. */
  @example("not_saved")
  code: "not_saved";

  /** Сообщение для владельца. */
  @example("Не удалось сохранить тип встречи")
  message: string;
}

/** Доступное время для встречи. */
model AvailabilitySlot {
  /** Момент начала встречи. */
  @example(utcDateTime.fromISO("2026-02-02T06:15:00Z"))
  startsAt: utcDateTime;

  /** Момент окончания встречи. */
  @example(utcDateTime.fromISO("2026-02-02T06:45:00Z"))
  endsAt: utcDateTime;
}

/** Слоты на календарную дату владельца. */
model AvailabilityDay {
  /** Дата в часовом поясе владельца. */
  @example(plainDate.fromISO("2026-02-02"))
  date: plainDate;

  /** Свободные слоты в порядке начала. */
  @example(#[])
  slots: AvailabilitySlot[];
}

/** Доступность типа встречи на ближайшие 14 календарных дат. */
model MeetingTypeAvailability {
  /** Именованный часовой пояс владельца. */
  @example("Europe/Moscow")
  timeZone: string;

  /** Календарные даты, включая даты без доступного времени. */
  @minItems(14)
  @maxItems(14)
  days: AvailabilityDay[];
}

/** Уникальный идентификатор одной попытки создания. */
@format("uuid")
@example("88f6cbf1-5158-4b80-9476-777326aec804")
scalar MeetingTypeAttemptId extends string;

/** Исход попытки пока неизвестен. */
model MeetingTypeAttemptUnknown {
  /** Результат нельзя подтвердить сейчас. */
  @example("unknown")
  code: "unknown";

  /** Сообщение для владельца. */
  @example("Результат сохранения неизвестен")
  message: string;
}

/** Результат проверки одной попытки создания. */
union MeetingTypeAttemptResult {
  saved: MeetingTypeAttemptSaved,
  absent: MeetingTypeAttemptAbsent,
}

/** Тип встречи, сохранённый этой попыткой. */
model MeetingTypeAttemptSaved {
  /** Попытка создала тип встречи. */
  @example("saved")
  status: "saved";

  /** Уже сохранённый тип встречи. */
  meetingType: MeetingType;
}

/** Попытка завершена без создания типа встречи. */
model MeetingTypeAttemptAbsent {
  /** Тип не был сохранён. Повторная отправка требует нового идентификатора. */
  @example("not_saved")
  status: "not_saved";
}

@tag("Meeting types")
@route("/api/meeting-types")
interface MeetingTypes {
  /** Получить каталог типов встреч. */
  @opExample(#{ returnType: #{ meetingTypes: #[] } })
  @get
  listMeetingTypes(): MeetingTypeCatalog;

  /** Сохранить новый тип встречи и вернуть данные для прямой ссылки. */
  @opExample(#{
    parameters: #{ input: #{ name: "Консультация", durationMinutes: 30 } },
    returnType: #{
      statusCode: 201,
      meetingType: #{ id: "451f0834-690a-4312-8efb-ec573c057493", name: "Консультация", durationMinutes: 30 },
    },
  })
  @opExample(#{
    returnType: #{
      statusCode: 400,
      error: #{ fieldErrors: #{ durationMinutes: "Введите целое число от 5 до 480" } },
    },
  })
  @opExample(#{
    returnType: #{
      statusCode: 409,
      error: #{ code: "not_saved", message: "Попытка завершена без сохранения типа встречи" },
    },
  })
  @opExample(#{
    returnType: #{
      statusCode: 503,
      error: #{ code: "unknown", message: "Результат сохранения неизвестен" },
    },
  })
  @post
  createMeetingType(
    /** Поля формы создания типа встречи. */
    @body input: MeetingTypeInput,

    /** Ключ попытки. Повтор с тем же ключом возвращает результат этой попытки. */
    @header("Idempotency-Key") attemptId?: MeetingTypeAttemptId,
  ):
    | { @statusCode statusCode: 201; @body meetingType: MeetingType; }
    | { @statusCode statusCode: 400; @body error: MeetingTypeValidationError; }
    | { @statusCode statusCode: 409; @body error: MeetingTypeSaveError; }
    | { @statusCode statusCode: 503; @body error: MeetingTypeSaveError | MeetingTypeAttemptUnknown; };

  /** Проверить исход попытки. Если тип не сохранён, проверка окончательно закрывает эту попытку. */
  @opExample(#{ returnType: #{ status: "not_saved" } })
  @post
  @route("/attempts/{attemptId}/check")
  checkMeetingTypeAttempt(
    /** Ключ из исходного запроса на создание. */
    @path attemptId: MeetingTypeAttemptId,
  ):
    | MeetingTypeAttemptResult
    | { @statusCode statusCode: 400; @body error: MeetingTypeValidationError; }
    | { @statusCode statusCode: 503; @body error: MeetingTypeAttemptUnknown; };

  /** Получить тип встречи по идентификатору. */
  @get
  @route("/{id}")
  getMeetingType(
    /** Идентификатор из прямой ссылки на тип встречи. */
    @path id: string,
  ):
    | MeetingType
    | { @statusCode statusCode: 404; @body error: MeetingTypeNotFound; };

  /** Получить ближайшие даты и доступные слоты типа встречи. */
  @get
  @route("/{id}/availability")
  getAvailability(
    /** Идентификатор типа встречи. */
    @path id: string,
  ):
    | MeetingTypeAvailability
    | { @statusCode statusCode: 404; @body error: MeetingTypeNotFound; };
}
