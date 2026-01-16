"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fmtDateLabel, getOrCreateTripId, prettyDims } from "@/lib/trips";

type PalletRow = {
  id: string;
  client: string;
  pallet_no: string;
  bobbins_count: number;
  status: "IN_PROGRESS" | "READY";
  shipping_type: "TRUCK" | "COURIER";
  dimensions: string | null;
  trip_id: string | null;
  sent_at: string | null;
  created_at: string;
  trip_date: string | null; // calcolata in app
};

async function fetchTripDateMap(tripIds: string[]) {
  if (tripIds.length === 0) return new Map<string, string>();

  const { data, error } = await supabase
    .from("trips")
    .select("id, trip_date")
    .in("id", tripIds);

  if (error) {
    console.error("fetchTripDateMap error", error);
    return new Map<string, string>();
  }

  const m = new Map<string, string>();
  for (const r of data ?? []) m.set(r.id, r.trip_date);
  return m;
}

export default function UfficioBancaliProntiPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PalletRow[]>([]);
  const [query, setQuery] = useState("");

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [assignTripDate, setAssignTripDate] = useState<string>("");

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
    [selected]
  );

  async function load() {
    setLoading(true);

    const res = await supabase
      .from("pallets")
      .select("id, client, pallet_no, bobbins_count, status, shipping_type, dimensions, trip_id, sent_at, created_at")
      .eq("status", "READY")
      .is("sent_at", null)
      .order("created_at", { ascending: false });

    if (res.error) {
      console.error(res.error);
      setItems([]);
      setLoading(false);
      return;
    }

    const raw = (res.data ?? []) as any[];

    const tripIds = Array.from(new Set(raw.map(r => r.trip_id).filter(Boolean))) as string[];
    const tripMap = await fetchTripDateMap(tripIds);

    const withTrip: PalletRow[] = raw.map(r => ({
      id: r.id,
      client: r.client,
      pallet_no: r.pallet_no,
      bobbins_count: r.bobbins_count ?? 0,
      status: r.status,
      shipping_type: r.shipping_type,
      dimensions: r.dimensions ?? null,
      trip_id: r.trip_id ?? null,
      sent_at: r.sent_at ?? null,
      created_at: r.created_at,
      trip_date: r.trip_id ? (tripMap.get(r.trip_id) ?? null) : null,
    }));

    setItems(withTrip);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const onFocus = () => load();
    const onVis = () => { if (document.visibilityState === "visible") load(); };
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

  function selectAllVisible(list: PalletRow[]) {
    const next = { ...selected };
    for (const p of list) next[p.id] = true;
    setSelected(next);
  }

  function clearAllVisible(list: PalletRow[]) {
    const next = { ...selected };
    for (const p of list) delete next[p.id];
    setSelected(next);
  }

  async function assignTripToSelected() {
    if (selectedIds.length === 0) return alert("Seleziona almeno un bancale.");
    if (!assignTripDate) return alert("Seleziona una data viaggio.");

    try {
      const tripId = await getOrCreateTripId(assignTripDate);

      const { error } = await supabase
        .from("pallets")
        .update({ trip_id: tripId })
        .in("id", selectedIds);

      if (error) throw error;

      await load();
    } catch (e) {
      console.error(e);
      alert("Errore assegnazione data (F12).");
    }
  }

  async function markSentSelected() {
    if (selectedIds.length === 0) return alert("Seleziona almeno un bancale.");
    if (!confirm(`Inviare ${selectedIds.length} bancali? Verranno spostati tra gli spediti.`)) return;

    const nowIso = new Date().toISOString();

    const tripIds = Array.from(
      new Set(items.filter(p => selected[p.id] && p.trip_id).map(p => p.trip_id as string))
    );

    const { error } = await supabase
      .from("pallets")
      .update({ sent_at: nowIso })
      .in("id", selectedIds);

    if (error) {
      console.error(error);
      alert("Errore invio (F12).");
      return;
    }

    if (tripIds.length > 0) {
      const t = await supabase
        .from("trips")
        .update({ status: "SHIPPED", shipped_at: nowIso })
        .in("id", tripIds);

      if (t.error) console.error("Trip update error", t.error);
    }

    setSelected({});
    await load();
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) return alert("Seleziona almeno un bancale.");
    if (!confirm(`Eliminare definitivamente ${selectedIds.length} bancali?`)) return;

    const { error } = await supabase.from("pallets").delete().in("id", selectedIds);
    if (error) {
      console.error(error);
      alert("Errore eliminazione (F12).");
      return;
    }

    setSelected({});
    await load();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    return items.filter((p) => {
      const td = p.trip_date ?? "";
      return (
        p.client.toLowerCase().includes(q) ||
        p.pallet_no.toLowerCase().includes(q) ||
        td.toLowerCase().includes(q) ||
        (p.dimensions ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, PalletRow[]>();

    for (const p of filtered) {
      const key = p.trip_date ? p.trip_date : "SENZA_VIAGGIO";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => a.client.localeCompare(b.client));
      map.set(k, arr);
    }

    const keys = Array.from(map.keys());
    keys.sort((a, b) => {
      if (a === "SENZA_VIAGGIO") return -1;
      if (b === "SENZA_VIAGGIO") return 1;
      return a.localeCompare(b);
    });

    return keys.map((key) => ({ key, items: map.get(key)! }));
  }, [filtered]);

  return (
    <main className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
              Ufficio · Bancali pronti
            </h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Raggruppati per Data viaggio → Cliente. Misure corriere visibili.
            </p>
          </div>

          <button
            onClick={load}
            className="rounded-2xl border px-4 py-2 text-sm font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            Aggiorna
          </button>
        </div>

        <input
          className="w-full rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
          placeholder="Cerca cliente / bancale / data / misure…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div
          className="rounded-3xl border p-4 shadow-sm flex flex-wrap items-center justify-between gap-3"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            Selezionati: <span style={{ color: "var(--text)", fontWeight: 800 }}>{selectedIds.length}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => selectAllVisible(filtered)}
              className="rounded-2xl border px-3 py-2 text-xs font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
            >
              Seleziona tutti
            </button>
            <button
              onClick={() => clearAllVisible(filtered)}
              className="rounded-2xl border px-3 py-2 text-xs font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
            >
              Deseleziona
            </button>

            <input
              type="date"
              value={assignTripDate}
              onChange={(e) => setAssignTripDate(e.target.value)}
              className="rounded-2xl border px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
            />

            <button
              onClick={assignTripToSelected}
              className="rounded-2xl border px-4 py-2 text-xs font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
            >
              Assegna data
            </button>

            <button
              onClick={markSentSelected}
              className="rounded-2xl border px-4 py-2 text-xs font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
            >
              Invia
            </button>

            <button
              onClick={deleteSelected}
              className="rounded-2xl border px-4 py-2 text-xs font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
              style={{ background: "var(--card)", borderColor: "#ef4444", color: "#ef4444" }}
            >
              Elimina
            </button>
          </div>
        </div>
      </header>

      {!loading && grouped.length === 0 && (
        <div className="rounded-3xl border p-6 text-sm shadow-sm" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--muted)" }}>
          Nessun bancale pronto.
        </div>
      )}

      {!loading &&
        grouped.map((g) => (
          <section key={g.key} className="space-y-2">
            <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              {g.key === "SENZA_VIAGGIO" ? "Senza viaggio" : `Viaggio: ${fmtDateLabel(g.key)}`}
            </div>

            <div className="space-y-2">
              {g.items.map((p) => (
                <label
                  key={p.id}
                  className="flex items-start justify-between gap-4 rounded-3xl border p-5 shadow-sm"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1 h-5 w-5" checked={!!selected[p.id]} onChange={() => toggleOne(p.id)} />

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-base font-semibold" style={{ color: "var(--text)" }}>
                          {p.client}
                        </div>

                        <span
                          className="rounded-full px-2 py-1 text-xs font-semibold"
                          style={{
                            background: p.shipping_type === "COURIER" ? "rgba(56,189,248,0.18)" : "rgba(148,163,184,0.18)",
                            color: "var(--text)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {p.shipping_type === "COURIER" ? "Corriere" : "Camion"}
                        </span>
                      </div>

                      <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                        Bancale <span style={{ color: "var(--text)", fontWeight: 700 }}>{p.pallet_no}</span> · Bobine{" "}
                        <span style={{ color: "var(--text)", fontWeight: 700 }}>{p.bobbins_count}</span>
                      </div>

                      {p.shipping_type === "COURIER" && (
                        <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                          Misure: <span style={{ color: "var(--text)", fontWeight: 800 }}>{prettyDims(p.dimensions)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <span
                    className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold"
                    style={{ background: "rgba(16,185,129,0.18)", color: "var(--text)", borderColor: "var(--border)" }}
                  >
                    Pronto
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
    </main>
  );
}