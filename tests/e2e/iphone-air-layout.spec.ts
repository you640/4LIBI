import { test, expect } from "./fixtures";

test.describe("iphone air layout", () => {
  test.use({
    viewport: { width: 393, height: 852 },
    hasTouch: true,
    isMobile: true,
  });

  test("safe areas and no horizontal overflow on home", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    expect(overflow).toBe(false);
  });

  test("sherlock page fits viewport width", async ({ page }) => {
    await page.goto("/sherlock");
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    expect(overflow).toBe(false);
  });
});
