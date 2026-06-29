import { test, expect } from "@playwright/test";
import { login, registerPatient, pickFromFinder, uniquePhone } from "./helpers";

/**
 * JOURNEY: The full lab-report lifecycle.
 * Find patient → pick a template → enter results → create draft → edit the draft → verify (sign-off)
 * → download the branded PDF. Verification is the gate before a report is "released".
 */
test.describe("Report lifecycle", () => {
  test("creates, edits, verifies, and downloads a report PDF", async ({ page }) => {
    await login(page);
    const phone = uniquePhone();
    await registerPatient(page, `Report Patient ${phone.slice(-4)}`, phone);

    // Fast path: New report → find the patient → tap Report.
    await page.goto("/reports/new");
    await expect(page.getByText("Find the patient")).toBeVisible();
    await pickFromFinder(page, phone, "report");

    // Pick a report type (the clinic has several, so the picker shows).
    await expect(page.getByText("Choose a report template")).toBeVisible();
    await page.getByRole("link", { name: /Full Blood Count/ }).click();

    // Enter a result — Hemoglobin 10 is below the reference range (flagged Low live).
    await page.getByLabel("Hemoglobin Result").fill("10");
    await page.getByRole("button", { name: "Create report" }).click();

    // Lands on the new draft report.
    await expect(page).toHaveURL(/\/reports\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: /Full Blood Count/ })).toBeVisible();
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();
    const reportUrl = page.url();

    // Edit the draft — the existing value is prefilled; correct it to a normal value.
    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page).toHaveURL(/\/edit$/);
    await expect(page.getByLabel("Hemoglobin Result")).toHaveValue("10");
    await page.getByLabel("Hemoglobin Result").fill("14");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(reportUrl);

    // Verify (doctor/owner sign-off) → status flips to Verified.
    await page.getByRole("button", { name: "Verify report" }).click();
    await expect(page.getByText("Verified", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Verify report" })).toHaveCount(0);

    // The PDF route returns a real branded PDF.
    const href = await page.getByRole("link", { name: "Download PDF" }).getAttribute("href");
    expect(href).toBeTruthy();
    const pdf = await page.request.get(href!);
    expect(pdf.ok()).toBeTruthy();
    expect(pdf.headers()["content-type"]).toContain("pdf");
  });
});
