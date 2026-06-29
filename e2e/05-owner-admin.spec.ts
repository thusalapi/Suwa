import { test, expect } from "@playwright/test";
import { login } from "./helpers";

/**
 * JOURNEYS: Owner-only administration — price catalog, clinic settings, report templates,
 * team invites, and the revenue report. These nav links only appear for the owner role.
 */
test.describe("Owner administration", () => {
  test.beforeEach(async ({ page }) => login(page));

  test("adds a service to the price catalog", async ({ page }) => {
    const name = `X-Ray ${Date.now().toString().slice(-5)}`;
    await page.getByRole("link", { name: "Services" }).click();
    await page.getByRole("link", { name: "New service" }).click();

    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Price").fill("2500");
    await page.getByRole("button", { name: "New service" }).click();

    await expect(page).toHaveURL(/\/services$/);
    await expect(page.getByRole("link", { name })).toBeVisible();
  });

  test("updates clinic settings (contact details + report QR)", async ({ page }) => {
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Clinic settings" })).toBeVisible();

    await page.getByLabel("Fax number").fill("091-2250755");
    await page.getByLabel("Email", { exact: true }).fill("e2e@clinic.test");
    await page.getByLabel("Show QR code on report PDFs").uncheck();
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Settings saved.")).toBeVisible();
  });

  test("lists report templates and opens the builder", async ({ page }) => {
    await page.getByRole("link", { name: "Templates" }).click();
    await expect(page.getByRole("heading", { name: "Report templates" })).toBeVisible();
    await expect(page.getByText("Fasting Blood Sugar")).toBeVisible();

    await page.getByRole("link", { name: "New template" }).click();
    await expect(page.getByText("Template name")).toBeVisible();
    await expect(page.getByText("Add block")).toBeVisible();
  });

  test("invites a team member (awaiting first login)", async ({ page }) => {
    const email = `e2e.member.${Date.now()}@suwa.test`;
    await page.getByRole("link", { name: "Team", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();

    await page.getByLabel("Name").fill("New Staffer");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Role").selectOption("doctor");
    await page.getByLabel("Temporary password").fill("temp-pass-123");
    await page.getByRole("button", { name: "Add member" }).click();

    await expect(page.getByText("Team member added.")).toBeVisible();
    // Scope to the new member's row (earlier runs leave other pending members in this clinic).
    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Awaiting first login");
  });

  test("opens the revenue report", async ({ page }) => {
    await page.getByRole("link", { name: "Revenue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Revenue report" })).toBeVisible();
    await expect(page.getByText("Billed", { exact: true })).toBeVisible();
    await expect(page.getByText("Collected", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Export CSV" })).toBeVisible();
  });
});
