export type OrderVoidScope = "full_order" | "partial_item";

export interface OrderItemSnapshotForVoid {
  productId: string | null;
  productName: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
}

export interface PartialItemVoidDraft {
  productId: string | null;
  productName: string;
  qtyBefore: number;
  qtyAfter: number;
  qtyCancelled: number;
  unitPrice: number;
  voidAmount: number;
}

export interface FullOrderVoidDraft {
  productId: string | null;
  productName: string;
  qtyBefore: number;
  qtyAfter: 0;
  qtyCancelled: number;
  unitPrice: number;
  voidAmount: number;
}

/**
 * Menghitung item yang jumlahnya dikurangi atau dihapus saat revisi order PENDING.
 * Semua nominal dihitung dalam integer Rupiah.
 */
export function diffOrderItemsForVoid(params: {
  beforeItems: ReadonlyArray<OrderItemSnapshotForVoid>;
  afterItems: ReadonlyArray<OrderItemSnapshotForVoid>;
}): PartialItemVoidDraft[] {
  const beforeAgg = new Map<
    string,
    {
      productId: string | null;
      productName: string;
      qty: number;
      lineTotal: number;
      unitPrice: number;
    }
  >();

  for (const item of params.beforeItems) {
    const key = item.productId ?? `name:${item.productName.trim().toLowerCase()}`;
    const existing = beforeAgg.get(key);
    const safeQty = Math.max(0, Math.trunc(Number(item.qty ?? 0)));
    const safeLineTotal = Math.max(0, Math.round(Number(item.lineTotal ?? 0)));
    const safeUnitPrice = Math.max(0, Math.round(Number(item.unitPrice ?? 0)));
    if (existing) {
      existing.qty += safeQty;
      existing.lineTotal += safeLineTotal;
    } else {
      beforeAgg.set(key, {
        productId: item.productId,
        productName: item.productName,
        qty: safeQty,
        lineTotal: safeLineTotal,
        unitPrice: safeUnitPrice,
      });
    }
  }

  const afterQtyByKey = new Map<string, number>();
  for (const item of params.afterItems) {
    const key = item.productId ?? `name:${item.productName.trim().toLowerCase()}`;
    const safeQty = Math.max(0, Math.trunc(Number(item.qty ?? 0)));
    afterQtyByKey.set(key, (afterQtyByKey.get(key) ?? 0) + safeQty);
  }

  const voids: PartialItemVoidDraft[] = [];
  for (const [key, before] of beforeAgg.entries()) {
    const qtyAfter = afterQtyByKey.get(key) ?? 0;
    if (before.qty <= qtyAfter) continue;

    const qtyCancelled = before.qty - qtyAfter;
    const effectiveUnitPrice =
      before.unitPrice > 0
        ? before.unitPrice
        : before.qty > 0
          ? Math.round(before.lineTotal / before.qty)
          : 0;
    const voidAmount = Math.max(0, effectiveUnitPrice * qtyCancelled);

    voids.push({
      productId: before.productId,
      productName: before.productName,
      qtyBefore: before.qty,
      qtyAfter,
      qtyCancelled,
      unitPrice: effectiveUnitPrice,
      voidAmount,
    });
  }

  return voids;
}

/**
 * Menyusun ringkasan 1 baris untuk pembatalan penuh 1 pesanan agar nominal
 * `voidAmount` tepat sebesar total tagihan / refund order dalam integer Rupiah.
 */
export function buildFullOrderVoidDraft(params: {
  items: ReadonlyArray<OrderItemSnapshotForVoid>;
  orderTotal: number;
}): FullOrderVoidDraft {
  const validItems = params.items.filter((i) => Math.trunc(Number(i.qty ?? 0)) > 0);
  const totalQty = validItems.reduce(
    (sum, item) => sum + Math.trunc(Number(item.qty ?? 0)),
    0,
  );
  const summaryLabel =
    validItems.length > 0
      ? validItems
          .map((item) => `${Math.trunc(Number(item.qty ?? 0))}x ${item.productName}`)
          .join(", ")
      : "Seluruh Pesanan";
  const safeTotal = Math.max(0, Math.round(Number(params.orderTotal ?? 0)));

  const firstItem = validItems[0];

  return {
    productId: validItems.length === 1 && firstItem ? firstItem.productId : null,
    productName: summaryLabel,
    qtyBefore: totalQty > 0 ? totalQty : 1,
    qtyAfter: 0,
    qtyCancelled: totalQty > 0 ? totalQty : 1,
    unitPrice:
      validItems.length === 1 && firstItem
        ? Math.max(0, Math.round(firstItem.unitPrice))
        : safeTotal,
    voidAmount: safeTotal,
  };
}
