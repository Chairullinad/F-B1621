export const ORDER_REALTIME_EVENT = "orders_changed";

export type OrderRealtimeBroadcastEventType =
  | "order.created"
  | "order.qris_claimed"
  | "order.paid"
  | "order.updated"
  | "order.cooking"
  | "order.ready"
  | "order.served"
  | "order.cancelled";

export interface OrderRealtimeBroadcastPayload {
  orderId: string;
  eventType: OrderRealtimeBroadcastEventType;
  source?: string | null;
  status?: string | null;
  sentAt: number;
}

export function getOutletOrdersLiveTopic(outletId: string): string {
  return `outlet-orders-live-${outletId}`;
}

export function isOperationalBroadcastEvent(
  payload: Partial<OrderRealtimeBroadcastPayload> | null | undefined
): boolean {
  if (!payload) return true;
  if (
    payload.eventType === "order.created" ||
    payload.eventType === "order.qris_claimed"
  ) {
    return false;
  }
  return true;
}
