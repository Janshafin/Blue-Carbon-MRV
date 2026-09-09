import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchSubmissionStats } from "../services/submissionService";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useSync } from "../hooks/useSync";

interface Stats {
  total: number;
  pending: number;
  synced: number;
  failed: number;
}

export default function Home() {
  const isOnline = useOnlineStatus();
  const { triggerSync } = useSync();
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    synced: 0,
    failed: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const loadStats = async () => {
    try {
      const s = await fetchSubmissionStats();
      setStats(s);
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
    // Refresh stats every 5 seconds for live updates
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="page page--home">
      {/* Hero */}
      <div className="home-hero">
        <div className="home-hero__leaf">🌊</div>
        <h1 className="home-hero__title">Blue Carbon MRV</h1>
        <p className="home-hero__subtitle">
          Blockchain-Based Blue Carbon Registry &amp; MRV System
        </p>

        {/* Online/Offline indicator */}
        <div className={`connectivity-pill ${isOnline ? "connectivity-pill--online" : "connectivity-pill--offline"}`}>
          <span className="connectivity-dot"></span>
          {isOnline ? "Online" : "Offline"}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">🌱</span>
          <div className="stat-value">
            {loadingStats ? <span className="stat-skeleton"></span> : stats.total}
          </div>
          <div className="stat-label">Total Submissions</div>
        </div>

        <div className="stat-card stat-card--pending">
          <span className="stat-icon">🟡</span>
          <div className="stat-value">
            {loadingStats ? <span className="stat-skeleton"></span> : stats.pending}
          </div>
          <div className="stat-label">Pending Upload</div>
        </div>

        <div className="stat-card stat-card--synced">
          <span className="stat-icon">🟢</span>
          <div className="stat-value">
            {loadingStats ? <span className="stat-skeleton"></span> : stats.synced}
          </div>
          <div className="stat-label">Uploaded</div>
        </div>

        {stats.failed > 0 && (
          <div className="stat-card stat-card--failed">
            <span className="stat-icon">🔴</span>
            <div className="stat-value">{stats.failed}</div>
            <div className="stat-label">Failed</div>
          </div>
        )}
      </div>

      {/* Pending sync notice */}
      {stats.pending > 0 && isOnline && (
        <button
          className="sync-nudge"
          onClick={async () => {
            await triggerSync();
            loadStats();
          }}
        >
          <span>⬆️</span>
          {stats.pending} submission{stats.pending !== 1 ? "s" : ""} ready to
          upload — Tap to sync
        </button>
      )}

      {/* Main CTA */}
      <Link to="/submit" id="submit-cta-btn" className="btn-cta">
        <span className="btn-cta__icon">+</span>
        Submit Tree Proof
      </Link>

      {/* Quick tips */}
      <div className="home-tips">
        <h2 className="tips-title">How it works</h2>
        <div className="tips-list">
          <div className="tip-item">
            <span className="tip-num">1</span>
            <p className="tip-text">Take a photo of the tree you planted</p>
          </div>
          <div className="tip-item">
            <span className="tip-num">2</span>
            <p className="tip-text">
              Your GPS location is captured automatically
            </p>
          </div>
          <div className="tip-item">
            <span className="tip-num">3</span>
            <p className="tip-text">Submit — works even without internet!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
