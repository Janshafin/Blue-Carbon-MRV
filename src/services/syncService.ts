/**
 * syncService.ts — Background synchronization engine
 *
 * Responsible for:
 * 1. Finding pending/failed submissions in IndexedDB
 * 2. Uploading them to the backend (via mockApi)
 * 3. Marking them synced or failed accordingly
 * 4. Listening for the "online" event to auto-trigger
 *
 * Data is NEVER deleted — only status is updated.
 */

import {
  getPendingSubmissions,
  markSubmissionFailed,
  markSubmissionSynced,
  markSubmissionSyncing,
} from "../db/database";
import { uploadSubmission } from "./mockApi";

let isSyncing = false;

export async function syncPendingSubmissions(): Promise<void> {
  // Prevent concurrent sync runs
  if (isSyncing) return;
  if (!navigator.onLine) return;

  isSyncing = true;

  try {
    const pending = await getPendingSubmissions();

    if (pending.length === 0) {
      return;
    }

    console.log(`[SyncService] Found ${pending.length} pending submission(s). Syncing...`);

    for (const submission of pending) {
      try {
        // Mark as syncing (UI shows blue spinner)
        await markSubmissionSyncing(submission.id);

        // Attempt upload via the API layer
        const response = await uploadSubmission(submission);

        if (response.success) {
          await markSubmissionSynced(submission.id);
          console.log(`[SyncService] ✅ Synced submission ${submission.id}`);
        } else {
          await markSubmissionFailed(submission.id);
          console.warn(`[SyncService] ⚠️ Upload rejected for ${submission.id}:`, response.message);
        }
      } catch (error) {
        // Upload failed (network error, server error, simulated failure)
        // Data is preserved — just mark as failed for retry
        await markSubmissionFailed(submission.id);
        console.error(`[SyncService] ❌ Failed to sync ${submission.id}:`, error);
      }
    }
  } finally {
    isSyncing = false;
  }
}

/**
 * Initialize sync listeners.
 * Call this once at app startup.
 */
export function initSyncService(): void {
  // Auto-sync when internet connectivity returns
  window.addEventListener("online", () => {
    console.log("[SyncService] 🌐 Back online — triggering sync...");
    syncPendingSubmissions();
  });

  // Attempt sync on app start (in case there are pending submissions)
  syncPendingSubmissions();
}
