import { createClient } from '@supabase/supabase-js';
import { getConfig } from '../env.js';

let client;
// Service-role client: bypasses RLS. Server only. Never ship this key to the browser.
export function db() {
  if (!client) {
    const { supabaseUrl, serviceKey } = getConfig();
    client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
