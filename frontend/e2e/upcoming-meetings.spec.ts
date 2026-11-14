import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ baseURL: process.env.E2E_BASE_URL });

test("the owner opens the empty list, sees a new booking on reload, and retries a failed refresh", async ({
  page,
  browser,
  baseURL,
  request,
}) => {
  await page.setViewportSize({ width: 640, height: 450 });
  await page.goto("/");
  await page.getByRole("link", { name: "Админка" }).press("Enter");
  await page.getByRole("link", { name: "Предстоящие встречи" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Предстоящие встречи" })).toBeVisible();
  await expect(page.getByText("Предстоящих встреч нет")).toBeVisible();

  const meetingTypeName = "Встреча для списка владельца";
  const created = await request.post("/api/meeting-types", {
    data: { name: meetingTypeName, durationMinutes: 30 },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const guest = await browser.newPage({ baseURL });
  try {
    await guest.goto(`/book/${id}`);
    await guest
      .getByRole("button", { name: /^\d{2}:\d{2}$/ })
      .first()
      .press("Enter");
    await guest.getByRole("textbox", { name: "Имя" }).fill("Алекс");
    await guest.getByRole("textbox", { name: "Email" }).fill("guest@example.com");
    await guest.getByRole("button", { name: "Подтвердить запись" }).press("Enter");
    await expect(guest.getByRole("heading", { name: "Запись подтверждена" })).toBeVisible();
  } finally {
    await guest.close();
  }

  await page.reload();
  const meeting = page.getByRole("listitem").filter({ hasText: meetingTypeName });
  await expect(meeting.getByRole("heading", { name: meetingTypeName })).toBeVisible();
  await expect(
    meeting.getByText(/\d{1,2} [а-я]+ \d{4} г\., \d{2}:\d{2}–\d{2}:\d{2} \(Europe\/Moscow\)/),
  ).toBeVisible();
  await expect(meeting.getByText("Алекс", { exact: true })).toBeVisible();
  await expect(meeting.getByText("guest@example.com", { exact: true })).toBeVisible();

  await page.route("**/api/owner/meetings", (route) => route.abort("failed"), { times: 1 });
  await page.getByRole("button", { name: "Обновить" }).press("Enter");
  await expect(page.getByRole("alert")).toContainText("Показаны ранее загруженные данные.");
  await expect(meeting).toBeVisible();
  const retry = page.getByRole("button", { name: "Повторить" });
  await expect(retry).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Обновить" })).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(meeting).toBeVisible();

  await page.getByRole("link", { name: "Типы встреч", exact: true }).press("Enter");
  await page.getByRole("link", { name: "Предстоящие встречи" }).press("Enter");
  await expect(meeting).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
