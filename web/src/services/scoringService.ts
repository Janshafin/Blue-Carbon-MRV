/**
 * scoringService.ts — Calls the NDVI plausibility scoring backend
 *
 * When the NDVI scoring service is running (locally or deployed),
 * this calls it to get a real Sentinel-2 NDVI score.
 * The score is accepted only from the configured scoring service. A failed
 * request must be visible to the caller; substituting a local score would make
 * an unverified claim look like satellite-derived evidence.
 */

const SCORING_API_URL =
  (import.meta.env.VITE_SCORING_API_URL as string) || "http://127.0.0.1:8001";

export interface ScoringResult {
  score: number;
  confidence_band: "low" | "medium" | "high";
  flags: string[];
  ndvi_before: number | null;
  ndvi_after: number | null;
}

/**
 * Score a submission by calling the NDVI scoring microservice.
 * Throws when the scoring service is unavailable so submissions are never
 * persisted with a fabricated score.
 */
export async function scoreSubmission(
  latitude: number,
  longitude: number,
  plantingDate: string
): Promise<ScoringResult> {
  try {
    const response = await fetch(`${SCORING_API_URL}/score-submission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude,
        longitude,
        claimed_planting_date: plantingDate,
        photo_metadata: {
          gps_latitude: latitude,
          gps_longitude: longitude,
          captured_at: new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Scoring service returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Live NDVI scoring is unavailable: ${detail}`);
  }
}
