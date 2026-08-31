import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

function exists(rel: string): boolean {
  return existsSync(resolve(root, rel));
}

describe("PWA manifest and install surface", () => {
  it("public/manifest.json má povinné polia pre standalone PWA", () => {
    const manifest = JSON.parse(read("public/manifest.json")) as {
      name: string;
      short_name: string;
      start_url: string;
      display: string;
      orientation: string;
      theme_color: string;
      background_color: string;
      lang: string;
      icons: { src: string; sizes: string; type: string; purpose: string }[];
      shortcuts: { url: string; name: string }[];
    };

    expect(manifest.name).toContain("ForenzDetectiv");
    expect(manifest.short_name).toBe("ForenzDetectiv");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.orientation).toBe("portrait");
    expect(manifest.theme_color).toBe("#F7F9FC");
    expect(manifest.background_color).toBe("#F7F9FC");
    expect(manifest.lang).toBe("sk");
    expect(manifest.icons.some((i) => i.purpose === "any" && i.sizes === "512x512")).toBe(true);
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
    expect(manifest.shortcuts.some((s) => s.url === "/sherlock")).toBe(true);
    expect(exists("public/forenzdetectiv.png")).toBe(true);
    expect(exists("public/icon.svg")).toBe(true);
  });

  it("index.html odkazuje manifest, ikony a theme-color", () => {
    const html = read("index.html");
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('href="/manifest.json"');
    expect(html).toContain('name="theme-color"');
    expect(html).toContain("#F7F9FC");
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('name="apple-mobile-web-app-capable"');
    expect(html).toContain('name="mobile-web-app-capable"');
    expect(html).toContain('lang="sk"');
  });

  it("VitePWA registruje autoUpdate SW, precache a CacheFirst pre fonty", () => {
    const vite = read("vite.config.ts");
    expect(vite).toContain('from "vite-plugin-pwa"');
    expect(vite).toContain('registerType: "autoUpdate"');
    expect(vite).toContain("includeAssets");
    expect(vite).toContain("manifest.json");
    expect(vite).toContain("globPatterns");
    expect(vite).toContain("CacheFirst");
    expect(vite).toContain("google-fonts");
    expect(vite).toContain('display: "standalone"');
  });

  it("main.tsx registruje virtual:pwa-register", () => {
    const main = read("src/main.tsx");
    expect(main).toContain('from "virtual:pwa-register"');
    expect(main).toContain("registerSW(");
    expect(main).toContain("onOfflineReady");
    expect(main).toContain("onNeedRefresh");
    expect(main).toContain("updateSW(true)");
  });

  it("offline cache analýz ide cez IndexedDB, nie localStorage", () => {
    const db = read("src/lib/db.ts");
    expect(db).toContain('from "idb"');
    expect(db).toContain('DB_NAME = "ForenzDetectiv_DB"');
    expect(db).toContain('STORE_NAME = "analyses"');
    expect(db).toContain("migrateFromLocalStorage");
    expect(db).not.toContain("localStorage.setItem");
  });
});

describe("PWA production build artifacts", () => {
  it.skipIf(!exists("dist/sw.js"))("dist/sw.js precache-uje shell a registruje NavigationRoute", () => {
    const sw = read("dist/sw.js");
    expect(sw).toContain("skipWaiting");
    expect(sw).toContain("precacheAndRoute");
    expect(sw).toContain("index.html");
    expect(sw).toContain("manifest.json");
    expect(sw).toContain("NavigationRoute");
    expect(sw).toContain("google-fonts");
    expect(sw).toContain("CacheFirst");
  });

  it.skipIf(!exists("dist/manifest.webmanifest"))(
    "dist/manifest.webmanifest ostáva standalone",
    () => {
      const generated = JSON.parse(read("dist/manifest.webmanifest")) as {
        display: string;
        start_url: string;
        short_name: string;
        icons: { src: string }[];
      };
      expect(generated.display).toBe("standalone");
      expect(generated.start_url).toBe("/");
      expect(generated.short_name).toBe("ForenzDetectiv");
      expect(generated.icons.length).toBeGreaterThan(0);
    }
  );
});
