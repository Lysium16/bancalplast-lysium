"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Pallet = {
  id: string;
  client: string;
  pallet_no: string;
  bobbins_count: number;
  status: "IN_PROGRESS" | "READY";
  shipping_type: "COURIER";
  dimensions: string | null;
  trip_id: string | null;
  sent_at: string | null;
  created_at: string;
};

async function getOrCreateTripId(tripDate: string): Promise<string> {
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

function formatDims(l: string, p: string, h: string) {
  const L = l.trim();
  const P = p.trim();
  const H = h.trim();
  if (!L || !P || !H) return null;
  return `${L}x${P}x${H}`;
}

function prettyDims(s: string | null) {
  if (!s) return "—";
  return s.split("x").map(t => t.trim()).join(" × ");
}

function clsPill(status: "IN_PROGRESS" | "READY") {
  return status === "READY"
    ? "bg-emerald-500/15 border-emerald-500/30"
    : "bg-amber-500/15 border-amber-500/30";
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
  const [tripDate, setTripDate] = useState<string>(""); // YYYY-MM-DD (opzionale)

  // misure: L x P x H
  const [dimL, setDimL] = useState("");
  const [dimP, setDimP] = useState("");
  const [dimH, setDimH] = useState("");

  async function load() {
    setLoading(true);

    const res = await supabase
      .from("pallets")
      .select("id, client, pallet_no, bobbins_count, status, shipping_type, dimensions, trip_id, sent_at, created_at")
      .eq("shipping_type", "COURIER")
      .is("sent_at", null)
      .order("created_at", { ascending: false });

    if (res.error) {
      console.error(res.error);
      setItems([]);
    } else {
      setItems((res.data ?? []) as Pallet[]);
    }

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

  async function addPallet(e: React.FormEvent) {
    e.preventDefault();

    const c = client.trim();
    const p = palletNo.trim();
    if (!c || !p) {
      alert("Cliente e Numero bancale sono obbligatori.");
      return;
    }

    const dims = formatDims(dimL, dimP, dimH);
    if (!dims) {
      alert("Per il corriere le misure sono obbligatorie (L × P × H).");
      return;
    }

    try {
      let trip_id: string | null = null;
      if (tripDate.trim()) {
        trip_id = await getOrCreateTripId(tripDate.trim());
      }

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

      setPalletNo("");
      setBobbins(0);
      setStatus("IN_PROGRESS");
      // tripDate resta per inserimenti multipli
      setDimL(""); setDimP(""); setDimH("");

      await load();
    } catch (err) {
      console.error(err);
      alert("Errore salvataggio (vedi console F12).");
    }
  }

  async function setStatusById(id: string, next: "IN_PROGRESS" | "READY") {
    const { error } = await supabase.from("pallets").update({ status: next }).eq("id", id);
    if (error) {
      console.error(error);
      alert("Errore aggiornamento stato (vedi console F12).");
      return;
    }
    await load();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) =>
      x.client.toLowerCase().includes(q) ||
      x.pallet_no.toLowerCase().includes(q) ||
      (x.dimensions ?? "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const byClient = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const c = a.client.localeCompare(b.client);
      if (c !== 0) return c;
      return a.pallet_no.localeCompare(b.pallet_no);
    });
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
              Inserimento bancali corriere (misure obbligatorie). Ordinamento per cliente.
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

        <div
          className="rounded-3xl border p-5 shadow-sm"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <form onSubmit={addPallet} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Cliente</div>
              <input
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
                style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                placeholder="Es. Porchietto"
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Numero bancale</div>
              <input
                value={palletNo}
                onChange={(e) => setPalletNo(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
                style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                placeholder="Es. C-001"
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Numero bobine</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBobbins((v) => Math.max(0, (v ?? 0) - 1))}
                  className="h-11 w-11 rounded-2xl border text-lg font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
                  style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                >
                  −
                </button>
                <input
                  value={bobbins}
                  onChange={(e) => setBobbins(parseInt(e.target.value || "0", 10))}
                  inputMode="numeric"
                  className="w-full rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
                  style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                />
                <button
                  type="button"
                  onClick={() => setBobbins((v) => (v ?? 0) + 1)}
                  className="h-11 w-11 rounded-2xl border text-lg font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
                  style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                >
                  +
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Stato</div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
                style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
              >
                <option value="IN_PROGRESS">In completamento</option>
                <option value="READY">Pronto</option>
              </select>
            </div>

            <div className="md:col-span-2 space-y-1">
              <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                Misure bancale (obbligatorie) — L × P × H
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <input
                  value={dimL}
                  onChange={(e) => setDimL(e.target.value)}
                  className="w-full rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
                  style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                  placeholder="L (es. 110)"
                />
                <input
                  value={dimP}
                  onChange={(e) => setDimP(e.target.value)}
                  className="w-full rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
                  style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                  placeholder="P (es. 130)"
                />
                <input
                  value={dimH}
                  onChange={(e) => setDimH(e.target.value)}
                  className="w-full rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
                  style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                  placeholder="H (es. 150)"
                />
              </div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                Anteprima: <span style={{ color: "var(--text)", fontWeight: 700 }}>{prettyDims(formatDims(dimL, dimP, dimH))}</span>
              </div>
            </div>

            <div className="md:col-span-2 space-y-1">
              <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                Data viaggio (opzionale) — crea/aggancia il viaggio OPEN
              </div>
              <input
                type="date"
                value={tripDate}
                onChange={(e) => setTripDate(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
                style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
                style={{ background: "var(--text)", color: "var(--bg)" }}
              >
                Aggiungi bancale
              </button>
            </div>
          </form>
        </div>

        <input
          className="w-full rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
          placeholder="Cerca per cliente, bancale o misure…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      {loading && <div className="text-sm" style={{ color: "var(--muted)" }}>Caricamento…</div>}

      {!loading && byClient.length === 0 && (
        <div className="rounded-3xl border p-6 text-sm shadow-sm" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--muted)" }}>
          Nessun bancale corriere.
        </div>
      )}

      {!loading && (
        <div className="space-y-2">
          {byClient.map((p) => (
            <div
              key={p.id}
              className="rounded-3xl border p-5 shadow-sm"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold truncate" style={{ color: "var(--text)" }}>
                      {p.client}
                    </div>

                    <span
                      className={"shrink-0 rounded-full border px-3 py-1 text-xs font-semibold " + clsPill(p.status)}
                      style={{ color: "var(--text)" }}
                    >
                      {p.status === "READY" ? "Pronto" : "In completamento"}
                    </span>
                  </div>

                  <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                    Bancale <span style={{ color: "var(--text)", fontWeight: 600 }}>{p.pallet_no}</span> ·
                    Bobine <span style={{ color: "var(--text)", fontWeight: 600 }}>{p.bobbins_count}</span>
                  </div>

                  <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                    Misure: <span style={{ color: "var(--text)", fontWeight: 700 }}>{prettyDims(p.dimensions)}</span>
                  </div>
                </div>

                <Link
                  href={`/produzione/bancali/${p.id}`}
                  className="rounded-2xl border px-3 py-2 text-xs font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
                  style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                >
                  Dettagli →
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setStatusById(p.id, "IN_PROGRESS")}
                  className="rounded-2xl border px-3 py-2 text-xs font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
                  style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                >
                  In completamento
                </button>
                <button
                  onClick={() => setStatusById(p.id, "READY")}
                  className="rounded-2xl border px-3 py-2 text-xs font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
                  style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                >
                  Pronto
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}