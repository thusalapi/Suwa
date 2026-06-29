import { type Page, expect } from "@playwright/test";

/** Credentials of the isolated E2E owner (see scripts/seed-e2e.ts). Override via env if changed. */
export const E2E_EMAIL = (process.env.E2E_EMAIL ?? "e2e.owner@suwa.test").toLowerCase();
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "Passw0rd!";

/** A unique-per-run 10-digit phone (07XXXXXXXX) so registrations never collide. */
export function uniquePhone(): string {
  return "07" + String(Date.now()).slice(-8);
}

/** Sign in as the E2E owner and land on the dashboard. */
export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Register a fresh patient and return on their detail page. */
export async function registerPatient(page: Page, fullName: string, phone: string): Promise<void> {
  await page.goto("/patients/new");
  await page.getByLabel("Full name").fill(fullName);
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Add patient" }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: fullName })).toBeVisible();
}

/**
 * Use the live PatientFinder (on /patients, /bills/new, /reports/new): type the phone, then tap the
 * inline Bill/Report action on the matching row.
 */
export async function pickFromFinder(page: Page, phone: string, action: "bill" | "report"): Promise<void> {
  await page.getByPlaceholder("Search by phone or name").fill(phone);
  const row = page.getByRole("listitem").filter({ hasText: phone });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: action === "bill" ? "New bill" : "New report" }).click();
}
