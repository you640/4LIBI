import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { HomePage } from "./pages/HomePage";
import { SherlockPage } from "./pages/SherlockPage";
import { FilesPage } from "./pages/FilesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { initAnalytics } from "./lib/analytics";
import { initUtmTracking } from "./lib/utmTracker";

export default function App() {
  useEffect(() => {
    // S3.2.1 — UTM tracking bootstrap na boote
    initUtmTracking();
    // S1.3 — PostHog inicializácia
    initAnalytics();
  }, []);

  return (
    <BrowserRouter>
      <div className="app-shell bg-bg">
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/sherlock" element={<SherlockPage />} />
            <Route path="/spisy" element={<FilesPage />} />
            <Route path="/profil" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}
