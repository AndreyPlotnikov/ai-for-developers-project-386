import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext } from "@playwright/test";

test.use({ baseURL: process.env.E2E_BASE_URL });

const id = "sample-booking";
const pagePath = `/book/${id}`;
const typePath = `**/api/meeting-types/${id}`;
const startsAt = "2026-02-02T06:15:00Z";
const secondStart = "2026-02-02T07:00:00Z";
const slots = [
  { startsAt, endsAt: "2026-02-02T06:45:00Z" },
  { startsAt: secondStart, endsAt: "2026-02-02T07:30:00Z" },
];
const timeZone = "Europe/Moscow";
const confirmation = {
  id: "sample-meeting",
  meetingTypeId: id,
  meetingTypeName: "Знакомство",
  ownerName: "Андрей Плотников",
  guestName: "Алекс",
  guestEmail: "a@b.c",
  startsAt: secondStart,
  endsAt: slots[1].endsAt,
  timeZone,
};

test("announces validation and a slot conflict, preserves the form, and focuses confirmation", async ({
  page,
}) => {
  let conflicted = false;
  await page.route(typePath, (route) =>
    route.fulfill({ json: { id, name: "Знакомство", durationMinutes: 30 } }),
  );
  await page.route(`${typePath}/availability`, (route) =>
    route.fulfill({
      json: {
        timeZone,
        days: Array.from({ length: 14 }, (_, index) => ({
          date: `2026-02-${String(index + 2).padStart(2, "0")}`,
          slots: index === 0 ? (conflicted ? slots.slice(1) : slots) : [],
        })),
      },
    }),
  );
  await page.route(`${typePath}/bookings`, (route) => {
    if (!conflicted) {
      conflicted = true;
      expect(route.request().postDataJSON()).toEqual({
        startsAt,
        guestName: "Алекс",
        guestEmail: "a@b.c",
      });
      return route.fulfill({
        status: 409,
        json: {
          code: "slot_unavailable",
          message: "Выбранное время больше недоступно. Выберите другой слот.",
        },
      });
    }
    expect(route.request().postDataJSON()).toEqual({
      startsAt: secondStart,
      guestName: "Алекс",
      guestEmail: "a@b.c",
    });
    return route.fulfill({ status: 201, json: confirmation });
  });
  await page.goto(pagePath);
  const name = page.getByRole("textbox", { name: "Имя" });
  const email = page.getByRole("textbox", { name: "Email" });
  const send = page.getByRole("button", { name: "Подтвердить запись" });
  const firstSlot = page.getByRole("button", { name: "09:15" });
  await firstSlot.press("Enter");
  await expect(firstSlot).toHaveAttribute("aria-pressed", "true");

  await email.fill("a@@b.c");
  await email.press("Tab");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await send.press("Enter");
  await expect(name).toBeFocused();
  await expect(name).toHaveAccessibleDescription(/Введите имя/);
  await expect(email).toHaveAccessibleDescription(/Введите корректный email/);

  await name.fill(" Алекс ");
  await email.fill(" a@b.c ");
  await expect(email).toHaveAttribute("aria-invalid", "false");
  await send.press("Enter");
  await expect(page.getByRole("alert")).toContainText("Выбранное время больше недоступно.");
  await expect(firstSlot).toHaveCount(0);
  await expect(name).toHaveValue(" Алекс ");
  await expect(email).toHaveValue(" a@b.c ");

  const secondSlot = page.getByRole("button", { name: "10:00" });
  await secondSlot.press("Enter");
  await send.press("Enter");
  const heading = page.getByRole("heading", { name: "Запись подтверждена" });
  await expect(heading).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "Запись подтверждена" })).toBeVisible();
  await expect(page.getByText(/2 февраля 2026 г.*10:00.*10:30.*Europe\/Moscow/)).toBeVisible();
  await expect(page.getByText(confirmation.ownerName, { exact: true })).toBeVisible();
  await expect(page.getByText(confirmation.guestName, { exact: true })).toBeVisible();
  await expect(page.getByText(confirmation.guestEmail, { exact: true })).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("reopens the browser on another booking page and recovers the original confirmation", async ({
  browser,
}, testInfo) => {
  const profile = testInfo.outputPath("profile");
  const baseURL = process.env.E2E_BASE_URL;
  let key = "";
  const firstSession = await browser.browserType().launchPersistentContext(profile, { baseURL });
  try {
    await serveBookingCalendar(firstSession);
    await firstSession.route(`${typePath}/bookings`, (route) => {
      key = route.request().headers()["idempotency-key"];
      return route.abort();
    });
    const page = firstSession.pages()[0];
    await page.goto(pagePath);
    await page.getByRole("button", { name: "10:00" }).click();
    await page.getByRole("textbox", { name: "Имя" }).fill("Алекс");
    await page.getByRole("textbox", { name: "Email" }).fill("a@b.c");
    await page.getByRole("button", { name: "Подтвердить запись" }).click();
    await expect(page.getByRole("alert")).toHaveText("Результат сохранения неизвестен.");
  } finally {
    await firstSession.close();
  }

  const reopened = await browser.browserType().launchPersistentContext(profile, { baseURL });
  try {
    await serveBookingCalendar(reopened);
    await reopened.route("**/api/meeting-types/booking-attempts/*/check", (route) => {
      expect(route.request().url()).toContain(`/booking-attempts/${key}/check`);
      return route.fulfill({ json: { status: "saved", meeting: confirmation } });
    });
    const page = reopened.pages()[0];
    await page.goto("/book/another-type");
    const check = page.getByRole("button", { name: "Проверить результат" });
    await expect(page.getByRole("alert")).toHaveText("Результат сохранения неизвестен.");
    await expect(check).toBeFocused();
    await expect(page.getByRole("button", { name: "Подтвердить запись" })).toBeDisabled();
    await check.press("Enter");
    await expect(page.getByRole("heading", { name: "Запись подтверждена" })).toBeFocused();
    await expect(page.getByText("Знакомство", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("a@b.c", { exact: true })).toBeVisible();
  } finally {
    await reopened.close();
  }
});

test("keeps the guest's details through failed checks and asks for a new slot after absence", async ({
  page,
  context,
}) => {
  await serveBookingCalendar(context);
  let availableSlots = slots;
  let attempts = 0;
  let checks = 0;
  let originalKey: string | undefined;
  await page.route(`${typePath}/availability`, (route) =>
    route.fulfill({ json: { timeZone, days: [{ date: "2026-02-02", slots: availableSlots }] } }),
  );
  await page.route(`${typePath}/bookings`, (route) => {
    const key = route.request().headers()["idempotency-key"];
    if (++attempts === 1) {
      originalKey = key;
      return route.fulfill({ status: 503, json: { code: "unknown", message: "Неизвестно" } });
    }
    expect(key).not.toBe(originalKey);
    expect(route.request().postDataJSON()).toEqual({
      startsAt: secondStart,
      guestName: "Алекс",
      guestEmail: "a@b.c",
    });
    return route.fulfill({ status: 201, json: confirmation });
  });
  await page.route("**/api/meeting-types/booking-attempts/*/check", (route) => {
    expect(route.request().url()).toContain(`/booking-attempts/${originalKey}/check`);
    if (++checks === 1) return route.abort();
    availableSlots = slots.slice(1);
    return route.fulfill({ json: { status: "not_saved" } });
  });

  await page.goto(pagePath);
  const name = page.getByRole("textbox", { name: "Имя" });
  const email = page.getByRole("textbox", { name: "Email" });
  const send = page.getByRole("button", { name: "Подтвердить запись" });
  const check = page.getByRole("button", { name: "Проверить результат" });
  const unknown = page.getByRole("alert").filter({ hasText: "Результат сохранения неизвестен." });
  await page.getByRole("button", { name: "09:15" }).click();
  await name.fill(" Алекс ");
  await email.fill(" a@b.c ");
  await send.click();
  await expect(unknown).toBeVisible();
  await check.press("Enter");
  await expect(check).toBeFocused();
  await expect(unknown).toBeVisible();

  await page.reload();
  await expect(unknown).toBeVisible();
  await expect(name).toHaveValue(" Алекс ");
  await expect(email).toHaveValue(" a@b.c ");
  await check.press("Enter");
  await expect(page.getByRole("alert")).toContainText("Встреча не сохранена. Выберите время");
  await expect(page.getByRole("heading", { name: "Доступное время" })).toBeFocused();
  await expect(page.getByRole("button", { name: "09:15" })).toHaveCount(0);
  await expect(name).toHaveValue(" Алекс ");
  await expect(email).toHaveValue(" a@b.c ");
  const secondSlot = page.getByRole("button", { name: "10:00" });
  await expect(secondSlot).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => attempts).toBe(1);
  await secondSlot.press("Enter");
  await send.press("Enter");
  await expect(page.getByRole("heading", { name: "Запись подтверждена" })).toBeFocused();
});

async function serveBookingCalendar(target: BrowserContext) {
  await target.route(typePath, (route) =>
    route.fulfill({ json: { id, name: "Знакомство", durationMinutes: 30 } }),
  );
  await target.route(`${typePath}/availability`, (route) =>
    route.fulfill({
      json: { timeZone, days: [{ date: "2026-02-02", slots }] },
    }),
  );
}
