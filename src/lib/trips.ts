import { supabase } from "@/lib/supabaseClient";

export function isIsoDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test((d ?? "").trim());
}

export function ensureIsoDateOrThrow(d: string) {
  const s = (d ?? "").trim();
  if (!isIsoDate(s)) {
    throw new Error(`Data viaggio non valida: "${d}". Usa YYYY-MM-DD (es. 2026-01-16).`);
  }
  return s;
}

export async function getOrCreateTripId(tripDate: string): Promise<string> {
  const iso = ensureIsoDateOrThrow(tripDate);

  const found = await supabase
    .from("trips")
    .select("id")
    .eq("trip_date", iso)
    .eq("status", "OPEN")
    .limit(1);

  if (found.error) throw found.error;
  if (found.data && found.data.length > 0) return found.data[0].id as string;

  const created = await supabase
    .from("trips")
    .insert({ trip_date: iso, status: "OPEN" })
    .select("id")
    .single();

  if (created.error) throw created.error;
  return created.data.id as string;
}

// 2a query: prendi tutte le date dei trip_id presenti nei bancali
export async function fetchTripDateMap(tripIds: string[]) {
  const ids = Array.from(new Set(tripIds.filter(Boolean)));
  const m = new Map<string, string>();
  if (ids.length === 0) return m;

  const { data, error } = await supabase
    .from("trips")
    .select("id, trip_date")
    .in("id", ids);

  if (error) throw error;
  for (const r of data ?? []) m.set(r.id, r.trip_date);
  return m;
}

export function fmtDateLabel(d: string | null | undefined) {
  if (!d) return "—";
  const raw = String(d);
  if (!isIsoDate(raw)) return raw; // la mostro comunque

  try {
    const dt = new Date(raw + "T00:00:00");
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(dt);
  } catch {
    return raw;
  }
}

export function prettyDims(dim: string | null) {
  if (!dim) return "—";
  const parts = dim.split("x").map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 3) return dim;
  return `${parts[0]} × ${parts[1]} × ${parts[2]}`;
}