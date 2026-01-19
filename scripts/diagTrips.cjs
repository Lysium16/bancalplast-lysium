const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// mini parser .env.local (senza dipendenze)
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

  console.log("\nENV url presente:", !!url);
  console.log("ENV key presente:", !!key);
  if (!url || !key) {
    console.log("\nERRORE: manca NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
    process.exit(1);
  }

  const sb = createClient(url, key);

  // 1) Leggo trips (sanity)
  console.log("\n1) SELECT trips (limit 3) ...");
  const s1 = await sb.from("trips").select("id,trip_date,status,shipped_at,created_at").order("created_at",{ascending:false}).limit(3);
  if (s1.error) {
    console.log("❌ SELECT trips error:");
    console.log(s1.error);
    process.exit(1);
  }
  console.log("✅ SELECT trips ok. Righe:", (s1.data||[]).length);
  console.log(s1.data);

  // 2) Provo a creare un viaggio di test
  const testDate = "2099-12-31";
  console.log("\n2) INSERT trip test (trip_date = " + testDate + ") ...");
  const ins = await sb.from("trips")
    .insert({ trip_date: testDate, status: "OPEN" })
    .select("id,trip_date,status")
    .single();

  if (ins.error) {
    console.log("❌ INSERT trips error:");
    console.log(ins.error);
    process.exit(1);
  }

  console.log("✅ INSERT ok:", ins.data);

  // 3) Rileggo quel trip
  console.log("\n3) SELECT trip test ...");
  const sel = await sb.from("trips").select("id,trip_date,status").eq("id", ins.data.id).single();
  if (sel.error) {
    console.log("❌ SELECT trip test error:");
    console.log(sel.error);
    process.exit(1);
  }
  console.log("✅ SELECT trip test ok:", sel.data);

  // 4) Cleanup (cancello il test)
  console.log("\n4) DELETE trip test ...");
  const del = await sb.from("trips").delete().eq("id", ins.data.id);
  if (del.error) {
    console.log("⚠️ DELETE trip test error (non grave, ma strano):");
    console.log(del.error);
  } else {
    console.log("✅ DELETE ok");
  }

  console.log("\nFINE DIAGNOSI ✅");
})();