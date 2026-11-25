"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

function systemDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Applies theme + accent to <html>. The inline script in layout.tsx prevents a flash on load. */
export function ThemeSync() {
  const theme = useStore((s) => s.data.settings.theme);
  const accent = useStore((s) => s.data.settings.accent);
  const ready = useStore((s) => s.status === "ready");

  useEffect(() => {
    if (!ready) return;
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && systemDark());
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.dataset.accent = accent;
      try {
        localStorage.setItem("unios:theme", JSON.stringify({ theme, accent }));
      } catch {}
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, accent, ready]);
  return null;
}

export function useResolvedTheme(): "light" | "dark" {
  const theme = useStore((s) => s.data.settings.theme);
  const [sys, setSys] = useState(false);
  useEffect(() => {
    setSys(systemDark());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const f = () => setSys(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return theme === "dark" || (theme === "system" && sys) ? "dark" : "light";
}

export const themeBootScript = `(function(){try{var s=JSON.parse(localStorage.getItem('unios:theme')||'{}');var t=s.theme||'light';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');document.documentElement.dataset.accent=s.accent||'sage';}catch(e){}})();`;
