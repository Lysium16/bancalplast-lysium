import Link from "next/link";

const Tile = ({ href, title, desc }: { href: string; title: string; desc: string }) => (
  <Link
    href={href}
    className="block rounded-3xl border p-6 shadow-sm hover:opacity-95 active:scale-[0.99]"
    style={{ background: "var(--card)", borderColor: "var(--border)", boxShadow: "0 8px 30px var(--shadow)" }}
  >
    <div className="text-lg font-semibold tracking-tight" style={{ color: "var(--text)" }}>
      {title}
    </div>
    <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
      {desc}
    </div>
    <div className="mt-4 text-sm font-semibold" style={{ color: "var(--text)" }}>
      Apri →
    </div>
  </Link>
);

export default function Home() {
  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
          Bancalplast <span style={{ color: "var(--muted)" }}>made by Lysium</span>
        </h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          App interna semplice e condivisa. Elegante e pratica (come dovrebbe essere).
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <Tile href="/produzione/camion" title="Produzione · Camion" desc="Inserisci e gestisci bancali camion." />
        <Tile href="/produzione/corriere" title="Produzione · Corriere" desc="Inserisci corrieri con misure L × P × H e stato." />
        <Tile href="/ufficio/bancali-pronti" title="Ufficio · Bancali pronti" desc="Solo visione + selezione: assegna, invia, elimina." />
        <Tile href="/ufficio/viaggi-spediti" title="Ufficio · Viaggi spediti" desc="Solo visura + eliminazione definitiva." />
      </section>
    </main>
  );
}