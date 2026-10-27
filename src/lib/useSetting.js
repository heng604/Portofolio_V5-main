import { useEffect, useState } from "react";
import { supabase } from "../supabase";

// All public site_settings rows are fetched ONCE and shared by every component.
// Values are stored as {"text": "..."}; a missing/empty value falls back to the built-in default,
// so the site never breaks when the table is empty or Supabase is unreachable.
let cache = null;
let inflight = null;
const listeners = new Set();

function load(force = false) {
  if (!force && inflight) return inflight;
  inflight = supabase.from("site_settings").select("key,value").then(({ data }) => {
    const o = {};
    (data || []).forEach((r) => {
      const v = r.value?.text;
      if (typeof v === "string" && v.trim()) o[r.key] = v;
    });
    cache = o;
    listeners.forEach((fn) => fn(o));
    return o;
  }).catch(() => { cache = cache || {}; return cache; });
  return inflight;
}

export function useSettings() {
  const [all, setAll] = useState(cache || {});
  useEffect(() => {
    listeners.add(setAll);
    load();
    return () => { listeners.delete(setAll); };
  }, []);
  return all;
}

export function useSetting(key, fallback = "") {
  const all = useSettings();
  return all[key] ?? fallback;
}

// Call after the dashboard saves so open tabs/pages pick up the change without a reload.
export const refreshSettings = () => load(true);
