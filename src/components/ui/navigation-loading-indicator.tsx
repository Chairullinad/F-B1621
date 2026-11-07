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
    function handleGlobalClick(e: MouseEvent) {
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
      if (href !== currentUrl && !href.startsWith("#")) {
        setIsLoading(true);
      }
    }

    window.addEventListener("click", handleGlobalClick, { capture: true });

    return () => {
      window.removeEventListener("click", handleGlobalClick, { capture: true });
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div
      role="status"
      aria-label="Loading"
      className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center"
    >
      {/* Top progress bar tipis modern */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-[#DCE7F0] overflow-hidden shadow-xs">
        <div className="h-full bg-[#3B7097] w-full animate-[progress_1s_ease-in-out_infinite] origin-left" />
      </div>

      {/* Modern Glassmorphic Hourglass Loader (Tanpa Tulisan) */}
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F1B27]/80 shadow-2xl backdrop-blur-md border border-[#3B7097]/40 animate-in fade-in zoom-in-95 duration-150">
        <span className="text-2xl animate-[spin_1.5s_cubic-bezier(0.4,0,0.2,1)_infinite] select-none">
          ⏳
        </span>
      </div>
    </div>
  );
}
