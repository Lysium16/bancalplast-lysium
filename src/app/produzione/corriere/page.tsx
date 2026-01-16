"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { extractTripDate, fmtDateLabel, getOrCreateTripId, prettyDims } from "@/lib/trips";

type Pallet = {
  id: string;
  client: string;
  pallet_no: string;
  bobbins_count: number;
  status: "IN_PROGRESS" | "READY";
  shipping_type: "COURIER";
  dimensions: string | null;
  trip_id: string | null;
  trip: any; // trip:trip_id(trip_date) -> può essere object o array
  sent_at: string | null;
  created_at: string;
};

function formatDims(l: string, p: string, h: string) {
  const L = l.trim();
  const P = p.trim();
  const H = h.trim();
  if (!L || !P || !H) return null;
  // formato salvato: 110x130x150
  return `${L}x${P}x${H}`;
}

export default function ProduzioneCorrierePage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Pallet[]>([]);
  const [query, setQuery] = useState("");

  // form
  const [client, setClient] = useState("");
  const [palletNo, setPalletNo] = useState("");
  const [bobbins, setBobbins] = useState<number>(0);
  const [status, setStatus] = useState<"IN_PROGRESS" | "READY">("IN_PROGRESS");
  const [tripDate, setTripDate] = useState<string>("");

  // misure (3 campi separati)
  const [dimL, setDimL] = useState("");
  const [dimP, setDimP] = useState("");
  const [dimH, setDimH] = useState("");

  async function load() {
    setLoading(true);

    const res = await supabase
      .from("pallets")
      .select(
        "id, client, pallet_no, bobbins_count, status, shipping_type, dimensions, trip_id, sent_at, created_at, trip:trip_id(trip_date)"
      )
      .eq("shipping_type", "COURIER")
      .is("sent_at", null)
      .order("created_at", { ascending: false });

    if (res.error) {
      console.error(res.error);
      setItems([]);
    } else {
      setItems((res.data ?? []) as unknown as Pallet[]);
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

  async function add() {
    const c = client.trim();
    const p = palletNo.trim();

    if (!c || !p) {
      alert("Inserisci Cliente e N. bancale.");
      return;
    }

    const dims = formatDims(dimL, dimP, dimH);
    if (!dims) {
      alert("Inserisci tutte le misure (L, P, H).");
      return;
    }

    try {
      let trip_id: string | null = null;
      if (tripDate) trip_id = await getOrCreateTripId(tripDate);

      const { error } = await supabase.from("pallets").insert({
        client: c,
        pallet_no: p,
        bobbins_count: Number.isFinite(bobbins) ? bobbins : 0,
        status,
        shipping_type: "COURIER",
        dimensions: dims,
        trip_id,
      });

      if (error) throw error;

      setClient("");
      setPalletNo("");
      setBobbins(0);
      setStatus("IN_PROGRESS");
      setTripDate("");
      setDimL("");
      setDimP("");
      setDimH("");

      await load();
    } catch (e) {
      console.error(e);
      alert("Errore salvataggio (vedi console F12).");
    }
  }

  async function toggleStatus(id: string, current: Pallet["status"]) {
    const next = current === "READY" ? "IN_PROGRESS" : "READY";
    const { error } = await supabase.from("pallets").update({ status: next }).eq("id", id);
    if (error) {
      console.error(error);
      alert("Errore aggiornamento stato (F12).");
      return;
    }
    await load();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    return items.filter((p) => {
      const td = extractTripDate(p.trip) ?? "";
      return (
        p.client.toLowerCase().includes(q) ||
        p.pallet_no.toLowerCase().includes(q) ||
        td.toLowerCase().includes(q) ||
        (p.dimensions ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  // ordinamento per cliente (come produzione camion)
  const ordered = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => a.client.localeCompare(b.client));
    return arr;
  }, [filtered]);

  return (
    <main className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
              Produzione · Corriere
            </h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Misure obbligatorie. Data viaggio salva davvero (trip_id) e si vede ovunque.
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

        <div className="grid gap-3 md:grid-cols-6">
          <input
            className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 md:col-span-2"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
            placeholder="Cliente"
            value={client}
            onChange={(e) => setClient(e.target.value)}
          />
          <input
            className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
            placeholder="N. bancale"
            value={palletNo}
            onChange={(e) => setPalletNo(e.target.value)}
          />
          <input
            type="number"
            className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
            placeholder="N. bobine"
            value={bobbins}
            onChange={(e) => setBobbins(parseInt(e.target.value || "0", 10))}
            min={0}
          />
          <input
            type="date"
            className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
            value={tripDate}
            onChange={(e) => setTripDate(e.target.value)}
            title="Data viaggio (opzionale)"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            <option value="IN_PROGRESS">In completamento</option>
            <option value="READY">Pronto</option>
          </select>

          <div className="md:col-span-6 grid grid-cols-3 gap-3">
            <input
              className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
              placeholder="L (es 110)"
              value={dimL}
              onChange={(e) => setDimL(e.target.value)}
            />
            <input
              className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
              placeholder="P (es 130)"
              value={dimP}
              onChange={(e) => setDimP(e.target.value)}
            />
            <input
              className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
              placeholder="H (es 150)"
              value={dimH}
              onChange={(e) => setDimH(e.target.value)}
            />
          </div>

          <div className="md:col-span-6 flex justify-end">
            <button
              onClick={add}
              className="rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
              style={{ background: "var(--text)", color: "var(--bg)" }}
            >
              Aggiungi
            </button>
          </div>
        </div>

        <input
          className="w-full rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
          placeholder="Cerca cliente / bancale / data / misure…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      {loading && (
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          Caricamento…
        </div>
      )}

      {!loading && ordered.length === 0 && (
        <div
          className="rounded-3xl border p-6 text-sm shadow-sm"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--muted)" }}
        >
          Nessun bancale corriere.
        </div>
      )}

      {!loading && (
        <div className="space-y-2">
          {ordered.map((p) => {
            const td = extractTripDate(p.trip);
            return (
              <div
                key={p.id}
                className="rounded-3xl border p-5 shadow-sm flex items-start justify-between gap-4"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold truncate" style={{ color: "var(--text)" }}>
                      {p.client}
                    </div>
                    <Link
                      href={`/produzione/bancali/${p.id}`}
                      className="text-xs font-semibold underline underline-offset-4"
                      style={{ color: "var(--text)" }}
                    >
                      Dettaglio
                    </Link>
                  </div>

                  <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                    Bancale <span style={{ color: "var(--text)", fontWeight: 700 }}>{p.pallet_no}</span> · Bobine{" "}
                    <span style={{ color: "var(--text)", fontWeight: 700 }}>{p.bobbins_count}</span>
                  </div>

                  <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                    Misure:{" "}
                    <span style={{ color: "var(--text)", fontWeight: 800 }}>
                      {prettyDims(p.dimensions)}
                    </span>
                  </div>

                  <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                    Viaggio:{" "}
                    <span style={{ color: "var(--text)", fontWeight: 800 }}>
                      {fmtDateLabel(td)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => toggleStatus(p.id, p.status)}
                  className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{
                    background: p.status === "READY" ? "rgba(16,185,129,0.18)" : "rgba(234,179,8,0.18)",
                    color: "var(--text)",
                    borderColor: "var(--border)",
                  }}
                >
                  {p.status === "READY" ? "Pronto" : "In completamento"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}