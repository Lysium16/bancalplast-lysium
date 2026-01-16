"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Pallet = {
  id: string;
  client: string;
  pallet_no: string;
  bobbins_count: number;
  status: "READY" | "IN_PROGRESS";
  dimensions: string | null; // "110x130x150"
  created_at: string;
};

function formatDims(l: string, p: string, h: string): string | null {
  const L = l.trim();
  const P = p.trim();
  const H = h.trim();
  if (!L || !P || !H) return null;
  return `${L}x${P}x${H}`;
}

function parseDims(s: string | null) {
  if (!s) return { l: "", p: "", h: "" };
  const parts = s.split("x").map((v) => v.trim());
  return { l: parts[0] ?? "", p: parts[1] ?? "", h: parts[2] ?? "" };
}

export default function ProduzioneCorrierePage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Pallet[]>([]);
  const [query, setQuery] = useState("");

  // form
  const [client, setClient] = useState("");
  const [palletNo, setPalletNo] = useState("");
  const [bobbinsCount, setBobbinsCount] = useState<number>(0);
  const [status, setStatus] = useState<"IN_PROGRESS" | "READY">("IN_PROGRESS");
  const [dimL, setDimL] = useState("");
  const [dimP, setDimP] = useState("");
  const [dimH, setDimH] = useState("");

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("pallets")
      .select("id, client, pallet_no, bobbins_count, status, dimensions, created_at")
      .eq("shipping_type", "COURIER").is("sent_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Errore caricamento (vedi console F12).");
      setItems([]);
    } else {
      setItems((data ?? []) as Pallet[]);
    }

    setLoading(false);
  }

  async function add() {
    if (!client.trim() || !palletNo.trim()) {
      alert("Compila Cliente e Numero bancale.");
      return;
    }

    const dims = formatDims(dimL, dimP, dimH);
    if (!dims) {
      alert("Inserisci le misure: L × P × H (tutti e 3 i campi).");
      return;
    }

    const { error } = await supabase.from("pallets").insert({
      client: client.trim(),
      pallet_no: palletNo.trim(),
      bobbins_count: Number.isFinite(bobbinsCount) ? bobbinsCount : 0,
      status,
      shipping_type: "COURIER",
      dimensions: dims,
    });

    if (error) {
      console.error(error);
      alert("Errore salvataggio (vedi console F12).");
      return;
    }

    setClient("");
    setPalletNo("");
    setBobbinsCount(0);
    setStatus("IN_PROGRESS");
    setDimL("");
    setDimP("");
    setDimH("");

    await load();
  }

  async function quickSetStatus(id: string, next: "READY" | "IN_PROGRESS") {
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
    return items.filter(
      (p) =>
        p.client.toLowerCase().includes(q) ||
        p.pallet_no.toLowerCase().includes(q) ||
        (p.dimensions ?? "").toLowerCase().includes(q)
    );
  }, [items, query]);

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
}, []);return (
    <main className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Produzione · Bancali Corriere
            </h1>
            <p className="text-sm text-zinc-700">
              Inserisci e gestisci bancali corriere. Stato modificabile anche dopo (toggle rapido o dettaglio).
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
      </header>

      {/* FORM */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold tracking-tight text-zinc-900">Nuovo bancale corriere</div>
          <span className="text-xs text-zinc-500">L × P × H</span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <div className="text-xs font-semibold tracking-[0.18em] text-zinc-500">CLIENTE</div>
            <input
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="Es. Rossi S.p.A."
              value={client}
              onChange={(e) => setClient(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-semibold tracking-[0.18em] text-zinc-500">NUMERO BANCALE</div>
            <input
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="Es. C-001"
              value={palletNo}
              onChange={(e) => setPalletNo(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-semibold tracking-[0.18em] text-zinc-500">NUMERO BOBINE</div>
            <input
              type="number"
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
              value={bobbinsCount}
              onChange={(e) => setBobbinsCount(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-semibold tracking-[0.18em] text-zinc-500">STATO</div>
            <select
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="IN_PROGRESS">In completamento</option>
              <option value="READY">Pronto</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold tracking-[0.18em] text-zinc-500">MISURE (L × P × H)</div>
          <div className="grid grid-cols-3 gap-3">
            <input
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="L"
              value={dimL}
              onChange={(e) => setDimL(e.target.value)}
              inputMode="numeric"
            />
            <input
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="P"
              value={dimP}
              onChange={(e) => setDimP(e.target.value)}
              inputMode="numeric"
            />
            <input
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="H"
              value={dimH}
              onChange={(e) => setDimH(e.target.value)}
              inputMode="numeric"
            />
          </div>
        </div>

        <button
          onClick={add}
          className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:scale-[0.99]"
        >
          + Aggiungi bancale
        </button>
      </section>

      {/* LIST */}
      <section className="space-y-3">
        {loading && <div className="text-sm text-zinc-600">Caricamento…</div>}

        {!loading && filtered.length === 0 && (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm">
            Nessun bancale corriere.
          </div>
        )}

        {filtered.map((p) => {
          const d = parseDims(p.dimensions);
          const dimsPretty = d.l && d.p && d.h ? `${d.l} × ${d.p} × ${d.h}` : "—";

          return (
            <div
              key={p.id}
              className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <Link href={`/produzione/bancali/${p.id}`} className="min-w-0">
                  <div className="truncate text-base font-semibold text-zinc-900">
                    {p.client}
                  </div>
                  <div className="mt-1 text-sm text-zinc-700">
                    Bancale <span className="font-medium">{p.pallet_no}</span> ·
                    Bobine <span className="font-medium">{p.bobbins_count}</span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-600">
                    Misure: <span className="font-semibold text-zinc-800">{dimsPretty}</span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500 underline">
                    Apri dettaglio (modifica completa)
                  </div>
                </Link>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      p.status === "READY"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {p.status === "READY" ? "Pronto" : "In completamento"}
                  </span>

                  {p.status === "READY" ? (
                    <button
                      onClick={() => quickSetStatus(p.id, "IN_PROGRESS")}
                      className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 active:scale-[0.99]"
                    >
                      Segna “In completamento”
                    </button>
                  ) : (
                    <button
                      onClick={() => quickSetStatus(p.id, "READY")}
                      className="rounded-2xl bg-black px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 active:scale-[0.99]"
                    >
                      Segna “Pronto”
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}