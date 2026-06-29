import { test, expect } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./helpers";

/**
 * JOURNEY: Signing in and out.
 * The whole app is gated — every other journey starts from here.
 */
test.describe("Authentication", () => {
  test("rejects a wrong password, then signs in and out", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    // Wrong password → generic error (no hint about which field).
    await page.getByLabel("Email").fill(E2E_EMAIL);
    await page.getByLabel("Password").fill("definitely-wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect email or password")).toBeVisible();

    // Correct credentials → dashboard (re-fill both; a failed submit resets the form).
    await page.getByLabel("Email").fill(E2E_EMAIL);
    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Sign out → back to login; protected pages now redirect.
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
