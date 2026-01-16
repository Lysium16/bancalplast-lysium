"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 1) prova localStorage
    const saved = (localStorage.getItem("bp_theme") as Theme | null);
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      applyTheme(saved);
      setMounted(true);
      return;
    }

    // 2) altrimenti usa preferenza di sistema
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    const initial: Theme = prefersDark ? "dark" : "light";
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("bp_theme", next);
    applyTheme(next);
  }

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--text)] shadow-sm hover:opacity-95 active:scale-[0.99]"
      aria-label="Cambia tema"
      title="Cambia tema"
    >
      {theme === "dark" ? "Tema: Scuro" : "Tema: Chiaro"}
    </button>
  );
}