import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ baseURL: process.env.E2E_BASE_URL });

test("the owner creates a meeting type and the guest opens it from the catalog or a direct link", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("link", { name: "Записаться" }).click();
  await expect(page.getByText("Пока нет доступных типов встреч")).toBeVisible();

  await page.getByRole("link", { name: "Админка" }).click();
  await expect(page.getByRole("heading", { name: "Типы встреч" })).toBeVisible();
  await page.getByRole("link", { name: "Создать тип встречи" }).click();

  await page.getByRole("textbox", { name: "Название" }).fill("  Консультация  ");
  await page
    .getByRole("textbox", { name: "Описание (необязательно)" })
    .fill("<strong>Вопросы</strong>");
  await page.getByRole("textbox", { name: "Длительность (минуты)" }).fill("30");

  const create = page.getByRole("button", { name: "Создать", exact: true });
  await page.route(
    "**/api/meeting-types",
    (route) =>
      route.fulfill({
        status: 503,
        json: { code: "not_saved", message: "Не удалось сохранить тип встречи" },
      }),
    { times: 1 },
  );
  await create.press("Enter");
  await expect(page.getByRole("alert")).toContainText("Не удалось сохранить тип встречи");
  const retry = page.getByRole("button", { name: "Повторить сохранение" });
  await expect(retry).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Название" })).toHaveValue("  Консультация  ");
  await expect(page.getByRole("textbox", { name: "Описание (необязательно)" })).toHaveValue(
    "<strong>Вопросы</strong>",
  );
  await expect(page.getByRole("textbox", { name: "Длительность (минуты)" })).toHaveValue("30");

  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Тип встречи создан" })).toBeFocused();
  const directLink = await page.getByRole("textbox", { name: "Прямая ссылка" }).inputValue();

  await page.getByRole("navigation").getByRole("link", { name: "Записаться" }).click();
  await expect(page.getByText("Владелец календаря")).toBeVisible();
  const description = page.getByText("<strong>Вопросы</strong>", { exact: true });
  await expect(description).toBeVisible();
  await expect(page.getByText("30 мин", { exact: true })).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);

  // Click the description coordinates to exercise the whole-card hit area.
  const bounds = await description.boundingBox();
  if (!bounds) throw new Error("The meeting description has no visible bounds");
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(page).toHaveURL(directLink);
  await expect(page.getByRole("heading", { name: "Консультация" })).toBeVisible();

  const guest = await browser.newPage();
  try {
    await guest.goto(directLink);
    await expect(guest.getByRole("heading", { name: "Консультация" })).toBeVisible();
    await expect(guest.getByText("<strong>Вопросы</strong>", { exact: true })).toBeVisible();
  } finally {
    await guest.close();
  }
});

test("the form shows validation after blur and focuses the first invalid field on submit", async ({
  page,
}) => {
  await page.goto("/admin/meeting-types/new");

  const name = page.getByRole("textbox", { name: "Название" });
  const description = page.getByRole("textbox", { name: "Описание (необязательно)" });
  const duration = page.getByRole("textbox", { name: "Длительность (минуты)" });
  const create = page.getByRole("button", { name: "Создать", exact: true });

  await name.focus();
  await expect(name).not.toHaveAttribute("aria-invalid", "true");
  await page.keyboard.press("Tab");
  await expect(name).toHaveAccessibleDescription(/Введите название/);

  await description.fill("Обсудим проект");
  await create.click();
  await expect(name).toBeFocused();
  await expect(duration).toHaveAccessibleDescription(/Введите длительность/);
  await expect(description).toHaveValue("Обсудим проект");

  await name.fill("Консультация");
  await expect(page.getByText(/Введите название/)).toBeHidden();
  await duration.fill("30");
  await expect(page.getByText(/Введите длительность/)).toBeHidden();

  await page.route(
    "**/api/meeting-types",
    (route) =>
      route.fulfill({
        status: 400,
        json: { fieldErrors: { durationMinutes: "Проверьте длительность встречи" } },
      }),
    { times: 1 },
  );
  await create.click();
  await expect(duration).toBeFocused();
  await expect(duration).toHaveAccessibleDescription("Проверьте длительность встречи");
  await expect(duration).toHaveValue("30");
});

test("a guest can retry an initial catalog failure using the keyboard", async ({ page }) => {
  await page.route("**/api/meeting-types", (route) => route.abort("failed"));
  await page.goto("/book");

  await expect(page.getByRole("alert")).toContainText("Не удалось загрузить типы встреч.");
  await page.unroute("**/api/meeting-types");
  await page.getByRole("button", { name: "Повторить" }).press("Enter");

  const refresh = page.getByRole("button", { name: "Обновить" });
  await expect(refresh).toBeEnabled();
  await expect(refresh).toBeFocused();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a failed catalog refresh keeps the previously loaded types visible", async ({ page }) => {
  await page.route("**/api/meeting-types", (route) =>
    route.fulfill({
      json: { meetingTypes: [{ id: "type-1", name: "Знакомство", durationMinutes: 15 }] },
    }),
  );
  await page.goto("/book");
  const meetingType = page.getByRole("link", { name: "Знакомство" });
  await expect(meetingType).toBeVisible();

  await page.unroute("**/api/meeting-types");
  await page.route("**/api/meeting-types", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Обновить" }).click();
  await expect(page.getByRole("alert")).toContainText("Показаны ранее загруженные данные.");
  await expect(meetingType).toBeVisible();
});

test("an unknown meeting type offers a link back to the catalog", async ({ page }) => {
  await page.goto("/book/unknown");
  await expect(page.getByRole("heading", { name: "Тип встречи не найден" })).toBeVisible();
  await page.getByRole("link", { name: "К каталогу типов встреч" }).click();
  await expect(page.getByRole("heading", { name: "Выберите тип встречи" })).toBeVisible();
});
