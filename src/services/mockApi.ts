/**
 * mockApi.ts — Simulated backend API
 *
 * This file is the ONLY place that talks to a "backend".
 * When the real backend is ready, replace the `uploadSubmission`
 * function body with a real fetch() / axios call.
 *
 * Connection point for real backend:
 *   Replace the contents of uploadSubmission() with:
 *   const response = await fetch("https://api.bluecarbonregistry.org/v1/submissions", {
 *     method: "POST",
 *     body: formData, // multipart: photo + GPS + metadata
 *     headers: { Authorization: `Bearer ${token}` }
 *   });
 *   return response.json();
 */

import type { Submission } from "../types/submission";

// ─── Development / Testing Flag ──────────────────────────────────────────────
// Set VITE_SIMULATE_FAILURE=true in .env.local to test failure/retry behavior
const SIMULATE_FAILURE = import.meta.env.VITE_SIMULATE_FAILURE === "true";

// Simulate a random failure rate when SIMULATE_FAILURE is true (50% failure)
const FAILURE_RATE = 0.5;

// Simulated network delay in milliseconds
const SIMULATED_DELAY_MS = 1500;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UploadResponse {
  success: boolean;
  submissionId: string;
  status: "received" | "error";
  message?: string;
}

// ─── Mock API ────────────────────────────────────────────────────────────────

/**
 * Simulates uploading a submission to the backend.
 *
 * REAL BACKEND CONNECTION POINT:
 * Replace this entire function with a real API call when backend is ready.
 * The function signature must remain:
 *   uploadSubmission(submission: Submission): Promise<UploadResponse>
 */
export async function uploadSubmission(
  submission: Submission
): Promise<UploadResponse> {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY_MS));

  // Simulate failure for testing offline/retry behavior
  if (SIMULATE_FAILURE && Math.random() < FAILURE_RATE) {
    throw new Error(
      "Simulated upload failure (VITE_SIMULATE_FAILURE=true). " +
        "This tests the offline/retry behavior."
    );
  }

  // Simulate successful response from backend
  return {
    success: true,
    submissionId: submission.id,
    status: "received",
  };
}
