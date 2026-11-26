import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectInitialUnacknowledgedAlerts,
  collectNewIncomingOrderAlerts,
  mergeIncomingAlertQueue,
  type IncomingAlertOrderSnapshot,
} from "../cashier-alerts.ts";

describe("src/lib/cashier-alerts.ts", () => {
  it("mendeteksi semua order pelanggan yang masuk bersamaan dalam satu batch", () => {
    const prevPendingIds = new Set<string>(["ord-existing"]);
    const prevClaimedIds = new Set<string>();

    const pendingOrders: IncomingAlertOrderSnapshot[] = [
      { id: "ord-existing", source: "customer_qr", customerClaimedPaidAt: null },
      { id: "ord-burst-1", source: "customer_qr", customerClaimedPaidAt: null },
      {
        id: "ord-burst-2",
        source: "customer_qr",
        customerClaimedPaidAt: "2026-11-26T03:00:00Z",
      },
      { id: "ord-manual", source: "cashier", customerClaimedPaidAt: null },
    ];

    const alerts = collectNewIncomingOrderAlerts({
      prevPendingIds,
      prevClaimedIds,
      pendingOrders,
    });

    assert.deepEqual(alerts, [
      { orderId: "ord-burst-1", kind: "new_order" },
      { orderId: "ord-burst-2", kind: "qris_claimed" },
    ]);
  });

  it("menggabungkan antrean alert tanpa duplikat dan membuang order yang sudah diselesaikan kasir lain", () => {
    const activePendingOrders: IncomingAlertOrderSnapshot[] = [
      {
        id: "ord-1",
        source: "customer_qr",
        customerClaimedPaidAt: "2026-11-26T03:01:00Z",
      },
      { id: "ord-3", source: "customer_qr", customerClaimedPaidAt: null },
    ];

    const merged = mergeIncomingAlertQueue({
      currentQueue: [
        { orderId: "ord-1", kind: "new_order" },
        { orderId: "ord-paid-elsewhere", kind: "new_order" },
      ],
      newAlerts: [
        { orderId: "ord-1", kind: "qris_claimed" },
        { orderId: "ord-3", kind: "new_order" },
      ],
      activePendingOrders,
    });

    assert.deepEqual(merged, [
      { orderId: "ord-1", kind: "qris_claimed" },
      { orderId: "ord-3", kind: "new_order" },
    ]);
  });

  it("mendeteksi order pelanggan aktif saat mount yang belum di-acknowledge pada sesi kasir", () => {
    const pendingOrders: IncomingAlertOrderSnapshot[] = [
      { id: "ord-acked", source: "customer_qr", customerClaimedPaidAt: null },
      { id: "ord-unacked", source: "customer_qr", customerClaimedPaidAt: null },
      {
        id: "ord-acked-but-claimed",
        source: "customer_qr",
        customerClaimedPaidAt: "2026-11-26T09:05:00Z",
      },
      { id: "ord-manual", source: "cashier", customerClaimedPaidAt: null },
    ];

    const initialAlerts = collectInitialUnacknowledgedAlerts({
      pendingOrders,
      acknowledgedOrderIds: new Set(["ord-acked", "ord-acked-but-claimed"]),
      acknowledgedClaimOrderIds: new Set(),
    });

    assert.deepEqual(initialAlerts, [
      { orderId: "ord-unacked", kind: "new_order" },
      { orderId: "ord-acked-but-claimed", kind: "qris_claimed" },
    ]);
  });
});
