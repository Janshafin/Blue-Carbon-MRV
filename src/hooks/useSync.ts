import { useCallback, useEffect } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import { syncPendingSubmissions } from "../services/syncService";

/**
 * useSync — Triggers sync on mount and whenever connectivity returns.
 * Returns a manual trigger function for UI use.
 */
export function useSync() {
  const isOnline = useOnlineStatus();

  const triggerSync = useCallback(async () => {
    if (isOnline) {
      await syncPendingSubmissions();
    }
  }, [isOnline]);

  // Trigger sync when online status changes to true
  useEffect(() => {
    if (isOnline) {
      syncPendingSubmissions();
    }
  }, [isOnline]);

  return { triggerSync };
}
