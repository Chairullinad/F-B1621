"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationLoadingIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    function clearTimers() {
      if (showTimer) {
        clearTimeout(showTimer);
        showTimer = null;
      }
      if (safetyTimer) {
        clearTimeout(safetyTimer);
        safetyTimer = null;
      }
    }

    function handleGlobalClick(e: MouseEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as HTMLElement)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        anchor.getAttribute("target") === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      const currentUrl = window.location.pathname + window.location.search;
      if (href !== currentUrl) {
        clearTimers();
        // Tunda sedikit agar perpindahan cepat/prefetched tidak berkedip
        showTimer = setTimeout(() => {
          setIsLoading(true);
        }, 120);
        safetyTimer = setTimeout(() => {
          setIsLoading(false);
        }, 8000);
      }
    }

    window.addEventListener("click", handleGlobalClick, { capture: true });

    return () => {
      clearTimers();
      window.removeEventListener("click", handleGlobalClick, { capture: true });
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div
      role="status"
      aria-label="Memuat halaman"
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-[2.5px] bg-[#DCE7F0]/70 overflow-hidden"
    >
      <div className="h-full bg-[#1E88E5] w-full animate-[progress_1s_ease-in-out_infinite] origin-left" />
    </div>
  );
}
