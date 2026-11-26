import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getOutletOrdersLiveTopic,
  isOperationalBroadcastEvent,
} from "../realtime-channels.ts";

describe("src/lib/realtime-channels.ts", () => {
  it("membentuk topik channel broadcast per outlet dengan konsisten", () => {
    assert.equal(
      getOutletOrdersLiveTopic("outlet-123"),
      "outlet-orders-live-outlet-123"
    );
  });

  it("mengabaikan event order pending/klaim QRIS untuk layar Kitchen & Antar", () => {
    assert.equal(
      isOperationalBroadcastEvent({
        orderId: "ord-1",
        eventType: "order.created",
      }),
      false
    );
    assert.equal(
      isOperationalBroadcastEvent({
        orderId: "ord-1",
        eventType: "order.qris_claimed",
      }),
      false
    );
    assert.equal(
      isOperationalBroadcastEvent({
        orderId: "ord-1",
        eventType: "order.paid",
      }),
      true
    );
    assert.equal(
      isOperationalBroadcastEvent({
        orderId: "ord-1",
        eventType: "order.ready",
      }),
      true
    );
  });
});
