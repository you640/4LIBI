import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initSentry } from "./lib/sentry";
import { storage } from "./lib/db";
import { ensureSession } from "./lib/apiFetch";
import { registerSW } from "virtual:pwa-register";
import "./index.css";

// Inicializuj Sentry pred renderom
initSentry();

// Registrácia PWA Service Workera pre offline asset caching a auto-update
const updateSW = registerSW({
  onNeedRefresh() {
    console.log("[PWA] K dispozícii je nová verzia aplikácie.");
    updateSW(true);
  },
  onOfflineReady() {
    console.log("[PWA] Aplikácia je pripravená na offline použitie.");
  },
});

void Promise.all([storage.migrateFromLocalStorage(), ensureSession()]).finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
});
