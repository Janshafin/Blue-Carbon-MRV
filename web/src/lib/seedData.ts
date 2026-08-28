/**
 * seedData.ts — Seed realistic test submissions into Supabase
 *
 * Uses real Indian mangrove restoration coordinates and plausible scoring data.
 * Called once from the dashboard to populate the system for demo purposes.
 */

import { supabase, isSupabaseConfigured } from "./supabase";

export interface SeedSubmission {
  project_name: string;
  region: string;
  species: string;
  ngo_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  planted_date: string;
  score: number;
  ndvi_before: number;
  ndvi_after: number;
  confidence_band: string;
  flags: string[];
  status: string;
  beneficiary: string;
}

const SEED_SUBMISSIONS: SeedSubmission[] = [
  {
    project_name: "Sundarbans Mangrove Block 7",
    region: "West Bengal",
    species: "Avicennia marina",
    ngo_id: "NGO-WB-2024",
    latitude: 21.9497,
    longitude: 88.8981,
    accuracy: 8,
    planted_date: "2024-03-15",
    score: 34,
    ndvi_before: 0.18,
    ndvi_after: 0.24,
    confidence_band: "low",
    flags: ["no_meaningful_vegetation_increase", "photo_gps_mismatch"],
    status: "scored",
    beneficiary: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD78",
  },
  {
    project_name: "Chotanagpur Bamboo Corridor",
    region: "Jharkhand",
    species: "Bambusa tulda",
    ngo_id: "NGO-JH-2024",
    latitude: 23.3441,
    longitude: 85.3096,
    accuracy: 12,
    planted_date: "2024-01-20",
    score: 19,
    ndvi_before: 0.15,
    ndvi_after: 0.17,
    confidence_band: "low",
    flags: ["low_current_vegetation", "photo_timestamp_mismatch"],
    status: "scored",
    beneficiary: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  },
  {
    project_name: "Kutch Mangrove Revival",
    region: "Gujarat",
    species: "Avicennia marina",
    ngo_id: "NGO-GJ-2024",
    latitude: 23.7337,
    longitude: 69.8597,
    accuracy: 6,
    planted_date: "2024-06-10",
    score: 57,
    ndvi_before: 0.22,
    ndvi_after: 0.41,
    confidence_band: "medium",
    flags: [],
    status: "scored",
    beneficiary: "0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec",
  },
  {
    project_name: "Western Ghats Buffer Restoration",
    region: "Kerala",
    species: "Rhizophora mucronata",
    ngo_id: "NGO-KL-2024",
    latitude: 9.9312,
    longitude: 76.2673,
    accuracy: 5,
    planted_date: "2024-02-01",
    score: 88,
    ndvi_before: 0.25,
    ndvi_after: 0.72,
    confidence_band: "high",
    flags: [],
    status: "scored",
    beneficiary: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  },
  {
    project_name: "Nilgiri Shola Restoration",
    region: "Tamil Nadu",
    species: "Rhizophora apiculata",
    ngo_id: "NGO-TN-2024",
    latitude: 11.4102,
    longitude: 76.6950,
    accuracy: 4,
    planted_date: "2024-04-22",
    score: 91,
    ndvi_before: 0.30,
    ndvi_after: 0.78,
    confidence_band: "high",
    flags: [],
    status: "scored",
    beneficiary: "0xFABB0ac9d68B0B445fB7357272Ff202C5651694a",
  },
  {
    project_name: "Coromandel Coastal Shelterbelt",
    region: "Tamil Nadu",
    species: "Avicennia officinalis",
    ngo_id: "NGO-TN-2024",
    latitude: 10.7657,
    longitude: 79.8424,
    accuracy: 7,
    planted_date: "2024-05-08",
    score: 95,
    ndvi_before: 0.28,
    ndvi_after: 0.82,
    confidence_band: "high",
    flags: [],
    status: "scored",
    beneficiary: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  },
  {
    project_name: "Pichavaram Mangrove Extension",
    region: "Tamil Nadu",
    species: "Rhizophora mucronata",
    ngo_id: "NGO-TN-2024",
    latitude: 11.4290,
    longitude: 79.7752,
    accuracy: 3,
    planted_date: "2024-07-14",
    score: 82,
    ndvi_before: 0.35,
    ndvi_after: 0.71,
    confidence_band: "high",
    flags: [],
    status: "scored",
    beneficiary: "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe",
  },
  {
    project_name: "Vindhya Dry Forest Reclaim",
    region: "Madhya Pradesh",
    species: "Sonneratia alba",
    ngo_id: "NGO-MP-2024",
    latitude: 23.2599,
    longitude: 77.4126,
    accuracy: 15,
    planted_date: "2024-08-03",
    score: 47,
    ndvi_before: 0.20,
    ndvi_after: 0.33,
    confidence_band: "medium",
    flags: ["photo_gps_mismatch"],
    status: "scored",
    beneficiary: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
  },
  {
    project_name: "Aravalli Greenbelt Phase II",
    region: "Rajasthan",
    species: "Bruguiera gymnorrhiza",
    ngo_id: "NGO-RJ-2024",
    latitude: 26.9124,
    longitude: 75.7873,
    accuracy: 10,
    planted_date: "2024-09-18",
    score: 65,
    ndvi_before: 0.19,
    ndvi_after: 0.48,
    confidence_band: "medium",
    flags: [],
    status: "scored",
    beneficiary: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  },
];

export async function seedSubmissions(): Promise<{ inserted: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { inserted: 0, error: "Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in web/.env.local" };
  }

  // Check if already seeded
  const { count } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true });

  if (count && count > 0) {
    return { inserted: 0, error: `Already seeded (${count} rows exist)` };
  }

  const { data, error } = await supabase
    .from("submissions")
    .insert(SEED_SUBMISSIONS)
    .select();

  if (error) {
    console.error("[Seed] ❌ Error:", error);
    return { inserted: 0, error: error.message };
  }

  // Seed activity log
  const activities = [
    { kind: "submit", text: "Coromandel Coastal Shelterbelt submitted — awaiting scoring" },
    { kind: "flag", text: "Chotanagpur Bamboo Corridor flagged — NDVI growth delta below threshold" },
    { kind: "submit", text: "Western Ghats Buffer Restoration submitted — NDVI score 88" },
    { kind: "flag", text: "Vindhya Dry Forest Reclaim flagged — geolocation mismatch" },
    { kind: "submit", text: "Nilgiri Shola Restoration submitted — NDVI score 91" },
    { kind: "submit", text: "Pichavaram Mangrove Extension submitted — NDVI score 82" },
  ];

  await supabase.from("activity_log").insert(activities);

  console.log(`[Seed] 🌱 Inserted ${data?.length ?? 0} submissions`);
  return { inserted: data?.length ?? 0 };
}
