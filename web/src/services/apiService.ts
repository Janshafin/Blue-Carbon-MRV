/**
 * apiService.ts — Real backend API layer (replaces mockApi.ts)
 *
 * Handles:
 * 1. Uploading submissions to Supabase
 * 2. Triggering NDVI scoring
 * 3. Fetching submissions for the dashboard
 * 4. Updating submission status (approve/reject/dispute)
 * 5. Fetching activity log
 */

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || "http://127.0.0.1:8000";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SubmissionRow {
  id: string;
  project_name: string;
  region: string;
  species: string;
  ngo_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  planted_date: string;
  photo_url: string | null;
  score: number;
  ndvi_before: number | null;
  ndvi_after: number | null;
  confidence_band: string;
  flags: string[];
  status: string;
  on_chain_tx: string | null;
  on_chain_block: number | null;
  submission_hash: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  beneficiary: string | null;
}

export interface ActivityRow {
  id: string;
  kind: string;
  text: string;
  submission_id: string | null;
  created_at: string;
}

async function backend<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BACKEND_URL}/api/v1${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Backend request failed (${response.status}): ${detail}`);
  }
  return response.json() as Promise<T>;
}

// ─── Submission CRUD ─────────────────────────────────────────────────────────

/**
 * Create a new submission in Supabase and trigger NDVI scoring.
 */
export async function createSubmission(input: {
  projectName: string;
  species: string;
  ngoId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  plantedDate: string;
  photoBase64?: string;
  beneficiary?: string;
}): Promise<{ success: boolean; data?: SubmissionRow; error?: string }> {
  try {
    const result = await backend<{ submission: SubmissionRow }>("/submissions", {
      method: "POST",
      body: JSON.stringify({
        project_name: input.projectName,
        species: input.species,
        ngo_id: input.ngoId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
        claimed_planting_date: input.plantedDate,
        photo_data_url: input.photoBase64,
        beneficiary: input.beneficiary,
        photo_metadata: { gps_latitude: input.latitude, gps_longitude: input.longitude, captured_at: new Date().toISOString() },
      }),
    });
    return { success: true, data: result.submission };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to submit evidence." };
  }
}

/**
 * Fetch all submissions for the dashboard.
 */
export async function fetchAllSubmissions(): Promise<SubmissionRow[]> {
  return backend<SubmissionRow[]>("/submissions");
}

/**
 * Fetch submissions with a specific status.
 */
export async function fetchSubmissionsByStatus(
  status: string
): Promise<SubmissionRow[]> {
  return (await fetchAllSubmissions()).filter((submission) => submission.status === status).sort((a, b) => a.score - b.score);
}

/**
 * Update a submission's status after approval/rejection/dispute.
 */
export async function updateSubmissionStatus(
  id: string,
  status: string,
  txHash?: string,
  blockNumber?: number,
  reviewerNotes?: string
): Promise<boolean> {
  try {
    await backend<SubmissionRow>(`/submissions/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ action: status, reviewer_notes: reviewerNotes || "Reviewer action recorded", tx_hash: txHash, block_number: blockNumber }),
    });
    return true;
  } catch (error) {
    console.error("[API] review update failed", error);
    return false;
  }
}

/**
 * Fetch recent activity log entries.
 */
export async function fetchActivityLog(limit = 10): Promise<ActivityRow[]> {
  return backend<ActivityRow[]>(`/submissions/activity?limit=${limit}`);
}

/**
 * Get dashboard KPI stats.
 */
export async function fetchDashboardStats(): Promise<{
  pending: number;
  approved: number;
  flagged: number;
  disputed: number;
  totalCredits: number;
}> {
  const data = await fetchAllSubmissions();

  return {
    pending: data.filter((s) => s.status === "scored" || s.status === "pending").length,
    approved: data.filter((s) => s.status === "approved").length,
    flagged: data.filter((s) => s.flags && s.flags.length > 0).length,
    disputed: data.filter((s) => s.status === "disputed").length,
    totalCredits: data.filter((s) => s.status === "approved").length * 2140, // avg tCO2e per project
  };
}
