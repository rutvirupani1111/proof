// Smoke test: the smallest set of checks that proves a build actually works in a browser.
// It does not test features in depth (the vitest unit tests do that for the engines); it answers
// "does the app start, render its main pages, and let a real user sign in?".
//
// Needs the seeded demo data (npm run db:seed). The demo password is the fictional one that
// README.md publishes for the seeded showcase accounts.
import { expect, test } from "playwright/test";

const DEMO_STUDENT = { email: "ishita@spit-surat.example", password: "proof-demo-2026" };

test("landing page renders", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Proof/);
});

test("login page renders", async ({ page }) => {
  const response = await page.goto("/login");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.locator("#email")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();
});

test("public student profile renders", async ({ page }) => {
  const response = await page.goto("/u/ishita-varma");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Ishita Varma" })).toBeVisible();
});

test("demo student can sign in", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#email").fill(DEMO_STUDENT.email);
  await page.locator("#password").fill(DEMO_STUDENT.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/student(\/|\?|$)/);
  await expect(page.locator("#password")).toHaveCount(0);
});

test("password field toggles between hidden and shown", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#password").fill("not-a-real-password");
  const toggle = page.getByRole("button", { name: "Show password" });
  await toggle.click();
  await expect(page.locator("#password")).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  // The toggle never submits the form.
  await expect(page).toHaveURL(/\/login/);
});

// The CI build reads .env.production, which turns the showcase demo mode on.
test("demo panel signs in with one tap and offers a role switch", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Sign in as Meera Iyer/ }).click();
  await expect(page).toHaveURL(/\/recruiter(\/|\?|$)/);
  await expect(page.getByRole("button", { name: /Switch role/ })).toBeVisible();
});
