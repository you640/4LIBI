import { test, expect } from "./fixtures";

test.describe("PWA install surface", () => {
  test("servuje manifest.json so standalone display", async ({ request }) => {
    const res = await request.get("/manifest.json");
    expect(res.ok()).toBeTruthy();
    const manifest = (await res.json()) as {
      name: string;
      short_name: string;
      display: string;
      start_url: string;
      lang: string;
      icons: { src: string }[];
    };
    expect(manifest.short_name).toBe("ForenzDetectiv");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.lang).toBe("sk");
    expect(manifest.icons.length).toBeGreaterThan(0);

    const icon = await request.get(manifest.icons[0].src);
    expect(icon.ok()).toBeTruthy();
    expect(icon.headers()["content-type"] ?? "").toMatch(/image\//);
  });

  test("HTML head má manifest, theme-color a apple-touch-icon", async ({ request }) => {
    const res = await request.get("/");
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('href="/manifest.json"');
    expect(html).toContain('name="theme-color"');
    expect(html).toContain("#F7F9FC");
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('href="/forenzdetectiv.png"');
  });
});
