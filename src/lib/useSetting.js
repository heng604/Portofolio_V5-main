import { useEffect, useState } from "react";
import { supabase } from "../supabase";

// Reads a public value from site_settings (stored as {"text": "..."}).
// Falls back to `fallback` when the table/row is missing, so the site never breaks.
export function useSetting(key, fallback = "") {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    let alive = true;
    supabase.from("site_settings").select("value").eq("key", key).maybeSingle().then(({ data }) => {
      const v = data?.value?.text;
      if (alive && typeof v === "string" && v.trim()) setValue(v);
    });
    return () => { alive = false; };
  }, [key]);
  return value;
}
