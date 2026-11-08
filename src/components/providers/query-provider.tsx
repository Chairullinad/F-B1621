"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // Data valid 1 menit di cache memori (instant 0ms response)
            gcTime: 5 * 60 * 1000, // Simpan cache 5 menit
            refetchOnWindowFocus: false,
            refetchOnMount: true, // Revalidasi di background tanpa memblokir UI
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

