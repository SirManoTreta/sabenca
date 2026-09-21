import { test, expect } from "@playwright/test";
test("institutional home and first access", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Conheça. Troque. Colabore." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Primeiro acesso", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /crie sua conta|fazer parte/i }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("link", { name: "Primeiro acesso", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Seu primeiro acesso." }),
  ).toBeVisible();
  await expect(
    page.getByLabel("RA (registro acadêmico)", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Data de nascimento")).toBeVisible();
  await expect(
    page.locator(
      'input[name="email"],input[name="cpf"],input[name="password"]',
    ),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("legacy signup redirects; student and admin routes are protected", async ({
  page,
}) => {
  await page.goto("/auth/register");
  await expect(page).toHaveURL(/\/auth\/primeiro-acesso$/);
  for (const route of [
    "/marketplace",
    "/networks",
    "/profile",
    "/connections",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/auth\/login/);
  }
  for (const route of [
    "/admin/alunos",
    "/admin/alunos/importar",
    "/admin/alunos/importacoes",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/auth\/admin/);
  }
  await page.goto("/auth/definir-senha");
  await expect(page).not.toHaveURL(/\/auth\/definir-senha$/);
});
test("RA login, recovery and safe callback", async ({ page }) => {
  await page.goto("/auth/login");
  await page
    .getByLabel("RA (registro acadêmico)", { exact: true })
    .fill("001234");
  await expect(
    page.getByLabel("RA (registro acadêmico)", { exact: true }),
  ).toHaveValue("001234");
  await page.getByLabel("Senha", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("link", { name: "Esqueci minha senha" }).click();
  await expect(
    page.getByRole("heading", { name: "Recupere seu acesso." }),
  ).toBeVisible();
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
  await page.goto("/auth/callback?next=https://evil.test");
  await expect(page).toHaveURL(/\/auth\/login\?message=invalid-link/);
});
