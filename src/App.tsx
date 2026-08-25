import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import SubmitProof from "./pages/SubmitProof";
import History from "./pages/History";
import { OfflineBanner } from "./components/OfflineBanner";
import { initSyncService } from "./services/syncService";
import { seedMockDataIfDev } from "./services/submissionService";

function AppContent() {
  useEffect(() => {
    // Boot sync service on first load
    initSyncService();
    // Seed dev data if flag is set
    seedMockDataIfDev();
  }, []);


  const navItems = [
    { to: "/", label: "Home", icon: "🏠", id: "nav-home" },
    { to: "/submit", label: "Submit", icon: "➕", id: "nav-submit" },
    { to: "/history", label: "History", icon: "📋", id: "nav-history" },
  ];

  return (
    <div className="app-shell">
      {/* Offline banner */}
      <OfflineBanner />

      {/* Main content */}
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/submit" element={<SubmitProof />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>

      {/* Bottom navigation */}
      <nav className="bottom-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            id={item.id}
            className={({ isActive }) =>
              `bottom-nav__item ${isActive ? "bottom-nav__item--active" : ""}`
            }
          >
            <span className="bottom-nav__icon">{item.icon}</span>
            <span className="bottom-nav__label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
