const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// carica .env.local in Node (così sb non è "vuoto")
function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const txt = fs.readFileSync(p, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;
    const eq = l.indexOf("=");
    if (eq < 0) continue;
    const k = l.slice(0, eq).trim();
    const v = l.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

(async () => {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.log("Mancano env vars NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }

  const sb = createClient(url, key);

  const p = await sb
    .from("pallets")
    .select("id,client,pallet_no,shipping_type,status,trip_id,sent_at,created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (p.error) { console.log("Errore pallets:", p.error); process.exit(1); }

  const rows = p.data ?? [];
  const withTrip = rows.filter(r => r.trip_id).length;
  const withoutTrip = rows.filter(r => !r.trip_id).length;

  console.log("\n--- PALLETS ultimi 20 ---");
  console.log("con trip_id:", withTrip, "senza trip_id:", withoutTrip);

  const tripIds = [...new Set(rows.map(r => r.trip_id).filter(Boolean))];
  let tripMap = new Map();

  if (tripIds.length) {
    const t = await sb.from("trips").select("id,trip_date,status").in("id", tripIds);
    if (t.error) { console.log("Errore trips:", t.error); process.exit(1); }
    for (const tr of (t.data ?? [])) tripMap.set(tr.id, tr.trip_date);
  }

  // stampa tabella semplice
  for (const r of rows) {
    const td = r.trip_id ? (tripMap.get(r.trip_id) ?? "?? (trip_id non trovato)") : "— (NO trip_id)";
    console.log(`${r.pallet_no} | ${r.client} | ${r.shipping_type} | trip_date: ${td}`);
  }

})();