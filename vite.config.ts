import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
