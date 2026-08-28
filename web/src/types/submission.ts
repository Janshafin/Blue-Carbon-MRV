export type SubmissionStatus = "pending" | "syncing" | "synced" | "failed";

export interface Submission {
  id: string;
  photo: Blob;
  latitude: number;
  longitude: number;
  accuracy?: number;
  plantedDate: string;
  treeType: string;
  ngoId: string;
  status: SubmissionStatus;
  createdAt: string;
  syncedAt?: string;
}

export interface SubmissionFormData {
  plantedDate: string;
  treeType: string;
  customTreeType?: string;
  ngoId: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface SubmissionStats {
  total: number;
  pending: number;
  synced: number;
  failed: number;
}
