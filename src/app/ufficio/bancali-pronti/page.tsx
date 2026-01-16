"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Trip = {
  id: string;
  trip_date: string; // YYYY-MM-DD
  status: "OPEN" | "SHIPPED";
};

type PalletRow = {
  id: string;
  client: string;
  pallet_no: string;
  bobbins_count: number;
  status: "READY" | "IN_PROGRESS";
  shipping_type: "TRUCK" | "COURIER";
  dimensions: string | null;
  trip_id: string | null;
  sent_at: string | null;
  created_at: string;
  trips?: { trip_date: string } | null; // join
};

function fmtDate(d: string) {
  // d = YYYY-MM-DD
  try {
    const dt = new Date(d + "T00:00:00");
    return new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(dt);
  } catch {
    return d;
  }
}

function parseDims(s: string | null) {
  if (!s) return { l: "", p: "", h: "" };
  const parts = s.split("x").map((v) => v.trim());
  return { l: parts[0] ?? "", p: parts[1] ?? "", h: parts[2] ?? "" };
}

export default function UfficioBancaliProntiPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PalletRow[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [query, setQuery] = useState("");

  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // create/assign trip
  const [newTripDate, setNewTripDate] = useState<string>("");
  const [assignTripId, setAssignTripId] = useState<string>("");

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  async function load() {
    setLoading(true);

    const tripsRes = await supabase
      .from("trips")
      .select("id, trip_date, status")
      .eq("status", "OPEN")
      .order("trip_date", { ascending: true });

    if (tripsRes.error) console.error(tripsRes.error);
    setTrips((tripsRes.data ?? []) as Trip[]);

    const palletsRes = await supabase
      .from("pallets")
      .select("id, client, pallet_no, bobbins_count, status, shipping_type, dimensions, trip_id, sent_at, created_at, trips(trip_date)")
      .eq("status", "READY")
      .is("sent_at", null)
      .order("created_at", { ascending: false });

    if (palletsRes.error) {
      console.error(palletsRes.error);
      alert("Errore caricamento (vedi console F12).");
      setItems([]);
    } else {
      setItems((palletsRes.data ?? []) as PalletRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function toggleOne(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function toggleAllInGroup(ids: string[], on: boolean) {
    setSelected((s) => {
      const next = { ...s };
      ids.forEach((id) => (next[id] = on));
      return next;
    });
  }

  async function createTrip() {
    if (!newTripDate) {
      alert("Seleziona una data viaggio.");
      return;
    }

    const { data, error } = await supabase
      .from("trips")
      .insert({ trip_date: newTripDate, status: "OPEN" })
      .select("id, trip_date, status")
      .single();

    if (error) {
      console.error(error);
      alert("Errore creazione viaggio (vedi console F12).");
      return;
    }

    const t = data as Trip;
    setAssignTripId(t.id);
    setNewTripDate("");
    await load();
  }

  async function assignToTrip() {
    if (!assignTripId) {
      alert("Seleziona un viaggio.");
      return;
    }
    if (selectedIds.length === 0) {
      alert("Seleziona almeno un bancale.");
      return;
    }

    const { error } = await supabase
      .from("pallets")
      .update({ trip_id: assignTripId })
      .in("id", selectedIds);

    if (error) {
      console.error(error);
      alert("Errore assegnazione (vedi console F12).");
      return;
    }

    setSelected({});
    await load();
  }

  async function markSent() {
    if (selectedIds.length === 0) {
      alert("Seleziona almeno un bancale.");
      return;
    }

    // set sent_at now
    const { data: updated, error } = await supabase
      .from("pallets")
      .update({ sent_at: new Date().toISOString() })
      .in("id", selectedIds)
      .select("id, trip_id");

    if (error) {
      console.error(error);
      alert("Errore invio (vedi console F12).");
      return;
    }

    // mark trips as shipped (semplice e stabile: se hai inviato bancali di quel viaggio, lo segniamo shipped)
    const tripIds = Array.from(new Set((updated ?? []).map((r: any) => r.trip_id).filter(Boolean)));
    if (tripIds.length > 0) {
      const tRes = await supabase
        .from("trips")
        .update({ status: "SHIPPED", shipped_at: new Date().toISOString() })
        .in("id", tripIds);

      if (tRes.error) console.error(tRes.error);
    }

    setSelected({});
    await load();
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) {
      alert("Seleziona almeno un bancale.");
      return;
    }
    if (!confirm(`Eliminare ${selectedIds.length} bancali?`)) return;

    const { error } = await supabase.from("pallets").delete().in("id", selectedIds);

    if (error) {
      console.error(error);
      alert("Errore eliminazione (vedi console F12).");
      return;
    }

    setSelected({});
    await load();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    return items.filter((p) => {
      const dims = p.dimensions ?? "";
      return (
        p.client.toLowerCase().includes(q) ||
        p.pallet_no.toLowerCase().includes(q) ||
        dims.toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  const grouped = useMemo(() => {
    // key: trip_date or "NONE"
    const m = new Map<string, PalletRow[]>();

    for (const p of filtered) {
      const tripDate = p.trips?.trip_date ?? null;
      const key = tripDate ?? "NONE";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }

    // sort groups: NONE first, then by date asc
    const keys = Array.from(m.keys()).sort((a, b) => {
      if (a === "NONE" && b !== "NONE") return -1;
      if (b === "NONE" && a !== "NONE") return 1;
      return a.localeCompare(b);
    });

    // sort inside each group: client alpha, then pallet_no
    const result = keys.map((k) => {
      const arr = m.get(k)!;
      arr.sort((x, y) => {
        const c = x.client.localeCompare(y.client);
        if (c !== 0) return c;
        return x.pallet_no.localeCompare(y.pallet_no);
      });
      return { key: k, items: arr };
    });

    return result;
  }, [filtered]);

  return (
    <main className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Ufficio · Bancali pronti
            </h1>
            <p className="text-sm text-zinc-700">
              Solo visione + selezione. Qui si assegnano ai viaggi, si inviano, si eliminano.
            </p>
          </div>

          <button
            onClick={load}
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm active:scale-[0.99]"
          >
            Aggiorna
          </button>
        </div>

        <input
          className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
          placeholder="Cerca cliente, bancale o misure…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      {/* Actions */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="text-xs font-semibold tracking-[0.18em] text-zinc-500">CREA VIAGGIO</div>
            <div className="mt-2 flex gap-2">
              <input
                type="date"
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={newTripDate}
                onChange={(e) => setNewTripDate(e.target.value)}
              />
              <button
                onClick={createTrip}
                className="shrink-0 rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
              >
                +
              </button>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="text-xs font-semibold tracking-[0.18em] text-zinc-500">ASSEGNA A VIAGGIO</div>
            <div className="mt-2 space-y-2">
              <select
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={assignTripId}
                onChange={(e) => setAssignTripId(e.target.value)}
              >
                <option value="">Seleziona viaggio…</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {fmtDate(t.trip_date)}
                  </option>
                ))}
              </select>

              <button
                onClick={assignToTrip}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-sm active:scale-[0.99]"
              >
                Inserisci i selezionati nel viaggio
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="text-xs font-semibold tracking-[0.18em] text-zinc-500">AZIONI</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button
                onClick={markSent}
                className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
              >
                Invia (sposta in spediti)
              </button>
              <button
                onClick={deleteSelected}
                className="w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 shadow-sm active:scale-[0.99]"
              >
                Elimina selezionati
              </button>
            </div>

            <div className="mt-2 text-xs text-zinc-600">
              Selezionati: <span className="font-semibold text-zinc-900">{selectedIds.length}</span>
            </div>
          </div>
        </div>
      </section>

      {/* List */}
      <section className="space-y-4">
        {loading && <p className="text-sm text-zinc-600">Caricamento…</p>}

        {!loading && grouped.length === 0 && (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm">
            Nessun bancale pronto.
          </div>
        )}

        {grouped.map((g) => {
          const groupIds = g.items.map((x) => x.id);
          const allOn = groupIds.every((id) => selected[id]);
          const anyOn = groupIds.some((id) => selected[id]);

          const title =
            g.key === "NONE" ? "Senza viaggio" : `Viaggio: ${fmtDate(g.key)}`;

          return (
            <div key={g.key} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-zinc-900">{title}</div>
                <button
                  onClick={() => toggleAllInGroup(groupIds, !allOn)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 shadow-sm active:scale-[0.99]"
                >
                  {allOn ? "Deseleziona gruppo" : anyOn ? "Completa selezione gruppo" : "Seleziona gruppo"}
                </button>
              </div>

              <div className="space-y-2">
                {g.items.map((p) => {
                  const dims = parseDims(p.dimensions);
                  const dimsPretty =
                    p.shipping_type === "COURIER" && dims.l && dims.p && dims.h
                      ? `${dims.l} × ${dims.p} × ${dims.h}`
                      : null;

                  return (
                    <label
                      key={p.id}
                      className="flex items-start justify-between gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 accent-black"
                          checked={!!selected[p.id]}
                          onChange={() => toggleOne(p.id)}
                        />

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-base font-semibold text-zinc-900">
                              {p.client}
                            </div>

                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                p.shipping_type === "COURIER"
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-zinc-100 text-zinc-800"
                              }`}
                            >
                              {p.shipping_type === "COURIER" ? "Corriere" : "Camion"}
                            </span>
                          </div>

                          <div className="mt-1 text-sm text-zinc-700">
                            Bancale <span className="font-medium">{p.pallet_no}</span> ·
                            Bobine <span className="font-medium">{p.bobbins_count}</span>
                          </div>

                          {dimsPretty && (
                            <div className="mt-2 text-xs text-zinc-600">
                              Misure: <span className="font-semibold text-zinc-800">{dimsPretty}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                        Pronto
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}