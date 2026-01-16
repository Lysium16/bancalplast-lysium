import { supabase } from "@/lib/supabaseClient";

export async function getOrCreateTripId(tripDate: string): Promise<string> {
  const found = await supabase
    .from("trips")
    .select("id")
    .eq("trip_date", tripDate)
    .eq("status", "OPEN")
    .limit(1);

  if (found.error) throw found.error;
  if (found.data && found.data.length > 0) return found.data[0].id as string;

  const created = await supabase
    .from("trips")
    .insert({ trip_date: tripDate, status: "OPEN" })
    .select("id")
    .single();

  if (created.error) throw created.error;
  return created.data.id as string;
}

// Normalizza la relazione trip: può arrivare come oggetto o array.
export function extractTripDate(tripRel: any): string | null {
  if (!tripRel) return null;
  if (Array.isArray(tripRel)) return tripRel[0]?.trip_date ?? null;
  return tripRel.trip_date ?? null;
}

export function fmtDateLabel(d: string | null | undefined) {
  if (!d) return "—";
  try {
    const dt = new Date(d + "T00:00:00");
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(dt);
  } catch {
    return d;
  }
}

export function prettyDims(dim: string | null) {
  if (!dim) return "—";
  const parts = dim.split("x").map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 3) return dim;
  return `${parts[0]} × ${parts[1]} × ${parts[2]}`;
}