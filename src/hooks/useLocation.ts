import { useCallback, useEffect, useRef, useState } from "react";
import type { LocationData } from "../types/submission";

export type LocationStatus =
  | "idle"
  | "requesting"
  | "success"
  | "denied"
  | "unavailable"
  | "timeout";

export interface UseLocationResult {
  location: LocationData | null;
  status: LocationStatus;
  error: string | null;
  requestLocation: () => void;
}

export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      setError("Geolocation is not supported by this browser.");
      return;
    }

    setStatus("requesting");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setStatus("success");
        setError(null);
      },
      (err) => {
        switch (err.code) {
          case GeolocationPositionError.PERMISSION_DENIED:
            setStatus("denied");
            setError(
              "Location permission denied. Please enable location access in your browser settings to submit a proof."
            );
            break;
          case GeolocationPositionError.POSITION_UNAVAILABLE:
            setStatus("unavailable");
            setError(
              "Location information is unavailable. Please try again outdoors."
            );
            break;
          case GeolocationPositionError.TIMEOUT:
            setStatus("timeout");
            setError("Location request timed out. Please try again.");
            break;
          default:
            setStatus("unavailable");
            setError("An unknown error occurred while getting location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  }, []);

  // Auto-request on mount
  useEffect(() => {
    requestLocation();
    const currentWatchIdRef = watchIdRef;
    return () => {
      if (currentWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(currentWatchIdRef.current);
      }
    };
  }, [requestLocation]);

  return { location, status, error, requestLocation };
}
