"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const isCurrentlyDark = document.documentElement.classList.contains("dark");
    setIsDark(isCurrentlyDark);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);

    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("fnb1621_theme", "dark");
      document.cookie = "fnb1621_theme=dark; path=/; max-age=31536000";
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("fnb1621_theme", "light");
      document.cookie = "fnb1621_theme=light; path=/; max-age=31536000";
    }
  };

  if (!mounted) {
    return (
      <div
        className={`h-9 w-9 rounded-xl bg-white/10 border border-white/15 ${className ?? ""}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Beralih ke Mode Terang (Light Mode)" : "Beralih ke Mode Gelap (Dark Mode)"}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white border border-white/15 cursor-pointer shadow-2xs ${
        className ?? ""
      }`}
      aria-label="Toggle Mode Gelap/Terang"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-300 transition-transform duration-300 rotate-0" />
      ) : (
        <Moon className="h-4 w-4 text-white transition-transform duration-300 -rotate-12" />
      )}
    </button>
  );
}

