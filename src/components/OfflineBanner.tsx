import React from "react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="offline-banner">
      <span className="offline-icon">📡</span>
      <div>
        <p className="offline-title">You're offline</p>
        <p className="offline-sub">Your proofs are safely stored on this device.</p>
      </div>
    </div>
  );
}
