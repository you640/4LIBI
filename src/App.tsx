import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { SherlockPage } from "./pages/SherlockPage";
import { FilesPage } from "./pages/FilesPage";
import { CaseLayout } from "./pages/CaseLayout";
import { ProfilePage } from "./pages/ProfilePage";
import { RozporyTab } from "./components/case/RozporyTab";
import { TimelineTab } from "./components/case/TimelineTab";
import { GrafTab } from "./components/case/GrafTab";
import { OsobyTab } from "./components/case/OsobyTab";
import { initAnalytics } from "./lib/analytics";
import { initUtmTracking } from "./lib/utmTracker";

export default function App() {
  useEffect(() => {
    initUtmTracking();
    initAnalytics();
  }, []);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/spisy" replace />} />
            <Route path="/sherlock" element={<SherlockPage />} />
            <Route path="/spisy" element={<FilesPage />} />
            <Route path="/spisy/:id" element={<CaseLayout />}>
              <Route index element={<Navigate to="rozpory" replace />} />
              <Route path="rozpory" element={<RozporyTab />} />
              <Route path="timeline" element={<TimelineTab />} />
              <Route path="graf" element={<GrafTab />} />
              <Route path="osoby" element={<OsobyTab />} />
            </Route>
            <Route path="/profil" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/spisy" replace />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}
