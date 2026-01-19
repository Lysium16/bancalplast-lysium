"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fmtDateLabel, getOrCreateTripId } from "@/lib/trips";

type Pallet = {
  id: string;
  client: string;
  pallet_no: string;
  bobbins_count: number;
  status: "IN_PROGRESS" | "READY";
  shipping_type: "TRUCK";
  trip_id: string | null;
  trip_date: string | null;
  sent_at: string | null;
  created_at: string;
};

type Editing = {
  id: string;
  client: string;
  pallet_no: string;
  bobbins_count: string;
  status: "IN_PROGRESS" | "READY";
  trip_date: string; // YYYY-MM-DD oppure ""
};

export default function ProduzioneCamionPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Pallet[]>([]);

  const [client, setClient] = useState("");
  const [palletNo, setPalletNo] = useState("");
  const [bobbinsCount, setBobbinsCount] = useState("0");
  const [status, setStatus] = useState<"IN_PROGRESS" | "READY">("IN_PROGRESS");
  const [tripDate, setTripDate] = useState<string>("");

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);

  async function load() {
    setLoading(true);

    const res = await supabase
      .from("pallets")
      .select(`
        id,
        client,
        pallet_no,
        bobbins_count,
        status,
        shipping_type,
        trip_id,
        sent_at,
        created_at,
        trips:trips ( trip_date )
      `)
      .eq("shipping_type", "TRUCK")
      .is("sent_at", null)
      .order("created_at", { ascending: false });

    if (res.error) {
      console.error(res.error);
      setItems([]);
      setLoading(false);
      return;
    }

    const raw = (res.data ?? []) as any[];
    const mapped: Pallet[] = raw.map((r) => ({
      id: r.id,
      client: r.client,
      pallet_no: r.pallet_no,
      bobbins_count: r.bobbins_count ?? 0,
      status: r.status,
      shipping_type: "TRUCK",
      trip_id: r.trip_id ?? null,
      trip_date: r.trips?.trip_date ?? null,
      sent_at: r.sent_at ?? null,
      created_at: r.created_at,
    }));

    setItems(mapped);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => {
      const td = p.trip_date ?? "";
      return (
        p.client.toLowerCase().includes(q) ||
        p.pallet_no.toLowerCase().includes(q) ||
        td.toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  const ordered = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => a.client.localeCompare(b.client));
    return arr;
  }, [filtered]);

  async function createPallet() {
    const c = client.trim();
    const pn = palletNo.trim();
    const bc = parseInt(bobbinsCount, 10);

    if (!c) return alert("Inserisci il cliente.");
    if (!pn) return alert("Inserisci il numero bancale.");
    if (!Number.isFinite(bc) || bc < 0) return alert("Numero bobine non valido.");

    let trip_id: string | null = null;
    if (tripDate) {
      trip_id = await getOrCreateTripId(tripDate);
    }

    const { error } = await supabase.from("pallets").insert({
      client: c,
      pallet_no: pn,
      bobbins_count: bc,
      status,
      shipping_type: "TRUCK",
      trip_id,
    });

    if (error) {
      console.error(error);
      alert("Errore inserimento (F12).");
      return;
    }

    setClient("");
    setPalletNo("");
    setBobbinsCount("0");
    setStatus("IN_PROGRESS");
    // tripDate lo lasciamo com'è: spesso si inseriscono più bancali sullo stesso viaggio

    await load();
  }

  function startEdit(p: Pallet) {
    setEditing({
      id: p.id,
      client: p.client,
      pallet_no: p.pallet_no,
      bobbins_count: String(p.bobbins_count ?? 0),
      status: p.status,
      trip_date: p.trip_date ?? "",
    });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function saveEdit() {
    if (!editing) return;

    const c = editing.client.trim();
    const pn = editing.pallet_no.trim();
    const bc = parseInt(editing.bobbins_count, 10);

    if (!c) return alert("Cliente obbligatorio.");
    if (!pn) return alert("Numero bancale obbligatorio.");
    if (!Number.isFinite(bc) || bc < 0) return alert("Numero bobine non valido.");

    let trip_id: string | null = null;
    if (editing.trip_date) {
      trip_id = await getOrCreateTripId(editing.trip_date);
    }

    const { error } = await supabase
      .from("pallets")
      .update({
        client: c,
        pallet_no: pn,
        bobbins_count: bc,
        status: editing.status,
        trip_id,
      })
      .eq("id", editing.id);

    if (error) {
      console.error(error);
      alert("Errore salvataggio (F12).");
      return;
    }

    setEditing(null);
    await load();
  }

  async function deleteOne(id: string) {
    if (!confirm("Eliminare definitivamente questo bancale?")) return;

    const { error } = await supabase.from("pallets").delete().eq("id", id);
    if (error) {
      console.error(error);
      alert("Errore eliminazione (F12).");
      return;
    }

    if (editing?.id === id) setEditing(null);
    await load();
  }

  const pill = (s: "IN_PROGRESS" | "READY") => {
    if (s === "READY") {
      return { text: "Pronto", bg: "rgba(16,185,129,0.18)" };
    }
    return { text: "In completamento", bg: "rgba(250,204,21,0.22)" };
  };

  return (
    <main className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
              Produzione · Camion
            </h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Inserisci bancali e aggiorna lo stato. Modifica ed elimina sono disponibili.
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

        <div className="grid gap-3 rounded-3xl border p-4 shadow-sm"
             style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
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
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <input
              type="number"
              min="0"
              className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
              placeholder="N. bobine"
              value={bobbinsCount}
              onChange={(e) => setBobbinsCount(e.target.value)}
            />

            <select
              className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="IN_PROGRESS">In completamento</option>
              <option value="READY">Pronto</option>
            </select>

            <input
              type="date"
              className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
              value={tripDate}
              onChange={(e) => setTripDate(e.target.value)}
              title="Data viaggio (opzionale)"
            />
          </div>

          <button
            onClick={createPallet}
            className="rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
            style={{ background: "var(--text)", borderColor: "var(--text)", color: "var(--bg)" }}
          >
            Aggiungi bancale
          </button>

          <div className="text-xs" style={{ color: "var(--muted)" }}>
            Per Filippo: <span style={{ color: "var(--text)", fontWeight: 800 }}>qui non facciamo arte astratta: numeri chiari, bancali chiari.</span>
          </div>
        </div>

        <input
          className="w-full rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
          placeholder="Cerca cliente / bancale / data viaggio…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      {loading && <div className="text-sm" style={{ color: "var(--muted)" }}>Caricamento…</div>}

      {!loading && ordered.length === 0 && (
        <div className="rounded-3xl border p-6 text-sm shadow-sm"
             style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--muted)" }}>
          Nessun bancale camion.
        </div>
      )}

      {!loading && ordered.length > 0 && (
        <div className="space-y-2">
          {ordered.map((p) => {
            const st = pill(p.status);
            const isEdit = editing?.id === p.id;

            return (
              <div key={p.id} className="rounded-3xl border p-5 shadow-sm"
                   style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                {!isEdit ? (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-base font-semibold" style={{ color: "var(--text)" }}>
                          {p.client}
                        </div>
                        <span className="rounded-full border px-3 py-1 text-xs font-semibold"
                              style={{ background: st.bg, borderColor: "var(--border)", color: "var(--text)" }}>
                          {st.text}
                        </span>
                      </div>

                      <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                        Bancale <span style={{ color: "var(--text)", fontWeight: 800 }}>{p.pallet_no}</span> · Bobine{" "}
                        <span style={{ color: "var(--text)", fontWeight: 800 }}>{p.bobbins_count}</span>
                        {p.trip_date && (
                          <>
                            {" "}· Viaggio <span style={{ color: "var(--text)", fontWeight: 800 }}>{fmtDateLabel(p.trip_date)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => startEdit(p)}
                        className="rounded-2xl border px-3 py-2 text-xs font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
                        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                      >
                        Modifica
                      </button>
                      <button
                        onClick={() => deleteOne(p.id)}
                        className="rounded-2xl border px-3 py-2 text-xs font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
                        style={{ background: "var(--card)", borderColor: "#ef4444", color: "#ef4444" }}
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>Modifica bancale</div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
                        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                        value={editing.client}
                        onChange={(e) => setEditing((s) => s ? ({ ...s, client: e.target.value }) : s)}
                        placeholder="Cliente"
                      />
                      <input
                        className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
                        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                        value={editing.pallet_no}
                        onChange={(e) => setEditing((s) => s ? ({ ...s, pallet_no: e.target.value }) : s)}
                        placeholder="N. bancale"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <input
                        type="number"
                        min="0"
                        className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
                        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                        value={editing.bobbins_count}
                        onChange={(e) => setEditing((s) => s ? ({ ...s, bobbins_count: e.target.value }) : s)}
                        placeholder="N. bobine"
                      />

                      <select
                        className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
                        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                        value={editing.status}
                        onChange={(e) => setEditing((s) => s ? ({ ...s, status: e.target.value as any }) : s)}
                      >
                        <option value="IN_PROGRESS">In completamento</option>
                        <option value="READY">Pronto</option>
                      </select>

                      <input
                        type="date"
                        className="rounded-2xl border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2"
                        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                        value={editing.trip_date}
                        onChange={(e) => setEditing((s) => s ? ({ ...s, trip_date: e.target.value }) : s)}
                        title="Data viaggio (opzionale)"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={saveEdit}
                        className="rounded-2xl border px-4 py-2 text-xs font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
                        style={{ background: "var(--text)", borderColor: "var(--text)", color: "var(--bg)" }}
                      >
                        Salva
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-2xl border px-4 py-2 text-xs font-semibold shadow-sm hover:opacity-95 active:scale-[0.99]"
                        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}