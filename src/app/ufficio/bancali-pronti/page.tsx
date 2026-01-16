"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TripRel = { trip_date: string };

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
  // Supabase può restituire relazione come array
  trips: TripRel[] | null;
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

export default function UfficioBancaliProntiPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PalletRow[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  async function load() {
    setLoading(true);

    // Pronti = READY e NON inviati
    // Join trip_date per raggruppare/ordinare in UI
    const palletsRes = await supabase
      .from("pallets")
      .select(
        "id, client, pallet_no, bobbins_count, status, shipping_type, dimensions, trip_id, sent_at, created_at, trips:trip_id(trip_date)"
      )
      .eq("status", "READY")
      .is("sent_at", null)
      .order("created_at", { ascending: false });

    if (palletsRes.error) {
      console.error(palletsRes.error);
      alert("Errore caricamento (vedi console F12).");
      setItems([]);
    } else {
      // Tipizzazione robusta: passa per unknown
      setItems(((palletsRes.data ?? []) as unknown) as PalletRow[]);
    }

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

  function selectAllVisible(visible: PalletRow[]) {
    const next: Record<string, boolean> = { ...selected };
    for (const p of visible) next[p.id] = true;
    setSelected(next);
  }

  function clearAllVisible(visible: PalletRow[]) {
    const next: Record<string, boolean> = { ...selected };
    for (const p of visible) delete next[p.id];
    setSelected(next);
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

  async function sendSelected() {
    if (selectedIds.length === 0) {
      alert("Seleziona almeno un bancale.");
      return;
    }
    if (!confirm(`Confermi INVIO di ${selectedIds.length} bancali?`)) return;

    const { error } = await supabase
      .from("pallets")
      .update({ sent_at: new Date().toISOString() })
      .in("id", selectedIds);

    if (error) {
      console.error(error);
      alert("Errore invio (vedi console F12).");
      return;
    }

    setSelected({});
    await load();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    return items.filter((p) => {
      const tripDate = p.trips?.[0]?.trip_date ?? "";
      return (
        p.client.toLowerCase().includes(q) ||
        p.pallet_no.toLowerCase().includes(q) ||
        tripDate.toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  // Raggruppo per data viaggio (se assente: "Senza viaggio")
  const grouped = useMemo(() => {
    const map = new Map<string, PalletRow[]>();

    for (const p of filtered) {
      const tripDate = p.trips?.[0]?.trip_date ?? "";
      const key = tripDate ? tripDate : "SENZA_VIAGGIO";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }

    // ordina clienti alfabetico dentro ogni gruppo
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const c = a.client.localeCompare(b.client);
        if (c !== 0) return c;
        return a.pallet_no.localeCompare(b.pallet_no);
      });
      map.set(k, arr);
    }

    // ordina gruppi per data (desc), con "Senza viaggio" in alto
    const keys = Array.from(map.keys());
    keys.sort((a, b) => {
      if (a === "SENZA_VIAGGIO") return -1;
      if (b === "SENZA_VIAGGIO") return 1;
      return b.localeCompare(a);
    });

    return keys.map((k) => ({ key: k, items: map.get(k)! }));
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
              Solo visione + selezione: invio ed elimina. Raggruppo per data viaggio e clienti alfabetico.
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
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--text)",
            outlineColor: "var(--ring)",
          }}
          placeholder="Cerca cliente / bancale / data viaggio…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div
          className="rounded-3xl border p-4 shadow-sm flex flex-wrap items-center justify-between gap-3"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            Selezionati: <span style={{ color: "var(--text)", fontWeight: 700 }}>{selectedIds.length}</span>
          </div>

          <div className="flex flex-wrap gap-2">
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
            <button
              onClick={sendSelected}
              className="rounded-2xl px-4 py-2 text-xs font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
              style={{ background: "var(--text)", color: "var(--bg)" }}
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

      {loading && <div className="text-sm" style={{ color: "var(--muted)" }}>Caricamento…</div>}

      {!loading && grouped.length === 0 && (
        <div className="rounded-3xl border p-6 text-sm shadow-sm" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--muted)" }}>
          Nessun bancale pronto.
        </div>
      )}

      {!loading &&
        grouped.map((g) => (
          <section key={g.key} className="space-y-2">
            <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              {g.key === "SENZA_VIAGGIO" ? "Senza viaggio" : `Viaggio: ${fmtDate(g.key)}`}
            </div>

            <div className="space-y-2">
              {g.items.map((p) => (
                <label
                  key={p.id}
                  className="flex items-start justify-between gap-4 rounded-3xl border p-5 shadow-sm"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5"
                      checked={!!selected[p.id]}
                      onChange={() => toggleOne(p.id)}
                    />

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
                        Bancale <span style={{ color: "var(--text)", fontWeight: 600 }}>{p.pallet_no}</span> ·
                        Bobine <span style={{ color: "var(--text)", fontWeight: 600 }}>{p.bobbins_count}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ background: "rgba(16,185,129,0.18)", color: "var(--text)", border: "1px solid var(--border)" }}
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