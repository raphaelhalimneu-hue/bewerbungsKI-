import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://bsdfaidadvdojyeiqcqj.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzZGZhaWRhZHZkb2p5ZWlxY3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODAzMDQsImV4cCI6MjA5MzA1NjMwNH0.UjDfb-w1-ABTiE4S_xp1Zx4wkecZ3S7icbEcooZobSk";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
