"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Pallet = {
  id: string;
  client: string;
  pallet_no: string;
  bobbins_count: number;
  status: "READY" | "IN_PROGRESS";
  created_at: string;
};

export default function ProduzioneCamionPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Pallet[]>([]);
  const [query, setQuery] = useState("");

  const [client, setClient] = useState("");
  const [palletNo, setPalletNo] = useState("");
  const [bobbinsCount, setBobbinsCount] = useState<number>(0);
  const [status, setStatus] = useState<"IN_PROGRESS" | "READY">("IN_PROGRESS");

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("pallets")
      .select("id, client, pallet_no, bobbins_count, status, created_at")
      .eq("shipping_type", "TRUCK").is("sent_at", null)
      .order("client", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Errore caricamento. Controlla console (F12).");
      setItems([]);
    } else {
      setItems((data ?? []) as Pallet[]);
    }

    setLoading(false);
  }

  async function add() {
    if (!client.trim() || !palletNo.trim()) {
      alert("Compila almeno Cliente e Numero bancale.");
      return;
    }

    const { error } = await supabase.from("pallets").insert({
      client: client.trim(),
      pallet_no: palletNo.trim(),
      bobbins_count: Number.isFinite(bobbinsCount) ? bobbinsCount : 0,
      status,
      shipping_type: "TRUCK",
    });

    if (error) {
      console.error(error);
      alert("Errore salvataggio. Controlla console (F12).");
      return;
    }

    setClient("");
    setPalletNo("");
    setBobbinsCount(0);
    setStatus("IN_PROGRESS");

    await load();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        p.client.toLowerCase().includes(q) ||
        p.pallet_no.toLowerCase().includes(q)
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
      <header className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Produzione · Bancali Camion
            </h1>
            <p className="text-sm text-zinc-700">
              Inserisci e aggiorna i bancali camion.
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
          placeholder="Cerca cliente o numero bancale…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
        <div className="text-sm font-semibold tracking-tight text-zinc-900">
          Nuovo bancale
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Cliente"
            value={client}
            onChange={(e) => setClient(e.target.value)}
          />
          <input
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Numero bancale"
            value={palletNo}
            onChange={(e) => setPalletNo(e.target.value)}
          />
          <input
            type="number"
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Numero bobine"
            value={bobbinsCount}
            onChange={(e) => setBobbinsCount(Number(e.target.value))}
          />
          <select
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="IN_PROGRESS">In completamento</option>
            <option value="READY">Pronto</option>
          </select>
        </div>

        <button
          onClick={add}
          className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
        >
          + Aggiungi bancale
        </button>
      </section>

      <section className="space-y-3">
        {loading && <p className="text-sm text-zinc-600">Caricamento…</p>}

        {!loading && filtered.length === 0 && (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm">
            Nessun bancale camion.
          </div>
        )}

        {filtered.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-zinc-900">
                {p.client}
              </div>
              <div className="mt-1 text-sm text-zinc-700">
                Bancale <span className="font-medium">{p.pallet_no}</span> ·
                Bobine <span className="font-medium">{p.bobbins_count}</span>
              </div>
            </div>

            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                p.status === "READY"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {p.status === "READY" ? "Pronto" : "In completamento"}
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}
