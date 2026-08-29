import { test, expect } from "./fixtures";

test.describe("core flows", () => {
  test("home loads with brand CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-hero")).toBeVisible();
    await expect(page.getByTestId("home-cta-upload")).toBeVisible();
    await expect(page.getByTestId("home-cta-demo")).toBeVisible();
    await expect(page.getByTestId("home-proof-strip")).toContainText("Rozpory");
  });

  test("home demo shows contradictions on RozporyTab", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("home-cta-demo").click();
    await expect(page.getByTestId("demo-case-runner")).toBeVisible();
    await expect(page).toHaveURL(/\/spisy\/demo\/rozpory/, { timeout: 10_000 });
    await expect(page.getByTestId("rozpory-list")).toBeVisible();
    await expect(page.getByTestId("rozpory-event").first()).toBeVisible();
    await expect(page.getByText("Mýtny lístok D1 smer BA → KE")).toBeVisible();
  });

  test("demo alibi map and cross-exam from rozpory", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("home-cta-demo").click();
    await expect(page).toHaveURL(/\/spisy\/demo\/rozpory/, { timeout: 10_000 });

    const geoBtn = page.getByTestId("geospatial-check-btn").first();
    await expect(geoBtn).toBeVisible();
    await geoBtn.click();
    await expect(page.getByTestId("geospatial-result").first()).toBeVisible();
    await expect(page.getByTestId("alibi-map").first()).toBeVisible();

    await page.getByRole("button", { name: /Alibi Impossible Karta/i }).first().click();
    await page.getByTestId("cross-exam-btn").click();
    await expect(page.getByTestId("cross-exam-questions")).toBeVisible();
    await expect(
      page.getByText(/Ako vysvetlíte rozpor medzi Košicami a Bratislavou/i)
    ).toBeVisible();
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
