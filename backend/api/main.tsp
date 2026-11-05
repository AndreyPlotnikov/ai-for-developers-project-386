import "@typespec/http";
import "@typespec/openapi3";

using TypeSpec.Http;

/** API для проверки состояния приложения Call Calendar. */
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
