import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFullOrderVoidDraft,
  diffOrderItemsForVoid,
} from "../cashier-voids.ts";

describe("diffOrderItemsForVoid", () => {
  it("mencatat item yang dihapus penuh atau dikurangi qty-nya", () => {
    const voids = diffOrderItemsForVoid({
      beforeItems: [
        {
          productId: "p1",
          productName: "Tori Paitan Ramen",
          unitPrice: 45000,
          qty: 3,
          lineTotal: 135000,
        },
        {
          productId: "p2",
          productName: "Cold Ocha",
          unitPrice: 10000,
          qty: 2,
          lineTotal: 20000,
        },
      ],
      afterItems: [
        {
          productId: "p1",
          productName: "Tori Paitan Ramen",
          unitPrice: 45000,
          qty: 1,
          lineTotal: 45000,
        },
        {
          productId: "p3",
          productName: "Gyoza",
          unitPrice: 22000,
          qty: 1,
          lineTotal: 22000,
        },
      ],
    });

    assert.equal(voids.length, 2);
    assert.deepEqual(voids[0], {
      productId: "p1",
      productName: "Tori Paitan Ramen",
      qtyBefore: 3,
      qtyAfter: 1,
      qtyCancelled: 2,
      unitPrice: 45000,
      voidAmount: 90000,
    });
    assert.deepEqual(voids[1], {
      productId: "p2",
      productName: "Cold Ocha",
      qtyBefore: 2,
      qtyAfter: 0,
      qtyCancelled: 2,
      unitPrice: 10000,
      voidAmount: 20000,
    });
  });

  it("mengembalikan array kosong jika hanya menambah item atau tidak mengurangi qty", () => {
    const voids = diffOrderItemsForVoid({
      beforeItems: [
        {
          productId: "p1",
          productName: "Tori Paitan Ramen",
          unitPrice: 45000,
          qty: 1,
          lineTotal: 45000,
        },
      ],
      afterItems: [
        {
          productId: "p1",
          productName: "Tori Paitan Ramen",
          unitPrice: 45000,
          qty: 2,
          lineTotal: 90000,
        },
      ],
    });

    assert.equal(voids.length, 0);
  });
});

describe("buildFullOrderVoidDraft", () => {
  it("merangkum beberapa item menjadi 1 baris pembatalan penuh sesuai total tagihan", () => {
    const draft = buildFullOrderVoidDraft({
      items: [
        {
          productId: "p1",
          productName: "Tori Paitan Ramen",
          unitPrice: 45000,
          qty: 2,
          lineTotal: 90000,
        },
        {
          productId: "p2",
          productName: "Cold Ocha",
          unitPrice: 10000,
          qty: 1,
          lineTotal: 10000,
        },
      ],
      orderTotal: 110000,
    });

    assert.equal(draft.productId, null);
    assert.equal(draft.productName, "2x Tori Paitan Ramen, 1x Cold Ocha");
    assert.equal(draft.qtyBefore, 3);
    assert.equal(draft.qtyAfter, 0);
    assert.equal(draft.qtyCancelled, 3);
    assert.equal(draft.voidAmount, 110000);
  });
});
