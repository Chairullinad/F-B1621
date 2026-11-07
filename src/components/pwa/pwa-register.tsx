"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Abaikan jika browser dalam mode private yang membatasi Service Worker
      });
    }
  }, []);

  return null;
}

