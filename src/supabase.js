import { createClient } from '@supabase/supabase-js';

// Reads keys from .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
// If they are missing the site still runs; only Supabase features
// (projects list, comments, dashboard login) will be empty/unavailable.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn("Supabase keys not set - running without Supabase (projects/comments/login disabled).");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
