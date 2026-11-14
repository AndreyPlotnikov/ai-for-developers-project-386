import { useEffect, useRef, useState, type FormEvent } from "react";
import { meetingTypesCreateMeetingType, type MeetingType } from "./generated/api";
import { MeetingTypesCreateMeetingTypeBody } from "./generated/validation";
import { meetingTypePath } from "./MeetingTypes";

const fields = ["name", "description", "durationMinutes"] as const;
type Field = (typeof fields)[number];
type Values = Record<Field, string>;
type Errors = Partial<Values>;

const initialValues: Values = { name: "", description: "", durationMinutes: "" };
function fieldMessage(field: Field) {
  return MeetingTypesCreateMeetingTypeBody.shape[field].description ?? "Неверное значение";
}

function validate(values: Values) {
  return MeetingTypesCreateMeetingTypeBody.safeParse({
    name: values.name.trim(),
    description: values.description || undefined,
    durationMinutes: /^\d+$/.test(values.durationMinutes.trim())
      ? Number(values.durationMinutes)
      : NaN,
  });
}

export function NewMeetingType() {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Errors>({});
  const [focus, setFocus] = useState<{ field: Field }>();
  const [status, setStatus] = useState<"editing" | "saving" | "failed" | "unknown">("editing");
  const [saveError, setSaveError] = useState("");
  const [created, setCreated] = useState<MeetingType>();
  const successHeading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focus) form.current?.querySelector<HTMLElement>(`#${focus.field}`)?.focus();
  }, [focus]);

  useEffect(() => {
    if (status === "failed" || saveError) submitButton.current?.focus();
  }, [status, saveError]);

  useEffect(() => {
    if (created) successHeading.current?.focus();
  }, [created]);

  function validateField(field: Field, nextValues: Values) {
    const result = validate(nextValues);
    const invalid = !result.success && result.error.issues.some((issue) => issue.path[0] === field);
    setErrors((current) => ({ ...current, [field]: invalid ? fieldMessage(field) : undefined }));
  }

  function showErrors(nextErrors: Errors) {
    setErrors(nextErrors);
    const field = fields.find((key) => nextErrors[key]);
    if (field) setFocus({ field });
  }

  function inputProps(field: Field) {
    return {
      id: field,
      name: field,
      value: values[field],
      onBlur: () => validateField(field, values),
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const next = { ...values, [field]: event.target.value };
        setValues(next);
        if (errors[field]) validateField(field, next);
      },
      "aria-invalid": !!errors[field],
      "aria-describedby": errors[field] ? `${field}-error` : undefined,
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "saving" || status === "unknown") return;

    const result = validate(values);
    if (!result.success) {
      showErrors(
        Object.fromEntries(
          fields
            .filter((field) => result.error.issues.some((issue) => issue.path[0] === field))
            .map((field) => [field, fieldMessage(field)]),
        ),
      );
      return;
    }

    setErrors({});
    setSaveError("");
    setStatus("saving");
    try {
      const response = await meetingTypesCreateMeetingType(result.data);
      if (response.status === 201) {
        setCreated(response.data);
      } else if (response.status === 400 && response.data.fieldErrors) {
        showErrors(response.data.fieldErrors);
        if (response.data.message) setSaveError(response.data.message);
        setStatus("editing");
      } else if (response.status === 503 && response.data.code === "not_saved") {
        setStatus("failed");
      } else {
        setStatus("unknown");
      }
    } catch {
      setStatus("unknown");
    }
  }

  function fieldError(field: Field) {
    return (
      <p className="field-error" id={`${field}-error`} role="status">
        {errors[field]}
      </p>
    );
  }

  return (
    <section className="meeting-page">
      <a href="/admin/meeting-types">К списку типов встреч</a>
      <div className="meeting-panel">
        {created ? (
          <>
            <h1 ref={successHeading} tabIndex={-1}>
              Тип встречи создан
            </h1>
            <p>{created.name}</p>
            <label htmlFor="meeting-link">Прямая ссылка</label>
            <input
              id="meeting-link"
              readOnly
              value={new URL(meetingTypePath(created.id), window.location.origin).href}
            />
            <p>
              <a href={meetingTypePath(created.id)}>Открыть страницу типа встречи</a>
            </p>
          </>
        ) : (
          <>
            <h1>Создать тип встречи</h1>
            <form ref={form} onSubmit={submit} noValidate>
              <fieldset disabled={status === "saving" || status === "unknown"}>
                <label htmlFor="name">Название</label>
                <input {...inputProps("name")} required />
                {fieldError("name")}
                <label htmlFor="description">Описание (необязательно)</label>
                <textarea {...inputProps("description")} rows={4} />
                {fieldError("description")}
                <label htmlFor="durationMinutes">Длительность (минуты)</label>
                <input {...inputProps("durationMinutes")} inputMode="numeric" required />
                {fieldError("durationMinutes")}
                <button ref={submitButton} className="primary-button" type="submit">
                  {status === "failed" ? "Повторить сохранение" : "Создать"}
                </button>
              </fieldset>
              {saveError && <p role="alert">{saveError}</p>}
              {status === "saving" && <p role="status">Сохранение…</p>}
              {status === "failed" && (
                <p role="alert">Не удалось сохранить тип встречи. Повторите сохранение.</p>
              )}
              {status === "unknown" && (
                <p role="alert">
                  Результат сохранения неизвестен. Проверьте{" "}
                  <a href="/admin/meeting-types">список типов встреч</a>.
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </section>
  );
}
