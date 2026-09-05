/**
 * Centralized API client for Blue Carbon MRV Backend.
 * Uses VITE_API_URL environment variable with fallback to http://localhost:8000.
 */

const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export interface SubmissionResponse {
  success: boolean;
  submission_id: string;
  status: string;
  message: string;
}

export interface VerificationDetail {
  submission_id: string;
  verification_status: string;
  ndvi_before: number | null;
  ndvi_after: number | null;
  ndvi_change: number | null;
  score: number | null;
  confidence: "low" | "medium" | "high" | null;
  flags: string[];
  satellite_imagery_information: {
    source: string;
    is_simulated: boolean;
    resolution: string;
    sensor: string;
  };
  eligibility: boolean;
  blockchain_status: "unregistered" | "pending" | "provisional" | "released" | "disputed" | "rejected" | "failed";
  transaction_hash: string | null;
  blockchain_error: string | null;
  timestamps: {
    created_at: string | null;
    updated_at: string | null;
    verified_at: string | null;
  };
}

export interface RegistryProject {
  submission_id: string;
  project_name: string;
  species: string;
  ngo_id: string;
  location: {
    latitude: number;
    longitude: number;
  };
  planting_date: string;
  verification_score: number;
  confidence: "low" | "medium" | "high";
  ndvi_before: number | null;
  ndvi_after: number | null;
  ndvi_improvement: number | null;
  status: string;
  verification_status: string;
  wallet_address: string;
  blockchain_status: string;
  transaction_hash: string | null;
  credit_amount: string;
  photo_url: string;
  created_at: string;
}

export interface RegistryResponse {
  success: boolean;
  total_count: number;
  projects: RegistryProject[];
}

export interface HealthResponse {
  status: string;
  database: {
    connected: boolean;
    engine: string;
  };
  satellite: {
    mock_mode: boolean;
    copernicus_configured: boolean;
    provider: string;
  };
  blockchain: {
    network: string;
    contract_configured: boolean;
    rpc_configured: boolean;
    verifier_configured: boolean;
    has_verifier_role: boolean;
    details: Record<string, unknown>;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  getPhotoUrl(submissionId: string): string {
    return `${this.baseUrl}/api/evidence/${submissionId}/photo`;
  }

  async checkHealth(): Promise<HealthResponse> {
    const res = await fetch(`${this.baseUrl}/api/health`);
    if (!res.ok) {
      throw new Error(`Health check failed with HTTP ${res.status}`);
    }
    return res.json();
  }

  async submitPlanting(formData: FormData): Promise<SubmissionResponse> {
    const res = await fetch(`${this.baseUrl}/api/submissions`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      let detail = `Submission failed with HTTP ${res.status}`;
      try {
        const errorData = await res.json();
        detail = errorData.detail || detail;
      } catch {
        // Fallback to text
      }
      throw new Error(detail);
    }

    return res.json();
  }

  async getSubmission(id: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/api/submissions/${encodeURIComponent(id)}`);
    if (!res.ok) {
      throw new Error(`Failed to load submission: HTTP ${res.status}`);
    }
    return res.json();
  }

  async getVerification(id: string): Promise<VerificationDetail> {
    const res = await fetch(
      `${this.baseUrl}/api/submissions/${encodeURIComponent(id)}/verification`
    );
    if (!res.ok) {
      throw new Error(`Failed to load verification: HTTP ${res.status}`);
    }
    return res.json();
  }

  async getRegistry(): Promise<RegistryResponse> {
    const res = await fetch(`${this.baseUrl}/api/registry`);
    if (!res.ok) {
      throw new Error(`Failed to load registry: HTTP ${res.status}`);
    }
    return res.json();
  }

  async getEvidence(id: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/api/evidence/${encodeURIComponent(id)}`);
    if (!res.ok) {
      throw new Error(`Failed to load evidence: HTTP ${res.status}`);
    }
    return res.json();
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
