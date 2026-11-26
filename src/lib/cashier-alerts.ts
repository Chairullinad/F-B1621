import type { OrderSource } from "./types/database.ts";

export interface IncomingAlertOrderSnapshot {
  id: string;
  source: OrderSource;
  customerClaimedPaidAt: string | null;
}

export interface IncomingOrderAlertItem {
  orderId: string;
  kind: "new_order" | "qris_claimed";
}

/**
 * Mengumpulkan seluruh order pelanggan yang baru masuk atau baru mengklaim bayar QRIS
 * tanpa berhenti pada item pertama (aman untuk beberapa order masuk bersamaan).
 */
export function collectNewIncomingOrderAlerts<
  T extends IncomingAlertOrderSnapshot,
>(params: {
  prevPendingIds: ReadonlySet<string>;
  prevClaimedIds: ReadonlySet<string>;
  pendingOrders: ReadonlyArray<T>;
}): IncomingOrderAlertItem[] {
  const newAlerts: IncomingOrderAlertItem[] = [];

  for (const order of params.pendingOrders) {
    const isClaimed = Boolean(order.customerClaimedPaidAt);
    const isNewlyClaimed = isClaimed && !params.prevClaimedIds.has(order.id);
    const isNewlyCreatedCustomerOrder =
      !params.prevPendingIds.has(order.id) && order.source === "customer_qr";

    if (isNewlyClaimed) {
      newAlerts.push({ orderId: order.id, kind: "qris_claimed" });
    } else if (isNewlyCreatedCustomerOrder) {
      newAlerts.push({ orderId: order.id, kind: "new_order" });
    }
  }

  return newAlerts;
}

/**
 * Menggabungkan antrean pop-up order masuk dengan order baru yang datang,
 * membuang order yang sudah tidak pending (mis. dibayar kasir lain), dan mencegah duplikasi.
 */
export function mergeIncomingAlertQueue<
  T extends IncomingAlertOrderSnapshot,
>(params: {
  currentQueue: ReadonlyArray<IncomingOrderAlertItem>;
  newAlerts: ReadonlyArray<IncomingOrderAlertItem>;
  activePendingOrders: ReadonlyArray<T>;
}): IncomingOrderAlertItem[] {
  const activeIds = new Set(params.activePendingOrders.map((o) => o.id));
  const merged = new Map<string, IncomingOrderAlertItem>();

  for (const existing of params.currentQueue) {
    if (activeIds.has(existing.orderId)) {
      merged.set(existing.orderId, existing);
    }
  }

  for (const incoming of params.newAlerts) {
    if (!activeIds.has(incoming.orderId)) continue;
    const prev = merged.get(incoming.orderId);
    if (!prev || incoming.kind === "qris_claimed") {
      merged.set(incoming.orderId, incoming);
    }
  }

  return Array.from(merged.values());
}
