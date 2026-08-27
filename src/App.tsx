import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SubmissionPage from "./pages/SubmissionPage";
import { initSyncService } from "./services/syncService";
import { seedMockDataIfDev } from "./services/submissionService";

export default function App() {
  useEffect(() => {
    initSyncService();
    seedMockDataIfDev();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SubmissionPage />} />
        <Route path="/submit" element={<SubmissionPage />} />
        <Route path="/submission" element={<SubmissionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
