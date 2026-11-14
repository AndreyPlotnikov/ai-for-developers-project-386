import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ baseURL: process.env.E2E_BASE_URL });

const paths = {
  browser: "/book/calendar-test",
  type: "**/api/meeting-types/calendar-test",
  availability: "**/api/meeting-types/calendar-test/availability",
};
const slots = [
  {
    startsAt: "2026-02-02T06:00:00Z",
    endsAt: "2026-02-02T06:30:00Z",
  },
];
const nextSlots = [
  {
    startsAt: "2026-02-03T06:30:00Z",
    endsAt: "2026-02-03T07:00:00Z",
  },
];

function dates(start: number, active = new Map<number, typeof slots>()) {
  return {
    timeZone: "Europe/Moscow",
    days: Array.from({ length: 14 }, (_, index) => {
      const day = start + index;
      return {
        date: `2026-02-${String(day).padStart(2, "0")}`,
        slots: active.get(day) ?? [],
      };
    }),
  };
}

async function mockType(page: Page) {
  await page.route(paths.type, (route) =>
    route.fulfill({ json: { id: "calendar-test", name: "Знакомство", durationMinutes: 30 } }),
  );
}

test("a guest can select empty dates with the keyboard and learns when all dates are empty", async ({
  page,
}) => {
  await mockType(page);
  let availability = dates(1, new Map([[2, slots]]));
  await page.route(paths.availability, (route) => route.fulfill({ json: availability }));
  await page.goto(paths.browser);
  const calendar = page.getByRole("region", { name: "Доступное время" });
  await expect(calendar.getByText("Часовой пояс владельца: Europe/Moscow")).toBeVisible();
  const day2 = calendar.getByRole("button", { name: /(?:^|, )2 февраля/ });
  await expect(day2).toHaveAttribute("aria-pressed", "true");
  await expect(day2.getByText("✓", { exact: true })).toBeVisible();
  const slot = calendar.getByRole("button", { name: "09:00", exact: true });
  await slot.press("Enter");
  await expect(slot.getByText("✓", { exact: true })).toBeVisible();

  const emptyDay = calendar.getByRole("button", {
    name: /(?:^|, )3 февраля.*нет времени/i,
  });
  await day2.focus();
  await page.keyboard.press("Tab");
  await expect(emptyDay).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(emptyDay).toHaveAttribute("aria-pressed", "true");
  await expect(
    calendar.getByText("На эту дату нет свободного времени. Выберите другую дату."),
  ).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);

  await day2.press("Enter");
  await expect(slot).toBeEnabled();
  availability = dates(1);
  await calendar.getByRole("button", { name: "Обновить доступное время" }).click();
  await expect(calendar.getByText("Нет свободного времени на ближайшие 14 дней.")).toBeVisible();
  await expect(day2).toHaveAttribute("aria-pressed", "true");
  await expect(calendar.getByText(/На эту дату нет свободного времени/)).toBeVisible();

  await page.reload();
  await expect(calendar.getByText("Нет свободного времени на ближайшие 14 дней.")).toBeVisible();
  await expect(calendar.getByRole("button", { pressed: true })).toHaveCount(0);
  await emptyDay.press("Enter");
  await expect(emptyDay).toHaveAttribute("aria-pressed", "true");
  await expect(calendar.getByText(/На эту дату нет свободного времени/)).toBeVisible();
  await expect(calendar.getByText("Нет свободного времени на ближайшие 14 дней.")).toBeVisible();
});

test("retry retains stale dates and reselects when the chosen date leaves the window", async ({
  page,
}) => {
  await mockType(page);
  let availability = dates(2, new Map([[2, slots]]));
  let fail = true;
  await page.route(paths.availability, async (route) => {
    if (fail) return route.abort("failed");
    await route.fulfill({ json: availability });
  });
  await page.goto(paths.browser);
  const calendar = page.getByRole("region", { name: "Доступное время" });
  await expect(calendar.getByRole("alert")).toContainText("Не удалось загрузить доступное время.");
  await expect(calendar.getByText("Нет свободного времени на ближайшие 14 дней.")).toBeHidden();

  fail = false;
  await calendar.getByRole("button", { name: "Повторить" }).press("Enter");
  const day2 = calendar.getByRole("button", { name: /(?:^|, )2 февраля/ });
  const time = calendar.getByRole("button", { name: "09:00", exact: true });
  await expect(time).toBeEnabled();

  fail = true;
  await day2.click();
  await expect(calendar.getByRole("alert")).toContainText("Показаны ранее загруженные данные.");
  await expect(time).toBeDisabled();

  fail = false;
  availability = dates(2, new Map([[3, nextSlots]]));
  await calendar.getByRole("button", { name: "Повторить" }).click();
  await expect(day2).toHaveAttribute("aria-pressed", "true");
  await expect(
    calendar.getByText("На эту дату нет свободного времени. Выберите другую дату."),
  ).toBeVisible();

  availability = dates(3, new Map([[3, nextSlots]]));
  await day2.click();
  await expect(day2).toBeHidden();
  await expect(calendar.getByRole("button", { name: /(?:^|, )3 февраля/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(calendar.getByRole("button", { name: "09:30", exact: true })).toBeEnabled();
});
