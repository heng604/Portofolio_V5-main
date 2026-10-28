import { createClient } from '@supabase/supabase-js';

// Browser client: ANON key only (public by design, protected by RLS + public.is_admin()).
// The service-role key never reaches this bundle.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';
export const supabaseConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
export const supabase = createClient(url, key);
