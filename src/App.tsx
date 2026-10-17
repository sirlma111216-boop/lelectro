import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { useSessionStore } from './poe/sessionStore';
import { useSettingsStore } from './poe/settingsStore';
import { HomePage } from './pages/HomePage';
import { InquiryPage } from './pages/InquiryPage';
import { SessionsPage } from './pages/SessionsPage';
import { TeacherPage } from './pages/TeacherPage';
import { ReportPage } from './pages/ReportPage';

export default function App() {
  const load = useSessionStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);
  useEffect(() => {
    void load();
    void loadSettings();
  }, [load, loadSettings]);

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/inquiry/:inquiryId/:sessionId" element={<InquiryPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/teacher" element={<TeacherPage />} />
        <Route path="/report/all" element={<ReportPage all />} />
        <Route path="/report/:sessionId" element={<ReportPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
