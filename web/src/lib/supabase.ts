import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || supabaseUrl.includes("YOUR_PROJECT")) {
  console.warn(
    "[Supabase] ⚠️  VITE_SUPABASE_URL is not configured. " +
      "Set it in web/.env.local to connect to a real database."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder"
);

/** Returns true if Supabase credentials are properly configured. */
export function isSupabaseConfigured(): boolean {
  return (
    !!supabaseUrl &&
    !supabaseUrl.includes("YOUR_PROJECT") &&
    !!supabaseAnonKey &&
    !supabaseAnonKey.includes("YOUR_ANON_KEY")
  );
}
