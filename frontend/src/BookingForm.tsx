import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatMeetingTime } from "./calendar-time";
import { meetingTypesCreateBooking, type BookingInput, type Meeting } from "./generated/api";
import { MeetingTypesCreateBookingBody } from "./generated/validation";

const fields = ["guestName", "guestEmail"] as const;
type Field = (typeof fields)[number];
type Values = Pick<BookingInput, Field>;
type Errors = Partial<Record<Field | "startsAt", string>>;
type Attempt = { id: string; input: BookingInput };

export function BookingForm({
  meetingTypeId,
  startsAt,
  ready,
  onConflict,
  onConfirmed,
  onLock,
  focusSlots,
}: {
  meetingTypeId: string;
  startsAt?: string;
  ready: boolean;
  onConflict: () => void;
  onConfirmed: () => void;
  onLock: (locked: boolean) => void;
  focusSlots: () => void;
}) {
  const [values, setValues] = useState<Values>({ guestName: "", guestEmail: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [focus, setFocus] = useState<{ field: Field }>();
  const [status, setStatus] = useState<"editing" | "saving" | "failed" | "unknown">("editing");
  const [notice, setNotice] = useState("");
  const [meeting, setMeeting] = useState<Meeting>();
  const attempt = useRef<Attempt>(undefined);
  const form = useRef<HTMLFormElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  const confirmation = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focus) form.current?.querySelector<HTMLElement>(`#${focus.field}`)?.focus();
  }, [focus]);

  useEffect(() => {
    if (status === "failed") submitButton.current?.focus();
    if (status === "unknown") retryButton.current?.focus();
  }, [status]);

  useEffect(() => {
    if (meeting) confirmation.current?.focus();
  }, [meeting]);

  function showErrors(nextErrors: Errors) {
    setErrors(nextErrors);
    const field = fields.find((field) => nextErrors[field]);
    if (field) setFocus({ field });
    else if (nextErrors.startsAt) focusSlots();
  }

  function validateField(field: Field, value: string) {
    const schema = MeetingTypesCreateBookingBody.shape[field];
    const error = schema.safeParse(value.trim()).success ? undefined : schema.description;
    setErrors((current) => ({ ...current, [field]: error }));
  }

  async function save(current: Attempt) {
    attempt.current = current;
    onLock(true);
    setStatus("saving");
    setNotice("");
    try {
      const response = await meetingTypesCreateBooking(meetingTypeId, current.input, {
        headers: { "Idempotency-Key": current.id },
      });
      if (response.status === 201) {
        setMeeting(response.data);
        onConfirmed();
        return;
      }
      if (response.status === 400) {
        showErrors(response.data.fieldErrors ?? {});
        setNotice(response.data.message ?? "");
        setStatus("editing");
      } else if (response.status === 409 && response.data.code === "slot_unavailable") {
        onConflict();
        focusSlots();
        setNotice(response.data.message);
        setStatus("editing");
      } else if (response.status === 503 && response.data.code === "not_saved") {
        setNotice(response.data.message);
        setStatus("failed");
      } else if (response.status === 404) {
        setNotice(response.data.message);
        setStatus("editing");
      } else {
        setStatus("unknown");
        return;
      }
      attempt.current = undefined;
      onLock(false);
    } catch {
      setStatus("unknown");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (attempt.current || !ready) return;
    const result = MeetingTypesCreateBookingBody.safeParse({
      startsAt,
      guestName: values.guestName.trim(),
      guestEmail: values.guestEmail.trim(),
    });
    if (!result.success) {
      showErrors(
        Object.fromEntries(
          [...fields, "startsAt" as const]
            .filter((field) => result.error.issues.some((issue) => issue.path[0] === field))
            .map((field) => [field, MeetingTypesCreateBookingBody.shape[field].description]),
        ),
      );
      return;
    }
    setErrors({});
    void save({ id: window.crypto.randomUUID(), input: result.data });
  }

  if (meeting) {
    return (
      <section className="meeting-panel" aria-labelledby="booking-confirmation">
        <div role="status">
          <h2 id="booking-confirmation" ref={confirmation} tabIndex={-1}>
            Запись подтверждена
          </h2>
          <p>{meeting.meetingTypeName}</p>
          <p>{formatMeetingTime(meeting.startsAt, meeting.endsAt, meeting.timeZone)}</p>
          <dl>
            <dt>Владелец календаря</dt>
            <dd>{meeting.ownerName}</dd>
            <dt>Имя гостя</dt>
            <dd>{meeting.guestName}</dd>
            <dt>Email гостя</dt>
            <dd>{meeting.guestEmail}</dd>
          </dl>
        </div>
      </section>
    );
  }

  return (
    <section className="meeting-panel" aria-labelledby="booking-form-title">
      <h2 id="booking-form-title">Запись на встречу</h2>
      <form ref={form} onSubmit={submit} noValidate>
        <fieldset disabled={status === "saving" || status === "unknown"}>
          {fields.map((field) => (
            <div key={field}>
              <label htmlFor={field}>{field === "guestName" ? "Имя" : "Email"}</label>
              <input
                id={field}
                name={field}
                autoComplete={field === "guestName" ? "name" : "email"}
                inputMode={field === "guestEmail" ? "email" : undefined}
                value={values[field]}
                required
                aria-invalid={!!errors[field]}
                aria-describedby={errors[field] ? `${field}-error` : undefined}
                onBlur={() => validateField(field, values[field])}
                onChange={(event) => {
                  const value = event.target.value;
                  setValues((current) => ({ ...current, [field]: value }));
                  if (errors[field]) validateField(field, value);
                }}
              />
              <p className="field-error" id={`${field}-error`} role="status">
                {errors[field]}
              </p>
            </div>
          ))}
          <p className="field-error" role="status">
            {!startsAt && errors.startsAt}
          </p>
          <button ref={submitButton} className="primary-button" type="submit" disabled={!ready}>
            {status === "failed" ? "Повторить сохранение" : "Подтвердить запись"}
          </button>
        </fieldset>
        <p className="calendar-status" role="status">
          {status === "saving" && "Сохранение…"}
        </p>
        <p className="calendar-status" role="alert">
          {status === "unknown" ? "Результат сохранения неизвестен." : notice}
        </p>
        {status === "unknown" && (
          <button
            ref={retryButton}
            className="primary-button"
            type="button"
            onClick={() => {
              if (attempt.current) void save(attempt.current);
            }}
          >
            Проверить результат
          </button>
        )}
      </form>
    </section>
  );
}
