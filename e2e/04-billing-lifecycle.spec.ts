import { test, expect } from "@playwright/test";
import { login, registerPatient, pickFromFinder, uniquePhone } from "./helpers";

/**
 * JOURNEY: The full billing lifecycle.
 * Find patient → add a catalog service line → create the bill → record a payment → it settles to
 * Paid → download the receipt PDF. Money is integer-exact; the running total updates live.
 */
test.describe("Billing lifecycle", () => {
  test("creates a bill, records a payment, and downloads the receipt", async ({ page }) => {
    await login(page);
    const phone = uniquePhone();
    await registerPatient(page, `Bill Patient ${phone.slice(-4)}`, phone);

    // Fast path: New bill → find the patient → tap Bill.
    await page.goto("/bills/new");
    await expect(page.getByText("Find the patient to bill")).toBeVisible();
    await pickFromFinder(page, phone, "bill");

    // Add a line from the price catalog (auto-fills the description + unit price).
    await page.getByLabel("Service").first().selectOption({ label: "Consultation" });
    await expect(page.getByLabel("Description").first()).toHaveValue("Consultation");
    await page.getByRole("button", { name: "Create bill" }).click();

    // Lands on the new bill with a payment form.
    await expect(page).toHaveURL(/\/bills\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("button", { name: "Record payment" })).toBeVisible();

    // Record the full payment → the bill settles to Paid (the payment form is replaced by the
    // Paid state, so we assert the status, not the transient success message).
    await page.getByLabel("Amount").fill("1500");
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("Paid", { exact: true })).toBeVisible();

    // The PDF route returns a real receipt PDF.
    const href = await page.getByRole("link", { name: "Download PDF" }).getAttribute("href");
    expect(href).toBeTruthy();
    const pdf = await page.request.get(href!);
    expect(pdf.ok()).toBeTruthy();
    expect(pdf.headers()["content-type"]).toContain("pdf");
  });
});
