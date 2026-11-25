import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateUnitPriceWithAddons,
  composeOrderItemNote,
  mapProductAddonsByProductId,
  validateAndResolveSelectedAddons,
  type ProductAddonGroupWithOptions,
} from "../addons.ts";

describe("src/lib/addons.ts", () => {
  const sampleGroups: ProductAddonGroupWithOptions[] = [
    {
      id: "grp-spice",
      name: "Level Kepedasan",
      selectionType: "single",
      isRequired: true,
      maxSelect: null,
      sortOrder: 1,
      isActive: true,
      options: [
        {
          id: "opt-mild",
          groupId: "grp-spice",
          name: "Tidak Pedas",
          priceDelta: 0,
          isAvailable: true,
          sortOrder: 1,
        },
        {
          id: "opt-hot",
          groupId: "grp-spice",
          name: "Extra Pedas",
          priceDelta: 2000,
          isAvailable: true,
          sortOrder: 2,
        },
      ],
    },
    {
      id: "grp-topping",
      name: "Tambahan Topping",
      selectionType: "multiple",
      isRequired: false,
      maxSelect: 2,
      sortOrder: 2,
      isActive: true,
      options: [
        {
          id: "opt-egg",
          groupId: "grp-topping",
          name: "Telur Ajitama",
          priceDelta: 6000,
          isAvailable: true,
          sortOrder: 1,
        },
        {
          id: "opt-cheese",
          groupId: "grp-topping",
          name: "Keju Slice",
          priceDelta: 5000,
          isAvailable: true,
          sortOrder: 2,
        },
        {
          id: "opt-soldout",
          groupId: "grp-topping",
          name: "Chashu Ayam",
          priceDelta: 10000,
          isAvailable: false,
          sortOrder: 3,
        },
      ],
    },
  ];

  it("memvalidasi grup wajib, single/multiple limit, dan menghitung total harga add-on integer Rupiah", () => {
    const missingRequired = validateAndResolveSelectedAddons({
      assignedGroups: sampleGroups,
      selectedOptionIds: ["opt-egg"],
    });
    assert.equal(missingRequired.ok, false);

    const tooManySingle = validateAndResolveSelectedAddons({
      assignedGroups: sampleGroups,
      selectedOptionIds: ["opt-mild", "opt-hot"],
    });
    assert.equal(tooManySingle.ok, false);

    const soldOutOpt = validateAndResolveSelectedAddons({
      assignedGroups: sampleGroups,
      selectedOptionIds: ["opt-mild", "opt-soldout"],
    });
    assert.equal(soldOutOpt.ok, false);

    const unassignedOpt = validateAndResolveSelectedAddons({
      assignedGroups: sampleGroups,
      selectedOptionIds: ["opt-mild", "opt-foreign"],
    });
    assert.equal(unassignedOpt.ok, false);

    const valid = validateAndResolveSelectedAddons({
      assignedGroups: sampleGroups,
      selectedOptionIds: ["opt-hot", "opt-egg", "opt-cheese"],
    });
    assert.equal(valid.ok, true);
    if (valid.ok) {
      assert.equal(valid.totalAddonPrice, 13000);
      assert.equal(
        calculateUnitPriceWithAddons(35000, valid.selectedAddons),
        48000
      );
      const composed = composeOrderItemNote(valid.selectedAddons, "kuah pisah");
      assert.ok(composed?.includes("Level Kepedasan: Extra Pedas (+Rp 2.000)"));
      assert.ok(composed?.includes("Tambahan Topping: Telur Ajitama (+Rp 6.000), Keju Slice (+Rp 5.000)"));
      assert.ok(composed?.includes("Catatan: kuah pisah"));
    }
  });

  it("memetakan grup add-on hanya ke menu yang di-assign saja", () => {
    const mapped = mapProductAddonsByProductId({
      groups: [
        {
          id: "g1",
          outlet_id: "o1",
          name: "Level Gula",
          selection_type: "single",
          is_required: true,
          max_select: null,
          sort_order: 1,
          is_active: true,
          created_at: "",
          updated_at: "",
          deleted_at: null,
        },
      ],
      options: [
        {
          id: "opt1",
          group_id: "g1",
          outlet_id: "o1",
          name: "Less Sugar",
          price_delta: 0,
          is_available: true,
          sort_order: 1,
          created_at: "",
          updated_at: "",
          deleted_at: null,
        },
      ],
      assignments: [
        {
          id: "a1",
          outlet_id: "o1",
          product_id: "prod-latte",
          addon_group_id: "g1",
          sort_order: 1,
          created_at: "",
        },
      ],
    });

    assert.equal(mapped["prod-latte"]?.length, 1);
    assert.equal(mapped["prod-nasi-goreng"], undefined);
  });
});
