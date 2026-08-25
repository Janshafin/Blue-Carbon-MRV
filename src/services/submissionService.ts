/**
 * submissionService.ts — Orchestration layer
 *
 * This sits between the UI and the database/sync layer.
 * UI components call these functions — never db or mockApi directly.
 *
 * Flow:
 *   UI → submissionService → IndexedDB → syncService → mockApi
 */

import { v4 as uuidv4 } from "uuid";
import {
  addSubmission,
  getAllSubmissions,
  getSubmissionById,
  getSubmissionStats,
  updateSubmission,
} from "../db/database";
import type { LocationData } from "../types/submission";
import type { Submission, SubmissionStatus } from "../types/submission";
import { syncPendingSubmissions } from "./syncService";

export interface CreateSubmissionInput {
  photo: Blob;
  location: LocationData;
  plantedDate: string;
  treeType: string;
  ngoId: string;
}

export interface SubmissionResult {
  localSuccess: boolean;
  uploadAttempted: boolean;
  uploadSuccess: boolean;
  submissionId: string;
}

/**
 * Create and persist a new submission.
 *
 * Steps:
 * 1. Validate inputs (callers should pre-validate with Zod)
 * 2. Generate a unique local ID
 * 3. Save to IndexedDB with status "pending"
 * 4. Attempt to sync if online
 */
export async function createSubmission(
  input: CreateSubmissionInput
): Promise<SubmissionResult> {
  const id = uuidv4();
  const now = new Date().toISOString();

  const submission: Submission = {
    id,
    photo: input.photo,
    latitude: input.location.latitude,
    longitude: input.location.longitude,
    accuracy: input.location.accuracy,
    plantedDate: input.plantedDate,
    treeType: input.treeType,
    ngoId: input.ngoId,
    status: "pending",
    createdAt: now,
  };

  // Step 1: Save to IndexedDB FIRST — this must succeed before anything else
  await addSubmission(submission);

  const result: SubmissionResult = {
    localSuccess: true,
    uploadAttempted: false,
    uploadSuccess: false,
    submissionId: id,
  };

  // Step 2: Attempt sync if online
  if (navigator.onLine) {
    result.uploadAttempted = true;
    try {
      await syncPendingSubmissions();
      // Check if it was actually synced
      const saved = await getSubmissionById(id);
      result.uploadSuccess = saved?.status === "synced";
    } catch {
      result.uploadSuccess = false;
    }
  }

  return result;
}

export async function fetchAllSubmissions(): Promise<Submission[]> {
  return getAllSubmissions();
}

export async function fetchSubmissionStats() {
  return getSubmissionStats();
}

export async function updateSubmissionStatus(
  id: string,
  status: SubmissionStatus
): Promise<void> {
  await updateSubmission(id, { status });
}

// ─── Development Helper ───────────────────────────────────────────────────────

/**
 * Seed mock data for development/testing.
 * Only runs when VITE_SEED_MOCK_DATA=true.
 */
export async function seedMockDataIfDev(): Promise<void> {
  if (import.meta.env.VITE_SEED_MOCK_DATA !== "true") return;

  const existing = await getAllSubmissions();
  if (existing.length > 0) return; // Don't re-seed

  const treeTypes = ["Rhizophora", "Avicennia", "Sonneratia", "Bruguiera"];
  const statuses: SubmissionStatus[] = ["synced", "synced", "pending", "failed"];

  // Create a simple green placeholder blob for mock photos
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext("2d")!;

  for (let i = 0; i < 4; i++) {
    const hue = 120 + i * 15;
    ctx.fillStyle = `hsl(${hue}, 60%, 40%)`;
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = "white";
    ctx.font = "14px sans-serif";
    ctx.fillText(treeTypes[i].slice(0, 3), 30, 55);

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.8)
    );

    const mockSubmission: Submission = {
      id: uuidv4(),
      photo: blob,
      latitude: 13.0827 + (Math.random() - 0.5) * 0.1,
      longitude: 80.2707 + (Math.random() - 0.5) * 0.1,
      accuracy: Math.floor(Math.random() * 20) + 5,
      plantedDate: new Date(Date.now() - i * 86400000 * 3)
        .toISOString()
        .split("T")[0],
      treeType: treeTypes[i],
      ngoId: "NGO-" + String(1000 + i),
      status: statuses[i],
      createdAt: new Date(Date.now() - i * 86400000 * 3).toISOString(),
      syncedAt:
        statuses[i] === "synced"
          ? new Date(Date.now() - i * 86400000 * 2).toISOString()
          : undefined,
    };

    await addSubmission(mockSubmission);
  }

  console.log("[Dev] 🌱 Seeded 4 mock submissions");
}
