import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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
