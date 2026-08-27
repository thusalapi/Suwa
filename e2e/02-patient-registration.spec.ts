import { test, expect } from "@playwright/test";
import { login, uniquePhone } from "./helpers";

/**
 * JOURNEY: Finding a patient and registering a new one from the fast finder.
 * The finder is the counter's home base — type a phone, act in one tap, or register on the spot.
 */
test.describe("Patient registration", () => {
  test("searches, registers a new patient via the finder shortcut, and opens the record", async ({ page }) => {
    await login(page);
    const phone = uniquePhone();
    const name = `Test Patient ${phone.slice(-4)}`;

    // Open the patients finder and search a phone that doesn't exist yet.
    await page.getByRole("link", { name: "Patients", exact: true }).click();
    await expect(page).toHaveURL(/\/patients/);
    await page.getByPlaceholder("Search by phone or name").fill(phone);

    // No match → the "register new" shortcut carries the typed number forward.
    await page.getByRole("link", { name: /Register .* as a new patient/ }).click();
    await expect(page).toHaveURL(/\/patients\/new/);

    // Phone is prefilled; fill the name and save.
    await expect(page.getByLabel("Phone number")).toHaveValue(phone);
    await page.getByLabel("Full name").fill(name);
    await page.getByLabel("Gender").selectOption("male");
    await page.getByRole("button", { name: "Add patient" }).click();

    // Lands on the patient detail page with their reports + bills sections.
    await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText(phone)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bills" })).toBeVisible();

    // Searching that phone now finds them.
    await page.getByRole("link", { name: "Patients", exact: true }).click();
    await page.getByPlaceholder("Search by phone or name").fill(phone);
    await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
  });
});
