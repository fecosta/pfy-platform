import { test, expect } from "@playwright/test";

test("operational shell renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /foundation is online/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /check application health/i })).toHaveAttribute(
    "href",
    "/api/health",
  );
});
