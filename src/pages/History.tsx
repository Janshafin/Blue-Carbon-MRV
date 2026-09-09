import React, { useCallback, useEffect, useState } from "react";
import { SubmissionCard } from "../components/SubmissionCard";
import { fetchAllSubmissions } from "../services/submissionService";
import { syncPendingSubmissions } from "../services/syncService";
import type { Submission } from "../types/submission";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

type FilterType = "all" | "pending" | "synced" | "failed";

interface FilterConfig {
  label: string;
  emoji: string;
  value: FilterType;
}

const FILTERS: FilterConfig[] = [
  { label: "All", emoji: "📋", value: "all" },
  { label: "Pending", emoji: "🟡", value: "pending" },
  { label: "Uploaded", emoji: "🟢", value: "synced" },
  { label: "Failed", emoji: "🔴", value: "failed" },
];

function matchesFilter(
  submission: Submission,
  filter: FilterType
): boolean {
  if (filter === "all") return true;
  if (filter === "pending")
    return submission.status === "pending" || submission.status === "syncing";
  return submission.status === filter;
}

export default function History() {
  const isOnline = useOnlineStatus();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [syncing, setSyncing] = useState(false);

  const loadSubmissions = useCallback(async () => {
    try {
      const all = await fetchAllSubmissions();
      setSubmissions(all);
    } catch (err) {
      console.error("Failed to load submissions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
    const interval = setInterval(loadSubmissions, 4000);
    return () => clearInterval(interval);
  }, [loadSubmissions]);

  const handleSync = async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    try {
      await syncPendingSubmissions();
      await loadSubmissions();
    } finally {
      setSyncing(false);
    }
  };

  const filtered = submissions.filter((s) => matchesFilter(s, filter));

  const counts = {
    all: submissions.length,
    pending: submissions.filter(
      (s) => s.status === "pending" || s.status === "syncing"
    ).length,
    synced: submissions.filter((s) => s.status === "synced").length,
    failed: submissions.filter((s) => s.status === "failed").length,
  };

  return (
    <div className="page page--history">
      <div className="page-header">
        <h1 className="page-title">Registry History</h1>
        <p className="page-subtitle">
          {submissions.length} total submission{submissions.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Sync button */}
      {isOnline && counts.pending > 0 && (
        <button
          id="sync-now-btn"
          className={`btn-sync ${syncing ? "btn-sync--syncing" : ""}`}
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <>
              <div className="spinner spinner--sm"></div>
              Syncing…
            </>
          ) : (
            <>⬆️ Upload {counts.pending} pending</>
          )}
        </button>
      )}

      {/* Filter tabs */}
      <div className="filter-tabs" role="tablist" aria-label="Filter submissions">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            id={`filter-${f.value}`}
            className={`filter-tab ${filter === f.value ? "filter-tab--active" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.emoji} {f.label}
            {counts[f.value] > 0 && (
              <span className="filter-count">{counts[f.value]}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner spinner--green"></div>
          <p>Loading submissions…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🌿</div>
          <p className="empty-title">
            {filter === "all"
              ? "No submissions yet"
              : `No ${filter} submissions`}
          </p>
          {filter === "all" && (
            <p className="empty-sub">
              Go to Submit to record your first tree!
            </p>
          )}
        </div>
      ) : (
        <div className="submissions-list">
          {filtered.map((submission) => (
            <SubmissionCard key={submission.id} submission={submission} />
          ))}
        </div>
      )}
    </div>
  );
}
