import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface SupabaseSubmissionRecord {
  id: string;
  project_name: string;
  planting_date: string;
  species: string;
  ngo_id: string;
  wallet_address: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  photo_url?: string;
  status: string;
  created_at?: string;
}

export interface SupabaseVerificationRecord {
  submission_id: string;
  verification_status: string;
  score: number | null;
  confidence: string;
  eligibility: boolean;
  ndvi_before: number | null;
  ndvi_after: number | null;
  ndvi_change: number | null;
  blockchain_status: string;
  transaction_hash?: string;
  created_at?: string;
}
