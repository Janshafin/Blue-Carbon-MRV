import Dexie, { type EntityTable } from "dexie";
import type { Submission } from "../types/submission";

class MangroveDatabase extends Dexie {
  submissions!: EntityTable<Submission, "id">;

  constructor() {
    super("MangroveDB");
    this.version(1).stores({
      submissions:
        "id, status, createdAt, treeType, ngoId, plantedDate",
    });
  }
}

export const db = new MangroveDatabase();

// ─── CRUD Helpers ────────────────────────────────────────────────────────────

export async function addSubmission(submission: Submission): Promise<string> {
  return db.submissions.add(submission);
}

export async function updateSubmission(
  id: string,
  changes: Partial<Submission>
): Promise<number> {
  return db.submissions.update(id, changes);
}

export async function getAllSubmissions(): Promise<Submission[]> {
  return db.submissions.orderBy("createdAt").reverse().toArray();
}

export async function getSubmissionById(
  id: string
): Promise<Submission | undefined> {
  return db.submissions.get(id);
}

export async function getPendingSubmissions(): Promise<Submission[]> {
  return db.submissions
    .where("status")
    .anyOf(["pending", "failed"])
    .toArray();
}

export async function markSubmissionSyncing(id: string): Promise<void> {
  await updateSubmission(id, { status: "syncing" });
}

export async function markSubmissionSynced(id: string): Promise<void> {
  await updateSubmission(id, {
    status: "synced",
    syncedAt: new Date().toISOString(),
  });
}

export async function markSubmissionFailed(id: string): Promise<void> {
  await updateSubmission(id, { status: "failed" });
}

export async function getSubmissionStats() {
  const all = await getAllSubmissions();
  return {
    total: all.length,
    pending: all.filter((s) => s.status === "pending" || s.status === "syncing")
      .length,
    synced: all.filter((s) => s.status === "synced").length,
    failed: all.filter((s) => s.status === "failed").length,
  };
}

export default db;
