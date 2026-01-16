"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Pallet = {
  id: string;
  client: string;
  pallet_no: string;
  bobbins_count: number;
  status: "READY" | "IN_PROGRESS";
  shipping_type: "TRUCK" | "COURIER";
  dimensions: string | null;
};

function parseDims(s: string | null) {
  if (!s) return { l: "", p: "", h: "" };
  const parts = s.split("x").map((v) => v.trim());
  return { l: parts[0] ?? "", p: parts[1] ?? "", h: parts[2] ?? "" };
}

function formatDims(l: string, p: string, h: string) {
  const L = l.trim(), P = p.trim(), H = h.trim();
  if (!L || !P || !H) return null;
  return `${L}x${P}x${H}`;
}

export default function Page({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(true);
  const [pallet, setPallet] = useState<Pallet | null>(null);

  const [bobbins, setBobbins] = useState(0);
  const [status, setStatus] = useState<"IN_PROGRESS" | "READY">("IN_PROGRESS");
  const [l, setL] = useState("");
  const [p, setP] = useState("");
  const [h, setH] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("pallets")
      .select("id, client, pallet_no, bobbins_count, status, shipping_type, dimensions")
      .eq("id", params.id)
      .single();

    if (error) {
      console.error(error);
      alert("Errore caricamento (vedi console F12).");
      setPallet(null);
      setLoading(false);
      return;
    }

    const pal = data as Pallet;
    setPallet(pal);
    setBobbins(pal.bobbins_count);
    setStatus(pal.status);

    const d = parseDims(pal.dimensions);
    setL(d.l); setP(d.p); setH(d.h);

    setLoading(false);
  }

  async function save() {
    if (!pallet) return;

    const payload: any = {
      bobbins_count: Number.isFinite(bobbins) ? bobbins : 0,
      status,
    };

    if (pallet.shipping_type === "COURIER") {
      const dims = formatDims(l, p, h);
      if (!dims) {
        alert("Inserisci misure L × P × H (tutti e 3).");
        return;
      }
      payload.dimensions = dims;
    } else {
      payload.dimensions = null;
    }

    const { error } = await supabase.from("pallets").update(payload).eq("id", pallet.id);
    if (error) {
      console.error(error);
      alert("Errore salvataggio (vedi console F12).");
      return;
    }

    alert("Salvato.");
    await load();
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-sm text-zinc-700">Caricamento…</div>;
  if (!pallet) return <div className="text-sm text-zinc-700">Bancale non disponibile.</div>;

  const back = pallet.shipping_type === "COURIER" ? "/produzione/corriere" : "/produzione/camion";

  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <Link href={back} className="text-sm text-zinc-600 underline">← Indietro</Link>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{pallet.client}</h1>
        <p className="text-sm text-zinc-700">
          Bancale <span className="font-medium">{pallet.pallet_no}</span> ·{" "}
          {pallet.shipping_type === "COURIER" ? "Corriere" : "Camion"}
        </p>
      </header>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <div className="text-xs font-semibold tracking-[0.18em] text-zinc-500">BOBINE</div>
            <input
              type="number"
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
              value={bobbins}
              onChange={(e) => setBobbins(Number(e.target.value))}
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

        {pallet.shipping_type === "COURIER" && (
          <div className="space-y-2">
            <div className="text-xs font-semibold tracking-[0.18em] text-zinc-500">MISURE (L × P × H)</div>
            <div className="grid grid-cols-3 gap-3">
              <input className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="L" value={l} onChange={(e)=>setL(e.target.value)} inputMode="numeric" />
              <input className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="P" value={p} onChange={(e)=>setP(e.target.value)} inputMode="numeric" />
              <input className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="H" value={h} onChange={(e)=>setH(e.target.value)} inputMode="numeric" />
            </div>
          </div>
        )}

        <button
          onClick={save}
          className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:scale-[0.99]"
        >
          Salva
        </button>
      </section>
    </main>
  );
}