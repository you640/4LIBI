import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const pwRoot = process.env.PLAYWRIGHT_ROOT;
const { chromium } = pwRoot
  ? createRequire(pathToFileURL(join(pwRoot, "package.json")).href)("playwright")
  : await import("playwright");

const BASE = process.env.SMOKE_BASE || "http://127.0.0.1:5175";
const VIEWPORT = { width: 430, height: 932 };

const ROUTES = [
  "/",
  "/spisy",
  "/sherlock",
  "/profil",
];

function overlapReport(islandBottom, nodes) {
  return nodes
    .filter((n) => n.top < islandBottom - 0.5)
    .map((n) => `${n.tag}[${n.name}] top=${n.top.toFixed(1)}`);
}

async function interactiveInIsland(page, islandBottom) {
  return page.evaluate((band) => {
    const sel =
      'a, button, input, textarea, select, [role="button"], [role="tab"], [role="link"]';
    return [...document.querySelectorAll(sel)]
      .filter((el) => {
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden" || s.pointerEvents === "none") {
          return false;
        }
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return false;
        return r.top < band - 0.5 && r.bottom > 0;
      })
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        name: (el.getAttribute("aria-label") || el.textContent || "")
          .trim()
          .slice(0, 48),
        top: el.getBoundingClientRect().top,
      }));
  }, islandBottom);
}

async function metrics(page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const island = document.querySelector("[data-testid=island-safe-zone]");
    const appBar = document.querySelector("[data-testid=m3-app-bar]");
    const nav = document.querySelector("[data-testid=m3-nav-bar]");
    const caseHeader = document.querySelector(".m3-case-header");
    const search = document.querySelector(".m3-search-bar input, .m3-search-bar");
    const ir = island?.getBoundingClientRect();
    return {
      href: location.href,
      title: document.title,
      islandBand: root.getPropertyValue("--island-band").trim(),
      safeTop: root.getPropertyValue("--safe-top").trim(),
      islandHeight: ir?.height ?? 0,
      islandBottom: ir?.bottom ?? 0,
      appBarTop: appBar?.getBoundingClientRect().top ?? null,
      caseHeaderTop: caseHeader?.getBoundingClientRect().top ?? null,
      searchTop: search?.getBoundingClientRect().top ?? null,
      navBottom: nav?.getBoundingClientRect().bottom ?? null,
      navHeight: nav?.getBoundingClientRect().height ?? null,
      bodyText: (document.body.innerText || "").slice(0, 280),
    };
  });
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
});
const page = await context.newPage();

const failures = [];
const results = [];

try {
  for (const route of ROUTES) {
    const url = `${BASE}${route}`;
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(400);
    const m = await metrics(page);
    const overlaps = await interactiveInIsland(page, m.islandBottom);
    const bad = overlapReport(m.islandBottom, overlaps);
    const chromeTops = [m.appBarTop, m.caseHeaderTop, m.searchTop].filter(
      (v) => typeof v === "number"
    );
    const chromeInIsland = chromeTops.some((t) => t < m.islandBottom - 0.5);

    const row = {
      route,
      status: res?.status() ?? 0,
      islandHeight: Math.round(m.islandHeight),
      islandBottom: Math.round(m.islandBottom),
      appBarTop: m.appBarTop == null ? null : Math.round(m.appBarTop),
      overlaps: bad,
      chromeInIsland,
    };
    results.push(row);

    if (!res || res.status() >= 400) failures.push(`${route} HTTP ${res?.status()}`);
    if (m.islandHeight < 54) failures.push(`${route} island band too small (${m.islandHeight})`);
    if (bad.length) failures.push(`${route} touchables in island: ${bad.join("; ")}`);
    if (chromeInIsland) failures.push(`${route} AppBar/CaseHeader/search overlap island`);
  }

  // Simulate iPhone Air safe-area-inset-top = 59px
  await page.addInitScript(() => {
    document.documentElement.style.setProperty("--safe-top", "59px");
  });
  await page.goto(`${BASE}/`, {
    waitUntil: "networkidle",
    timeout: 20000,
  });
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--safe-top", "59px");
  });
  await page.waitForTimeout(200);
  const air = await metrics(page);
  const airOverlaps = overlapReport(
    air.islandBottom,
    await interactiveInIsland(page, air.islandBottom)
  );
  results.push({
    route: "/ (safe-top 59px)",
    islandHeight: Math.round(air.islandHeight),
    islandBottom: Math.round(air.islandBottom),
    appBarTop: air.appBarTop == null ? null : Math.round(air.appBarTop),
    caseHeaderTop: air.caseHeaderTop == null ? null : Math.round(air.caseHeaderTop),
    overlaps: airOverlaps,
  });
  if (air.islandHeight < 70) {
    failures.push(`59px safe-top island too small (${air.islandHeight})`);
  }
  if (airOverlaps.length) {
    failures.push(`59px island overlaps: ${airOverlaps.join("; ")}`);
  }

  const searchBtn = page.getByRole("button", { name: /Hľadať/i });
  if (await searchBtn.count()) {
    await searchBtn.click();
    await page.waitForTimeout(200);
    const withSearch = await metrics(page);
    const searchOverlaps = overlapReport(
      withSearch.islandBottom,
      await interactiveInIsland(page, withSearch.islandBottom)
    );
    results.push({
      route: "search open",
      searchTop: withSearch.searchTop == null ? null : Math.round(withSearch.searchTop),
      overlaps: searchOverlaps,
    });
    if (searchOverlaps.length) {
      failures.push(`search island overlaps: ${searchOverlaps.join("; ")}`);
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ viewport: VIEWPORT, results, failures }, null, 2));
if (failures.length) {
  process.exit(1);
}
