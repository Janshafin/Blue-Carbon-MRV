import React, { useEffect, useState } from "react";
import type { Submission } from "../types/submission";
import { SyncStatus } from "./SyncStatus";

interface SubmissionCardProps {
  submission: Submission;
}

export function SubmissionCard({ submission }: SubmissionCardProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!submission.photo) return;
    const url = URL.createObjectURL(submission.photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [submission.photo]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatCoord = (val: number, isLat: boolean): string => {
    const abs = Math.abs(val);
    const dir = isLat ? (val >= 0 ? "N" : "S") : val >= 0 ? "E" : "W";
    return `${abs.toFixed(4)}° ${dir}`;
  };

  return (
    <div className="submission-card">
      <div className="submission-card__photo">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`${submission.treeType} tree planted on ${submission.plantedDate}`}
            className="submission-card__img"
          />
        ) : (
          <div className="submission-card__no-photo">🌿</div>
        )}
        <div className="submission-card__status-badge">
          <SyncStatus status={submission.status} compact />
        </div>
      </div>

      <div className="submission-card__body">
        <div className="submission-card__header">
          <h3 className="submission-card__tree-type">{submission.treeType}</h3>
          <span className="submission-card__date">
            {formatDate(submission.plantedDate)}
          </span>
        </div>

        <div className="submission-card__meta">
          <div className="meta-row">
            <span className="meta-icon">📍</span>
            <span className="meta-text">
              {formatCoord(submission.latitude, true)},{" "}
              {formatCoord(submission.longitude, false)}
              {submission.accuracy && (
                <span className="meta-accuracy">
                  {" "}±{Math.round(submission.accuracy)}m
                </span>
              )}
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-icon">🏢</span>
            <span className="meta-text">{submission.ngoId}</span>
          </div>
          <div className="meta-row">
            <span className="meta-icon">🕒</span>
            <span className="meta-text">
              Recorded {formatDate(submission.createdAt)}
            </span>
          </div>
          {submission.syncedAt && (
            <div className="meta-row">
              <span className="meta-icon">☁️</span>
              <span className="meta-text">
                Uploaded {formatDate(submission.syncedAt)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
