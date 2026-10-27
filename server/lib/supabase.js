import { createClient } from '@supabase/supabase-js';
import { env } from '../env.js';

// Service-role client: bypasses RLS. SERVER ONLY. Never import this from src/.
export const admin = env.features.supabase
  ? createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
