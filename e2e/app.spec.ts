import { test, expect, type Page } from "@playwright/test";

const EMAIL = "santiago@clickuppp.dev";
const PASSWORD = "password";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@company.com").fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Log In" }).click();
  // after login the app lands on Home ("My Work")
  await page.waitForURL(/\/home/);
}

test("redirects to /login when unauthenticated", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Log In" })).toBeVisible();
});

test("rejects bad credentials", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("you@company.com").fill(EMAIL);
  await page.locator('input[type="password"]').fill("wrongpassword");
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page.getByText(/Invalid email or password/i)).toBeVisible();
});

test("logs in and renders the workspace", async ({ page }) => {
  await login(page);
  // sidebar spaces from the seed
  await expect(page.getByText("Product").first()).toBeVisible();
  // a seeded list
  await expect(page.getByText("Backlog").first()).toBeVisible();
});

test("creates a task that appears in the list", async ({ page }) => {
  await login(page);
  // open a list first (Home has no task composer); scope to the sidebar so we
  // don't match a "Backlog" list chip on a Home task row
  await page.locator("aside").getByText("Backlog", { exact: true }).click();
  await page.waitForURL(/\/l\//);
  const name = `E2E task ${Date.now()}`;
  await page.getByRole("button", { name: "Add Task" }).first().click();
  await page.getByPlaceholder("Task name").fill(name);
  await page.keyboard.press("Enter");
  await expect(page.getByText(name)).toBeVisible();
});

test("opens the Home / My Work view after login", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
});

test("opens an active Sprint with task progress and reports", async ({ page }) => {
  await login(page);
  await page.locator("aside").getByText("Engineering Sprints", { exact: true }).click();
  await page.waitForURL(/\/sf\//);
  await expect(page.getByRole("heading", { name: "Engineering Sprints" })).toBeVisible();
  await page.getByText("Sprint 24", { exact: true }).first().click();
  await page.waitForURL(/\/s\//);
  await expect(page.getByRole("heading", { name: "Sprint 24" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete Sprint" })).toBeVisible();
  await expect(page.getByText("Sprint tasks", { exact: true })).toBeVisible();
  await expect(page.getByText("Sprint report", { exact: true })).toBeVisible();
  await expect(page.getByText("Burndown", { exact: true })).toBeVisible();
});
