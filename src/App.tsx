import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import SubmitProof from "./pages/SubmitProof";
import History from "./pages/History";
import SubmissionPage from "./pages/SubmissionPage";
import RegistryPage from "./pages/RegistryPage";
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
        <Route path="/home" element={<Home />} />
        <Route path="/submit" element={<SubmissionPage />} />
        <Route path="/submit-pwa" element={<SubmitProof />} />
        <Route path="/history" element={<History />} />
        <Route path="/registry" element={<RegistryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
