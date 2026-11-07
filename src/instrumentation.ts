declare global {
  var __pos1621ExpiryIntervalStarted: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (globalThis.__pos1621ExpiryIntervalStarted) {
      return;
    }
    globalThis.__pos1621ExpiryIntervalStarted = true;

    const { runExpireOverdueOrdersJob } = await import(
      "@/server/order-expiry"
    );

    // Jalankan pertama kali saat server menyala
    runExpireOverdueOrdersJob().catch(() => {
      // Abaikan jika saat cold-start koneksi belum siap
    });

    // Jalankan periodik setiap 30 detik di sisi server (bukan di browser)
    const timer = setInterval(() => {
      runExpireOverdueOrdersJob().catch(() => {
        // Tangani error jaringan sementara tanpa menghentikan proses server
      });
    }, 30_000);

    if (typeof timer.unref === "function") {
      timer.unref();
    }
  }
}
