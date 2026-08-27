import { test, expect } from "@playwright/test";
import { login } from "./helpers";

/**
 * JOURNEY: The dashboard and global navigation.
 * The four KPI cards are clickable shortcuts; the topbar nav reaches every area.
 */
test.describe("Dashboard & navigation", () => {
  test("shows the KPI cards and navigates from them and the nav bar", async ({ page }) => {
    await login(page);

    // The four KPIs.
    await expect(page.getByText("Revenue today")).toBeVisible();
    await expect(page.getByText("Bills today")).toBeVisible();
    await expect(page.getByText("Pending reports")).toBeVisible();
    await expect(page.getByText("Outstanding", { exact: true })).toBeVisible();

    // A KPI card is a shortcut — Pending reports → Reports.
    await page.getByRole("link", { name: /Pending reports/ }).click();
    await expect(page).toHaveURL(/\/reports$/);

    // Quick-action tiles.
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /New patient/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /New bill/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /New report/ })).toBeVisible();

    // Topbar navigation reaches each main area.
    for (const [link, url] of [
      ["Patients", /\/patients$/],
      ["Bills", /\/bills$/],
      ["Reports", /\/reports$/],
      ["Dashboard", /\/dashboard$/],
    ] as const) {
      await page.getByRole("link", { name: link, exact: true }).click();
      await expect(page).toHaveURL(url);
    }
  });
});
