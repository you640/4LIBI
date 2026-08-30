import { test as base, expect, type Page } from "@playwright/test";

/** Stub API so UI smoke tests don't depend on the Hono server on :5176. */
async function mockApiRoutes(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();

    if (method === "GET" && pathname === "/api/analyses") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
      return;
    }

    if (method === "GET" && pathname === "/api/health") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok" }),
      });
      return;
    }

    if (method === "POST" && pathname === "/api/geospatial/check") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          result: {
            isFeasible: false,
            distanceKm: 400,
            travelMinutesAvailable: 45,
            minTravelMinutesRequired: 250,
            requiredSpeedKmh: 533,
            severity: "critical",
            explanation: "Fyzikálne nemožný presun medzi mestami (mock).",
            locationA: "Košice",
            locationB: "Bratislava",
          },
        }),
      });
      return;
    }

    if (method === "POST" && pathname === "/api/cross-exam") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          source: "local",
          questions: [
            {
              id: "q1",
              question: "Ako vysvetlíte rozpor medzi Košicami a Bratislavou?",
              rationale: "E2E mock",
              targetPerson: "Ján Novák",
              citation: {
                documentTitle: "Demo spis",
                passage: "alibi",
                page: 1,
                line: null,
              },
              suggestedFollowUps: [],
            },
          ],
        }),
      });
      return;
    }

    if (method === "POST" && pathname === "/api/audit-logs") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    if (method === "GET") {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "not mocked" }),
      });
      return;
    }

    await route.fulfill({ status: 204, body: "" });
  });
}

export const test = base.extend({
  page: async ({ page }, runWithPage) => {
    await mockApiRoutes(page);
    await runWithPage(page);
  },
});

export { expect };
