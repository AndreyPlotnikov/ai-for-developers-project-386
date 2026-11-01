import "@typespec/http";
import "@typespec/openapi3";

using TypeSpec.Http;

@service(#{ title: "Call Calendar API" })
namespace CallCalendar;

model Health {
  status: "ok";
}

/** Проверка доступности HTTP-сервера. */
@route("/health")
@get
op health(): Health;
