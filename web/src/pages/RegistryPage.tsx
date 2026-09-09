import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import apiClient, { type RegistryProject } from "../services/apiClient";
import "./SubmissionPage.css";

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconLeaf() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

export default function RegistryPage() {
  const [projects, setProjects] = useState<RegistryProject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterSpecies, setFilterSpecies] = useState<string>("all");

  const loadRegistry = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getRegistry();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegistry();
    const interval = setInterval(loadRegistry, 10000);
    return () => clearInterval(interval);
  }, []);

  const uniqueSpecies = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.species) set.add(p.species);
    });
    return Array.from(set);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.ngo_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.wallet_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.submission_id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSpecies = filterSpecies === "all" || p.species === filterSpecies;
      return matchesSearch && matchesSpecies;
    });
  }, [projects, searchQuery, filterSpecies]);

  return (
    <div className="sp-page">
      <div className="sp-global-bg" aria-hidden="true" />

      {/* Header / Nav */}
      <header className="sp-nav" role="banner">
        <div className="sp-nav__inner">
          <Link to="/" className="sp-nav__logo">
            <span className="sp-nav__brand">Blue Carbon MRV</span>
          </Link>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <Link to="/submit" className="sp-btn sp-btn--primary sp-btn--sm">
              <IconPlus />
              <span>Record Proof</span>
            </Link>
            <button
              onClick={loadRegistry}
              className="sp-btn sp-btn--secondary sp-btn--sm"
              title="Refresh Registry"
            >
              <IconRefresh />
              <span>Sync</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="sp-hero">
        <span className="sp-hero__tag">PUBLIC VERIFICATION LEDGER · SEPOLIA ETHEREUM</span>
        <h1 className="sp-hero__title">Live Blue Carbon Registry</h1>
        <p className="sp-hero__subtitle">
          On-chain &amp; satellite-verified mangrove restoration projects with transparent Sentinel-2 NDVI telemetry.
        </p>
      </div>

      {/* Main Content */}
      <main className="sp-main" style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px 60px" }}>
        {/* Controls Bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(10, 25, 35, 0.8)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(56, 189, 248, 0.16)",
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", gap: "10px", flex: 1, minWidth: "260px", alignItems: "center" }}>
            <span style={{ color: "#64748b" }}><IconSearch /></span>
            <input
              type="text"
              placeholder="Search by project, NGO, wallet address or ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sp-input"
              style={{ margin: 0, height: "38px", fontSize: "0.85rem" }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
              Species:
            </span>
            <select
              value={filterSpecies}
              onChange={(e) => setFilterSpecies(e.target.value)}
              className="sp-select"
              style={{ minWidth: "170px", margin: 0, height: "38px", fontSize: "0.85rem" }}
            >
              <option value="all">All Species ({projects.length})</option>
              {uniqueSpecies.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && projects.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div className="sp-spinner" style={{ margin: "0 auto 16px" }} />
            <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>Loading verified records from ledger…</p>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "16px 20px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              color: "#fca5a5",
              marginBottom: "24px",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredProjects.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              background: "rgba(10, 25, 35, 0.6)",
              borderRadius: "12px",
              border: "1px dashed rgba(56, 189, 248, 0.2)",
            }}
          >
            <div style={{ color: "#38bdf8", marginBottom: "14px" }}><IconLeaf /></div>
            <h3 style={{ color: "#f1f5f9", marginBottom: "8px", fontSize: "1.1rem" }}>No Records Found</h3>
            <p style={{ color: "#94a3b8", maxWidth: "450px", margin: "0 auto 20px", fontSize: "0.875rem" }}>
              {searchQuery || filterSpecies !== "all"
                ? "No verified projects match your search criteria."
                : "No verified projects have been registered yet. Record the first planting proof to initialize the ledger."}
            </p>
            <Link to="/submit" className="sp-btn sp-btn--primary sp-btn--md">
              <IconPlus />
              <span>Record Planting Proof</span>
            </Link>
          </div>
        )}

        {/* Projects Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "20px" }}>
          {filteredProjects.map((proj) => (
            <div
              key={proj.submission_id}
              style={{
                background: "rgba(10, 25, 35, 0.82)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(56, 189, 248, 0.2)",
                borderRadius: "12px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 6px 24px rgba(0, 0, 0, 0.35)",
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid rgba(56, 189, 248, 0.1)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#f1f5f9", margin: 0 }}>
                    {proj.project_name}
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", fontFamily: "var(--sp-font-mono)" }}>
                    ID: {proj.submission_id.slice(0, 8)}…{proj.submission_id.slice(-4)}
                  </span>
                </div>
                <span
                  style={{
                    padding: "3px 9px",
                    borderRadius: "4px",
                    fontSize: "0.6875rem",
                    fontFamily: "var(--sp-font-mono)",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    background:
                      proj.status === "CREDITED"
                        ? "rgba(34, 197, 94, 0.15)"
                        : "rgba(56, 189, 248, 0.15)",
                    color: proj.status === "CREDITED" ? "#4ade80" : "#38bdf8",
                    border: `1px solid ${
                      proj.status === "CREDITED" ? "rgba(34, 197, 94, 0.35)" : "rgba(56, 189, 248, 0.35)"
                    }`,
                  }}
                >
                  {proj.status}
                </span>
              </div>

              {/* Photo preview */}
              <div style={{ height: "160px", position: "relative", background: "#051017" }}>
                <img
                  src={apiClient.getPhotoUrl(proj.submission_id)}
                  alt={proj.project_name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: "10px",
                    left: "10px",
                    background: "rgba(5, 12, 20, 0.85)",
                    border: "1px solid rgba(56, 189, 248, 0.2)",
                    borderRadius: "4px",
                    padding: "3px 8px",
                    fontSize: "0.725rem",
                    color: "#cbd5e1",
                    fontFamily: "var(--sp-font-mono)",
                  }}
                >
                  {proj.location.latitude.toFixed(4)}°, {proj.location.longitude.toFixed(4)}°
                </div>
              </div>

              {/* Card Body */}
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.825rem" }}>
                  <span style={{ color: "#94a3b8" }}>Species</span>
                  <span style={{ color: "#38bdf8", fontWeight: 500 }}>{proj.species}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.825rem" }}>
                  <span style={{ color: "#94a3b8" }}>NGO Organization</span>
                  <span style={{ color: "#f1f5f9" }}>{proj.ngo_id}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.825rem" }}>
                  <span style={{ color: "#94a3b8" }}>Planting Date</span>
                  <span style={{ color: "#f1f5f9", fontFamily: "var(--sp-font-mono)" }}>{proj.planting_date}</span>
                </div>

                <hr style={{ borderColor: "rgba(56, 189, 248, 0.1)", margin: "2px 0" }} />

                {/* Score & Telemetry */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div
                    style={{
                      background: "rgba(56, 189, 248, 0.06)",
                      border: "1px solid rgba(56, 189, 248, 0.18)",
                      borderRadius: "8px",
                      padding: "10px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "0.675rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                      MRV Score
                    </div>
                    <div style={{ fontSize: "1.35rem", fontWeight: 600, color: "#38bdf8", fontFamily: "var(--sp-font-mono)", fontVariantNumeric: "tabular-nums" }}>
                      {proj.verification_score}
                      <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 400 }}>/100</span>
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.02em", fontFamily: "var(--sp-font-mono)" }}>
                      {proj.confidence}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "rgba(34, 197, 94, 0.06)",
                      border: "1px solid rgba(34, 197, 94, 0.18)",
                      borderRadius: "8px",
                      padding: "10px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "0.675rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                      NDVI Delta
                    </div>
                    <div style={{ fontSize: "1.35rem", fontWeight: 600, color: "#4ade80", fontFamily: "var(--sp-font-mono)", fontVariantNumeric: "tabular-nums" }}>
                      {proj.ndvi_improvement !== null ? `+${proj.ndvi_improvement.toFixed(2)}` : "—"}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontFamily: "var(--sp-font-mono)", fontVariantNumeric: "tabular-nums" }}>
                      {proj.ndvi_before !== null ? proj.ndvi_before.toFixed(2) : "—"} →{" "}
                      {proj.ndvi_after !== null ? proj.ndvi_after.toFixed(2) : "—"}
                    </div>
                  </div>
                </div>

                {/* Blockchain Info */}
                <div
                  style={{
                    marginTop: "auto",
                    padding: "9px 12px",
                    background: "rgba(15, 23, 42, 0.65)",
                    border: "1px solid rgba(56, 189, 248, 0.1)",
                    borderRadius: "8px",
                    fontSize: "0.775rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ color: "#64748b" }}>Credits Minted</span>
                    <span style={{ color: "#38bdf8", fontWeight: 600, fontFamily: "var(--sp-font-mono)" }}>{proj.credit_amount} BCC</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#64748b" }}>Sepolia TX</span>
                    {proj.transaction_hash ? (
                      <a
                        href={`https://eth-sepolia.blockscout.com/tx/${proj.transaction_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "#38bdf8",
                          textDecoration: "none",
                          fontFamily: "var(--sp-font-mono)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                      >
                        <span>{proj.transaction_hash.slice(0, 8)}…{proj.transaction_hash.slice(-4)}</span>
                        <IconExternal />
                      </a>
                    ) : (
                      <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Off-chain pending</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
