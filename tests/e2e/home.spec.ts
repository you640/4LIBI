import { test, expect } from "./fixtures";

test.describe("core flows", () => {
  test("home loads with brand CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-hero")).toBeVisible();
    await expect(page.getByTestId("home-cta-upload")).toBeVisible();
    await expect(page.getByTestId("home-cta-demo")).toHaveCount(0);
    await expect(page.getByTestId("home-proof-strip")).toContainText("Rozpory");
  });

  test("home CTA opens Sherlock", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("home-cta-upload").click();
    await expect(page).toHaveURL(/\/sherlock/);
  });

  test("sherlock route is reachable", async ({ page }) => {
    await page.goto("/sherlock");
    await expect(page.locator("body")).toBeVisible();
  });

  test("spisy route is reachable", async ({ page }) => {
    await page.goto("/spisy");
    await expect(page.locator("body")).toBeVisible();
  });
});
