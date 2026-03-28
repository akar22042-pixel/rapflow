"use client";

import { useState } from "react";
import { useTheme, THEMES, ThemeId } from "@/lib/ThemeContext";

export default function ThemeCustomizer() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Tema"
        className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors text-base"
      >
        🎨
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* panel */}
          <div className="absolute right-0 top-10 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-4 w-52">
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-widest mb-3">
              Renk Teması
            </p>
            <div className="flex flex-col gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id as ThemeId); setOpen(false); }}
                  className={[
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    theme === t.id
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-white",
                  ].join(" ")}
                >
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20"
                    style={{ background: t.swatch }}
                  />
                  {t.label}
                  {theme === t.id && (
                    <span className="ml-auto text-xs text-zinc-500">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
