"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Trip = {
  id: string;
  trip_date: string; // YYYY-MM-DD
  status: "OPEN" | "SHIPPED";
  shipped_at: string | null;
};

type Pallet = {
  id: string;
  client: string;
  pallet_no: string;
  bobbins_count: number;
  shipping_type: "TRUCK" | "COURIER";
  dimensions: string | null;
  trip_id: string | null;
  sent_at: string | null;
};

function fmtDate(d: string) {
  try {
    const dt = new Date(d + "T00:00:00");
    return new Intl.DateTimeFormat("it-IT", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(dt);
  } catch {
    return d;
  }
}

function parseDims(s: string | null) {
  if (!s) return { l: "", p: "", h: "" };
  const parts = s.split("x").map((v) => v.trim());
  return { l: parts[0] ?? "", p: parts[1] ?? "", h: parts[2] ?? "" };
}

export default function UfficioViaggiSpeditiPage() {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  async function load() {
    setLoading(true);

    const tRes = await supabase
      .from("trips")
      .select("id, trip_date, status, shipped_at")
      .eq("status", "SHIPPED")
      .order("trip_date", { ascending: false });

    if (tRes.error) console.error(tRes.error);
    setTrips((tRes.data ?? []) as Trip[]);

    const pRes = await supabase
      .from("pallets")
      .select("id, client, pallet_no, bobbins_count, shipping_type, dimensions, trip_id, sent_at")
      .not("sent_at", "is", null)
      .order("client", { ascending: true });

    if (pRes.error) console.error(pRes.error);
    setPallets((pRes.data ?? []) as Pallet[]);

    setLoading(false);
  }

  useEffect(() => {
    load();

    const onFocus = () => load();
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  function toggleOne(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) {
      alert("Seleziona almeno un bancale.");
      return;
    }
    if (!confirm(`Eliminare definitivamente ${selectedIds.length} bancali?`)) return;

    const { error } = await supabase.from("pallets").delete().in("id", selectedIds);
    if (error) {
      console.error(error);
      alert("Errore eliminazione (vedi console F12).");
      return;
    }

    setSelected({});
    await load();
  }

  async function deleteTrip(tripId: string, tripTitle: string) {
    if (!confirm(`Eliminare definitivamente il viaggio "${tripTitle}" e TUTTI i bancali associati?`)) return;

    // 1) elimina bancali del viaggio (spediti o comunque collegati)
    const pDel = await supabase.from("pallets").delete().eq("trip_id", tripId);
    if (pDel.error) {
      console.error(pDel.error);
      alert("Errore eliminazione bancali del viaggio (vedi console F12).");
      return;
    }

    // 2) elimina viaggio
    const tDel = await supabase.from("trips").delete().eq("id", tripId);
    if (tDel.error) {
      console.error(tDel.error);
      alert("Errore eliminazione viaggio (vedi console F12).");
      return;
    }

    setSelected({});
    await load();
  }

  const filteredPallets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pallets;

    return pallets.filter((p) => {
      return (
        p.client.toLowerCase().includes(q) ||
        p.pallet_no.toLowerCase().includes(q) ||
        (p.dimensions ?? "").toLowerCase().includes(q)
      );
    });
  }, [pallets, query]);

  const palletsByTrip = useMemo(() => {
    const m = new Map<string, Pallet[]>();
    for (const p of filteredPallets) {
      const key = p.trip_id ?? "NONE";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }

    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => {
        const c = a.client.localeCompare(b.client);
        if (c !== 0) return c;
        return a.pallet_no.localeCompare(b.pallet_no);
      });
      m.set(k, arr);
    }

    return m;
  }, [filteredPallets]);

  const tripBlocks = useMemo(() => {
    const blocks: Array<{ title: string; tripId: string; items: Pallet[] }> = [];

    for (const t of trips) {
      blocks.push({
        title: `Viaggio: ${fmtDate(t.trip_date)}`,
        tripId: t.id,
        items: palletsByTrip.get(t.id) ?? [],
      });
    }

    const none = palletsByTrip.get("NONE") ?? [];
    if (none.length > 0) {
      blocks.push({ title: "Senza viaggio (spediti)", tripId: "NONE", items: none });
    }

    return blocks;
  }, [trips, palletsByTrip]);

  return (
    <main className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Ufficio · Viaggi spediti
            </h1>
            <p className="text-sm text-zinc-700">
              Solo visura + pulizia definitiva.
            </p>
          </div>

          <button
            onClick={load}
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 active:scale-[0.99]"
          >
            Aggiorna
          </button>
        </div>

        <input
          className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
          placeholder="Cerca cliente / bancale / misure…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-zinc-700">
            Selezionati: <span className="font-semibold text-zinc-900">{selectedIds.length}</span>
          </div>
          <button
            onClick={deleteSelected}
            className="rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 active:scale-[0.99]"
          >
            Elimina selezionati
          </button>
        </div>
      </header>

      {loading && <div className="text-sm text-zinc-600">Caricamento…</div>}

      {!loading && tripBlocks.length === 0 && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm">
          Nessun viaggio spedito.
        </div>
      )}

      {!loading &&
        tripBlocks.map((b) => (
          <section key={b.tripId} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-zinc-900">{b.title}</div>

              {b.tripId !== "NONE" && (
                <button
                  onClick={() => deleteTrip(b.tripId, b.title)}
                  className="rounded-2xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50 active:scale-[0.99]"
                >
                  Elimina viaggio (e bancali)
                </button>
              )}
            </div>

            {b.items.length === 0 ? (
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 text-sm text-zinc-700 shadow-sm">
                Nessun bancale associato.
              </div>
            ) : (
              <div className="space-y-2">
                {b.items.map((p) => {
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
                        Spedito
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        ))}
    </main>
  );
}