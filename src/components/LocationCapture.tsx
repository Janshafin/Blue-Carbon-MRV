import React from "react";
import type { UseLocationResult } from "../hooks/useLocation";

interface LocationCaptureProps {
  locationResult: UseLocationResult;
  error?: string;
}

export function LocationCapture({ locationResult, error }: LocationCaptureProps) {
  const { location, status, error: locationError, requestLocation } = locationResult;

  const formatCoord = (val: number, isLat: boolean): string => {
    const abs = Math.abs(val);
    const dir = isLat ? (val >= 0 ? "N" : "S") : val >= 0 ? "E" : "W";
    return `${abs.toFixed(4)}° ${dir}`;
  };

  return (
    <div className="location-capture">
      {status === "requesting" && (
        <div className="location-requesting">
          <div className="spinner spinner--green"></div>
          <span>Acquiring GPS location…</span>
        </div>
      )}

      {status === "success" && location && (
        <div className="location-success">
          <div className="location-icon">📍</div>
          <div className="location-details">
            <p className="location-title">Location captured</p>
            <p className="location-coord">{formatCoord(location.latitude, true)}</p>
            <p className="location-coord">{formatCoord(location.longitude, false)}</p>
            {location.accuracy && (
              <p className="location-accuracy">
                Accuracy: ±{Math.round(location.accuracy)} m
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={requestLocation}
            className="btn-refresh-location"
            aria-label="Refresh GPS location"
            title="Refresh location"
          >
            🔄
          </button>
        </div>
      )}

      {(status === "denied" ||
        status === "unavailable" ||
        status === "timeout") && (
        <div className="location-error-box">
          <div className="location-error-icon">⚠️</div>
          <div>
            <p className="location-error-text">{locationError}</p>
            {status === "denied" && (
              <p className="location-error-hint">
                Open browser settings → Site permissions → Location → Allow
              </p>
            )}
            <button
              type="button"
              onClick={requestLocation}
              className="btn-retry-location"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {status === "idle" && (
        <button
          type="button"
          onClick={requestLocation}
          className="btn-get-location"
        >
          📍 Get My Location
        </button>
      )}

      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
