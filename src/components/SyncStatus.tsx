import React from "react";
import type { SubmissionStatus } from "../types/submission";

interface SyncStatusProps {
  status: SubmissionStatus;
  compact?: boolean;
}

const statusConfig: Record<
  SubmissionStatus,
  { emoji: string; label: string; className: string }
> = {
  pending: {
    emoji: "🟡",
    label: "Pending upload",
    className: "status-pending",
  },
  syncing: {
    emoji: "🔵",
    label: "Syncing...",
    className: "status-syncing",
  },
  synced: {
    emoji: "🟢",
    label: "Uploaded",
    className: "status-synced",
  },
  failed: {
    emoji: "🔴",
    label: "Upload failed",
    className: "status-failed",
  },
};

export function SyncStatus({ status, compact = false }: SyncStatusProps) {
  const config = statusConfig[status];

  if (compact) {
    return (
      <span
        className={`sync-badge ${config.className}`}
        title={config.label}
      >
        {config.emoji} {config.label}
      </span>
    );
  }

  return (
    <div className={`sync-status-row ${config.className}`}>
      <span className="sync-emoji">{config.emoji}</span>
      <span className="sync-label">{config.label}</span>
    </div>
  );
}
