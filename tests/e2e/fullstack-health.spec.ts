import { test, expect } from "@playwright/test";

test.describe("fullstack API", () => {
  test("health endpoint responds", async ({ request }) => {
    const res = await request.get("http://127.0.0.1:5176/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("home CTA opens Sherlock against real stack", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("home-cta-upload").click();
    await expect(page).toHaveURL(/\/sherlock/, { timeout: 15_000 });
  });
});
