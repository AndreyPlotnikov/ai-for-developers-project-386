import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ baseURL: process.env.E2E_BASE_URL });

test("the owner creates a meeting type and sees the guest's booking on reload", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 640, height: 450 });
  await page.goto("/");
  await page.getByRole("link", { name: "Админка" }).press("Enter");
  await page.getByRole("link", { name: "Предстоящие встречи" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Предстоящие встречи" })).toBeVisible();
  await expect(page.getByText("Предстоящих встреч нет")).toBeVisible();

  const meetingTypeName = "Встреча для списка владельца";
  const owner = await browser.newPage({ baseURL, viewport: { width: 640, height: 450 } });
  let directLink: string;
  try {
    await owner.goto("/admin/meeting-types/new");
    await expect(owner.locator("html")).toHaveJSProperty("scrollWidth", 640);
    await owner.getByRole("textbox", { name: "Название" }).fill(meetingTypeName);
    await owner.getByRole("textbox", { name: "Длительность (минуты)" }).fill("30");
    await owner.getByRole("button", { name: "Создать", exact: true }).press("Enter");
    await expect(owner.getByRole("heading", { name: "Тип встречи создан" })).toBeFocused();
    directLink = await owner.getByRole("textbox", { name: "Прямая ссылка" }).inputValue();
  } finally {
    await owner.close();
  }
  const guest = await browser.newPage({ viewport: { width: 640, height: 450 } });
  try {
    await guest.goto(directLink);
    await expect(guest.getByRole("heading", { name: meetingTypeName })).toBeVisible();
    await guest
      .getByRole("button", { name: /^\d{2}:\d{2}$/ })
      .first()
      .press("Enter");
    await expect(guest.locator("html")).toHaveJSProperty("scrollWidth", 640);
    await guest.getByRole("textbox", { name: "Имя" }).fill("Алекс");
    await guest.getByRole("textbox", { name: "Email" }).fill("guest@example.com");
    await guest.getByRole("button", { name: "Подтвердить запись" }).press("Enter");
    await expect(guest.getByRole("heading", { name: "Запись подтверждена" })).toBeFocused();
  } finally {
    await guest.close();
  }

  await page.reload();
  const meeting = page.getByRole("listitem").filter({ hasText: meetingTypeName });
  await expect(meeting.getByRole("heading", { name: meetingTypeName })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 640);
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
