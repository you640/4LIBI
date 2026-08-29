import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["forenzdetectiv.png", "icon.svg", "manifest.json"],
      manifest: {
        name: "ForenzDetectiv — AI rozpory vo výpovediach",
        short_name: "ForenzDetectiv",
        description: "V spise, ktorý ste prečítali stokrát, nájdete rozpor za sekundu.",
        theme_color: "#F7F9FC",
        background_color: "#F7F9FC",
        display: "standalone",
        orientation: "portrait",
        categories: ["productivity", "utilities"],
        lang: "sk",
        icons: [
          {
            src: "/forenzdetectiv.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/forenzdetectiv.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /\/api\/analyses\/demo/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "demo-analyses-cache",
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5175,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5176",
        changeOrigin: true,
        timeout: 180000,
        proxyTimeout: 180000,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5176",
        changeOrigin: true,
        timeout: 180000,
        proxyTimeout: 180000,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  // @ts-expect-error vitest config
  test: {
    globals: true,
    environment: "node",
  },
});
