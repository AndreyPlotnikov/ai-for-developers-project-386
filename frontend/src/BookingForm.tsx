import { useEffect, useRef, useState, type FormEvent } from "react";
import { claimBookingAttempt, clearBookingAttempt, type BookingAttempt } from "./booking-attempt";
import { formatMeetingTime } from "./calendar-time";
import {
  meetingTypesCheckBookingAttempt,
  meetingTypesCreateBooking,
  type BookingInput,
  type Meeting,
} from "./generated/api";
import { MeetingTypesCreateBookingBody } from "./generated/validation";

const fields = ["guestName", "guestEmail"] as const;
type Field = (typeof fields)[number];
type Values = Pick<BookingInput, Field>;
type Errors = Partial<Record<Field | "startsAt", string>>;

export function BookingForm({
  meetingTypeId,
  initialAttempt,
  startsAt,
  ready,
  onConflict,
  onConfirmed,
  onLock,
  focusSlots,
}: {
  meetingTypeId: string;
  initialAttempt?: BookingAttempt;
  startsAt?: string;
  ready: boolean;
  onConflict: () => void;
  onConfirmed: () => void;
  onLock: (locked: boolean) => void;
  focusSlots: () => void;
}) {
  const [values, setValues] = useState<Values>(
    initialAttempt?.values ?? { guestName: "", guestEmail: "" },
  );
  const [errors, setErrors] = useState<Errors>({});
  const [focus, setFocus] = useState<{ field: Field }>();
  const [status, setStatus] = useState<"editing" | "saving" | "failed" | "unknown" | "checking">(
    initialAttempt ? "unknown" : "editing",
  );
  const [notice, setNotice] = useState("");
  const [meeting, setMeeting] = useState<Meeting>();
  const attempt = useRef(initialAttempt);
  const preparing = useRef(false);
  const checking = useRef(false);
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

  async function finishAttempt() {
    if (attempt.current) await clearBookingAttempt(attempt.current.id);
    attempt.current = undefined;
    onLock(false);
  }

  async function confirm(savedMeeting: Meeting) {
    await finishAttempt();
    setMeeting(savedMeeting);
    onConfirmed();
  }

  function chooseAnotherSlot(message: string) {
    onConflict();
    focusSlots();
    setNotice(message);
    setStatus("editing");
  }

  async function save(current: BookingAttempt, input: BookingInput) {
    attempt.current = current;
    try {
      const response = await meetingTypesCreateBooking(current.meetingTypeId, input, {
        headers: { "Idempotency-Key": current.id },
      });
      if (response.status === 201) {
        await confirm(response.data);
        return;
      }
      if (response.status === 400) {
        showErrors(response.data.fieldErrors ?? {});
        setNotice(response.data.message ?? "");
        setStatus("editing");
      } else if (response.status === 409) {
        chooseAnotherSlot(response.data.message);
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
      await finishAttempt();
    } catch {
      setStatus("unknown");
    }
  }

  async function checkAttempt() {
    const current = attempt.current;
    if (!current || checking.current) return;
    checking.current = true;
    setStatus("checking");
    try {
      const response = await meetingTypesCheckBookingAttempt(current.id);
      if (response.status === 200 && response.data.status === "saved") {
        await confirm(response.data.meeting);
      } else if (response.status === 200 && response.data.status === "not_saved") {
        await finishAttempt();
        chooseAnotherSlot("Встреча не сохранена. Выберите время и подтвердите запись.");
      } else {
        setStatus("unknown");
      }
    } catch {
      setStatus("unknown");
    } finally {
      checking.current = false;
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (attempt.current || preparing.current || !ready) return;
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
    preparing.current = true;
    onLock(true);
    setStatus("saving");
    setNotice("");
    try {
      const current = {
        id: window.crypto.randomUUID(),
        meetingTypeId,
        startsAt: result.data.startsAt,
        values,
      };
      if (!(await claimBookingAttempt(current))) {
        window.location.reload();
        return;
      }
      void save(current, result.data);
    } catch {
      onLock(false);
      setNotice("Не удалось подготовить сохранение. Повторите попытку.");
      setStatus("failed");
    } finally {
      preparing.current = false;
    }
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
        <fieldset disabled={status === "saving" || status === "unknown" || status === "checking"}>
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
          {status === "checking" && "Проверяем результат…"}
        </p>
        <p className="calendar-status" role="alert">
          {status === "unknown" ? "Результат сохранения неизвестен." : notice}
        </p>
        {(status === "unknown" || status === "checking") && (
          <button
            ref={retryButton}
            className="primary-button"
            type="button"
            disabled={status === "checking"}
            onClick={checkAttempt}
          >
            Проверить результат
          </button>
        )}
      </form>
    </section>
  );
}
