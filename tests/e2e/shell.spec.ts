import { test, expect } from "@playwright/test";

test("shared content navigation renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /aprender português/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /explorar atividades/i })).toHaveAttribute(
    "href",
    "/explorar",
  );

  await page.getByRole("link", { name: "Explorar", exact: true }).click();
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(page.getByRole("heading", { name: "Explorar" })).toBeVisible();
  await expect(page.getByText(/nenhuma atividade publicada ainda/i)).toBeVisible();

  await page.getByRole("link", { name: "Percursos" }).click();
  await expect(page).toHaveURL(/\/percursos$/);
  await expect(page.getByRole("heading", { name: "Percursos" })).toBeVisible();
  await expect(page.getByText(/nenhum percurso publicado ainda/i)).toBeVisible();
});
