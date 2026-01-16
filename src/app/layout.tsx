import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Bancalplast made by Lysium",
  description: "App interna per gestione bancali e viaggi",
};

const NavLink = ({ href, label }: { href: string; label: string }) => (
  <Link
    href={href}
    className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--text)] shadow-sm hover:opacity-95 active:scale-[0.99]"
  >
    {label}
  </Link>
);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body style={{ background: "var(--bg)", color: "var(--text)" }}>
        <div className="mx-auto max-w-5xl px-4 py-6">
          <header className="mb-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-lg font-semibold tracking-tight">
                Bancalplast <span style={{ color: "var(--muted)" }}>made by Lysium</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ThemeToggle />
                <NavLink href="/" label="Home" />
                <NavLink href="/produzione/camion" label="Prod. Camion" />
                <NavLink href="/produzione/corriere" label="Prod. Corriere" />
                <NavLink href="/ufficio/bancali-pronti" label="Ufficio: Pronti" />
                <NavLink href="/ufficio/viaggi-spediti" label="Ufficio: Spediti" />
              </div>
            </div>
            <div className="h-px" style={{ background: "var(--border)" }} />
          </header>

          {children}

          <footer className="mt-10 text-xs" style={{ color: "var(--muted)" }}>
            Il lavoro di squadra è il segreto che fa ottenere risultati non comuni alle persone comuni
          </footer>
        </div>
      </body>
    </html>
  );
}