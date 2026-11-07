"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { roundRupiah } from "@/lib/money";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  IngredientRow,
  IngredientStorageStock,
  ProductRecipeRow,
  ProductRow,
  PurchaseOrderItemJson,
  PurchaseOrderRow,
  StockMovementRow,
  StockOpnameItemJson,
  StockOpnameRow,
  StockTransferRow,
  SupplierRow,
  WasteLogRow,
} from "@/lib/types/database";
import { requireStaffRole, type ActionResult } from "./auth";

function makeRefCode(prefix: string): string {
  const now = new Date();
  const ymd = now.toISOString().slice(2, 10).replace(/-/g, "");
  const rnd = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${ymd}-${rnd}`;
}

export interface StaffSidebarBadges {
  pending_orders: number;
  pending_opnames: number;
  pending_transfers: number;
  low_stock: number;
  lowStockItems: Array<{
    id: string;
    name: string;
    current_stock: number;
    min_stock: number;
    unit: string;
  }>;
}

export async function getStaffSidebarBadges(
  outletId: string
): Promise<StaffSidebarBadges> {
  const admin = createSupabaseAdminClient();

  const [ordersRes, opnamesRes, transfersRes, ingredientsRes] =
    await Promise.all([
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("outlet_id", outletId)
        .eq("status", "pending")
        .is("deleted_at", null),
      admin
        .from("stock_opnames")
        .select("id", { count: "exact", head: true })
        .eq("outlet_id", outletId)
        .eq("status", "waiting_approval"),
      admin
        .from("stock_transfers")
        .select("id", { count: "exact", head: true })
        .eq("outlet_id", outletId)
        .eq("status", "pending"),
      admin
        .from("ingredients")
        .select("id, name, current_stock, min_stock, unit")
        .eq("outlet_id", outletId)
        .eq("is_active", true)
        .is("deleted_at", null),
    ]);

  const allIngredients = (ingredientsRes.data ?? []) as Array<{
    id: string;
    name: string;
    current_stock: number;
    min_stock: number;
    unit: string;
  }>;

  const lowStockItems = allIngredients
    .map((item) => ({
      id: item.id,
      name: item.name,
      current_stock: Number(item.current_stock),
      min_stock: Number(item.min_stock),
      unit: item.unit,
    }))
    .filter((item) => item.current_stock <= item.min_stock);

  return {
    pending_orders: ordersRes.count ?? 0,
    pending_opnames: opnamesRes.count ?? 0,
    pending_transfers: transfersRes.count ?? 0,
    low_stock: lowStockItems.length,
    lowStockItems,
  };
}

// ============================================================================
// 1. MASTER BAHAN BAKU & RESEP (BOM)
// ============================================================================

export interface InventoryPageData {
  ingredients: IngredientRow[];
  movements: Array<StockMovementRow & { ingredient_name: string; unit: string }>;
  products: ProductRow[];
  recipes: Array<
    ProductRecipeRow & {
      ingredient_name: string;
      unit: string;
      unit_cost: number;
    }
  >;
}

export async function getInventoryPageData(): Promise<InventoryPageData> {
  const staff = await requireStaffRole(["owner", "warehouse", "cashier"]);
  const admin = createSupabaseAdminClient();

  const [ingRes, movRes, prodRes, recRes] = await Promise.all([
    admin
      .from("ingredients")
      .select("*")
      .eq("outlet_id", staff.outletId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    admin
      .from("stock_movements")
      .select("*")
      .eq("outlet_id", staff.outletId)
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("products")
      .select("*")
      .eq("outlet_id", staff.outletId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    admin
      .from("product_recipes")
      .select("*")
      .eq("outlet_id", staff.outletId),
  ]);

  const ingredients: IngredientRow[] = (ingRes.data ?? []).map((row) => ({
    ...(row as IngredientRow),
    current_stock: Number(row.current_stock),
    min_stock: Number(row.min_stock),
    unit_cost: Number(row.unit_cost),
    storage_stock: (row.storage_stock as IngredientStorageStock) ?? {
      gudang: Number(row.current_stock),
      dapur: 0,
      bar: 0,
    },
  }));

  const ingMap = new Map(ingredients.map((i) => [i.id, i]));

  const movements = ((movRes.data ?? []) as StockMovementRow[]).map((m) => {
    const ing = ingMap.get(m.ingredient_id);
    return {
      ...m,
      qty_delta: Number(m.qty_delta),
      stock_before: Number(m.stock_before),
      stock_after: Number(m.stock_after),
      ingredient_name: ing?.name ?? "Bahan Baku",
      unit: ing?.unit ?? "kg",
    };
  });

  const recipes = ((recRes.data ?? []) as ProductRecipeRow[]).map((r) => {
    const ing = ingMap.get(r.ingredient_id);
    return {
      ...r,
      qty_per_portion: Number(r.qty_per_portion),
      ingredient_name: ing?.name ?? "Bahan Baku",
      unit: ing?.unit ?? "kg",
      unit_cost: ing?.unit_cost ?? 0,
    };
  });

  return {
    ingredients,
    movements,
    products: (prodRes.data ?? []) as ProductRow[],
    recipes,
  };
}

const createIngredientSchema = z.object({
  name: z.string().trim().min(2, "Nama bahan minimal 2 karakter.").max(80),
  category: z.string().trim().min(2).max(50),
  unit: z.enum(["kg", "gram", "liter", "ml", "pcs", "porsi"]),
  currentStock: z.number().min(0, "Stok awal tidak boleh negatif."),
  minStock: z.number().min(0, "Stok minimum tidak boleh negatif."),
  unitCost: z.number().int().min(0, "Harga satuan tidak boleh negatif."),
});

export async function createIngredientAction(
  input: z.infer<typeof createIngredientSchema>
): Promise<ActionResult> {
  const staff = await requireStaffRole(["owner", "warehouse"]);
  const parsed = createIngredientSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Input tidak valid.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { name, category, unit, currentStock, minStock, unitCost } =
    parsed.data;

  const { data: created, error } = await admin
    .from("ingredients")
    .insert({
      outlet_id: staff.outletId,
      name,
      category,
      unit,
      current_stock: currentStock,
      min_stock: minStock,
      unit_cost: unitCost,
      storage_stock: {
        gudang: currentStock,
        dapur: 0,
        bar: 0,
      },
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !created) {
    return {
      ok: false,
      message: `Gagal menambah bahan baku: ${error?.message ?? "Unknown"}`,
    };
  }

  if (currentStock > 0) {
    const totalCost = roundRupiah(currentStock * unitCost);
    await admin.from("stock_movements").insert({
      outlet_id: staff.outletId,
      ingredient_id: created.id,
      movement_type: "manual_adjustment",
      qty_delta: currentStock,
      stock_before: 0,
      stock_after: currentStock,
      unit_cost: unitCost,
      total_cost: totalCost,
      reference_type: "initial_stock",
      reference_id: created.id,
      notes: "Stok awal bahan baku baru",
      created_by: staff.userId,
    });
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: `Bahan baku "${name}" berhasil ditambahkan.`,
  };
}

const saveRecipeSchema = z.object({
  productId: z.string().uuid(),
  items: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      qtyPerPortion: z.number().positive("Takaran resep harus > 0."),
    })
  ),
});

export async function saveProductRecipeAction(
  input: z.infer<typeof saveRecipeSchema>
): Promise<ActionResult> {
  const staff = await requireStaffRole(["owner", "warehouse"]);
  const parsed = saveRecipeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Data resep tidak valid.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { productId, items } = parsed.data;

  await admin
    .from("product_recipes")
    .delete()
    .eq("outlet_id", staff.outletId)
    .eq("product_id", productId);

  if (items.length > 0) {
    const rows = items.map((i) => ({
      outlet_id: staff.outletId,
      product_id: productId,
      ingredient_id: i.ingredientId,
      qty_per_portion: i.qtyPerPortion,
    }));
    const { error } = await admin.from("product_recipes").insert(rows);
    if (error) {
      return {
        ok: false,
        message: `Gagal menyimpan resep: ${error.message}`,
      };
    }
  }

  // Hitung ulang cogs_estimate produk
  const { data: ingRows } = await admin
    .from("ingredients")
    .select("id, unit_cost")
    .eq("outlet_id", staff.outletId);
  const costMap = new Map(
    (ingRows ?? []).map((r) => [r.id as string, Number(r.unit_cost)])
  );
  const cogsEstimate = roundRupiah(
    items.reduce(
      (sum, item) =>
        sum + item.qtyPerPortion * (costMap.get(item.ingredientId) ?? 0),
      0
    )
  );

  await admin
    .from("products")
    .update({
      cogs_estimate: cogsEstimate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .eq("outlet_id", staff.outletId);

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/produk");
  return {
    ok: true,
    message: `Resep produk disimpan (Estimasi HPP: Rp ${cogsEstimate.toLocaleString("id-ID")}/porsi).`,
  };
}

/**
 * Dipanggil otomatis saat order berstatus PAID (baik dari Kasir Tunai, Verifikasi QRIS, maupun POS Manual).
 * 1. Memotong stok bahan baku sesuai resep (BOM).
 * 2. Mencatat kartu stok (stock_movements).
 * 3. Menghitung HPP aktual order (orders.cogs_amount).
 * 4. Mencatat 2 Jurnal Akuntansi Otomatis:
 *    - Kas & Bank (D) / Pendapatan Penjualan (K) sebesar total order
 *    - HPP Bahan Baku (D) / Persediaan Bahan Baku (K) sebesar HPP resep
 */
export async function recordOrderPaidInventoryAndAccounting(params: {
  outletId: string;
  orderId: string;
  orderNo: string;
  orderTotal: number;
  paymentMethod: "cash" | "qris";
  actorUserId: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data: orderItems } = await admin
    .from("order_items")
    .select("id, product_id, product_name, qty, line_total")
    .eq("order_id", params.orderId);

  if (!orderItems || orderItems.length === 0) return;

  const productIds = [...new Set(orderItems.map((i) => i.product_id as string))];

  const [{ data: recipes }, { data: ingredients }] = await Promise.all([
    admin
      .from("product_recipes")
      .select("*")
      .eq("outlet_id", params.outletId)
      .in("product_id", productIds),
    admin
      .from("ingredients")
      .select("*")
      .eq("outlet_id", params.outletId)
      .is("deleted_at", null),
  ]);

  const ingMap = new Map(
    (ingredients ?? []).map((ing) => [ing.id as string, ing as IngredientRow])
  );
  const recipesByProduct = new Map<string, ProductRecipeRow[]>();
  for (const r of (recipes ?? []) as ProductRecipeRow[]) {
    const list = recipesByProduct.get(r.product_id) ?? [];
    list.push(r);
    recipesByProduct.set(r.product_id, list);
  }

  let totalOrderCogs = 0;

  for (const item of orderItems) {
    const prodRecipes = recipesByProduct.get(item.product_id as string) ?? [];
    let unitCogs = 0;

    for (const r of prodRecipes) {
      const ing = ingMap.get(r.ingredient_id);
      if (!ing) continue;

      const qtyUsed = Number(
        (Number(r.qty_per_portion) * Number(item.qty)).toFixed(3)
      );
      const stockBefore = Number(ing.current_stock);
      const stockAfter = Math.max(0, Number((stockBefore - qtyUsed).toFixed(3)));
      const unitCost = Number(ing.unit_cost);
      const lineCost = roundRupiah(qtyUsed * unitCost);

      unitCogs += roundRupiah(Number(r.qty_per_portion) * unitCost);

      const currentStorage = (ing.storage_stock as IngredientStorageStock) ?? {
        gudang: stockBefore,
        dapur: 0,
        bar: 0,
      };
      const nextDapur = Math.max(
        0,
        Number(((currentStorage.dapur ?? 0) - qtyUsed).toFixed(3))
      );
      const nextGudang =
        (currentStorage.dapur ?? 0) >= qtyUsed
          ? currentStorage.gudang
          : Math.max(
              0,
              Number(
                (
                  currentStorage.gudang -
                  (qtyUsed - (currentStorage.dapur ?? 0))
                ).toFixed(3)
              )
            );

      ing.current_stock = stockAfter;
      ing.storage_stock = {
        ...currentStorage,
        gudang: nextGudang,
        dapur: nextDapur,
      };

      await admin
        .from("ingredients")
        .update({
          current_stock: stockAfter,
          storage_stock: ing.storage_stock,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ing.id);

      await admin.from("stock_movements").insert({
        outlet_id: params.outletId,
        ingredient_id: ing.id,
        movement_type: "sale_deduct",
        qty_delta: -qtyUsed,
        stock_before: stockBefore,
        stock_after: stockAfter,
        unit_cost: unitCost,
        total_cost: lineCost,
        reference_type: "order",
        reference_id: params.orderNo,
        notes: `Auto-deduct penjualan ${item.qty}x ${item.product_name} (${params.orderNo})`,
        created_by: params.actorUserId,
      });
    }

    if (unitCogs === 0) {
      // Fallback estimasi HPP 32% jika produk belum memiliki resep bahan baku
      unitCogs = roundRupiah(
        (Number(item.line_total) / Math.max(1, Number(item.qty))) * 0.32
      );
    }

    const lineCogs = roundRupiah(unitCogs * Number(item.qty));
    totalOrderCogs += lineCogs;

    await admin
      .from("order_items")
      .update({
        cogs_unit_snapshot: unitCogs,
        cogs_line_total: lineCogs,
      })
      .eq("id", item.id);
  }

  await admin
    .from("orders")
    .update({ cogs_amount: totalOrderCogs })
    .eq("id", params.orderId);

  const cashAccount =
    params.paymentMethod === "qris" ? "Bank / Kas QRIS" : "Kas Tunai";

  // Jurnal 1: Penerimaan Penjualan
  await admin.from("accounting_journals").insert({
    outlet_id: params.outletId,
    journal_no: makeRefCode("JV-POS"),
    entry_date: new Date().toISOString().slice(0, 10),
    description: `Penjualan Order #${params.orderNo} (${params.paymentMethod.toUpperCase()})`,
    debit_account: cashAccount,
    credit_account: "Pendapatan Penjualan",
    amount: params.orderTotal,
    source_type: "order_paid",
    reference_id: params.orderNo,
    created_by: params.actorUserId,
  });

  // Jurnal 2: HPP Bahan Baku
  if (totalOrderCogs > 0) {
    await admin.from("accounting_journals").insert({
      outlet_id: params.outletId,
      journal_no: makeRefCode("JV-HPP"),
      entry_date: new Date().toISOString().slice(0, 10),
      description: `HPP Bahan Baku Order #${params.orderNo}`,
      debit_account: "HPP Bahan Baku",
      credit_account: "Persediaan Bahan Baku",
      amount: totalOrderCogs,
      source_type: "order_cogs",
      reference_id: params.orderNo,
      created_by: params.actorUserId,
    });
  }
}

/**
 * Dipanggil otomatis saat order berstatus PAID/READY/SERVED dibatalkan (refund).
 */
export async function recordOrderRefundInventoryAndAccounting(params: {
  outletId: string;
  orderId: string;
  orderNo: string;
  refundAmount: number;
  reason: string;
  actorUserId: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();

  await admin.from("accounting_journals").insert({
    outlet_id: params.outletId,
    journal_no: makeRefCode("JV-RFD"),
    entry_date: new Date().toISOString().slice(0, 10),
    description: `Refund Order #${params.orderNo} — ${params.reason}`,
    debit_account: "Retur & Refund Penjualan",
    credit_account: "Kas & Bank",
    amount: params.refundAmount,
    source_type: "order_refund",
    reference_id: params.orderNo,
    created_by: params.actorUserId,
  });
}

// ============================================================================
// 2. STOCK OPNAME — BLIND COUNT MODE & APPROVAL OWNER
// ============================================================================

export interface StockOpnamePageData {
  ingredients: Array<{
    id: string;
    name: string;
    category: string;
    unit: string;
    system_stock: number;
    unit_cost: number;
  }>;
  opnames: StockOpnameRow[];
  currentRole: string;
}

export async function getStockOpnamePageData(): Promise<StockOpnamePageData> {
  const staff = await requireStaffRole(["owner", "warehouse"]);
  const admin = createSupabaseAdminClient();

  const [ingRes, opnRes] = await Promise.all([
    admin
      .from("ingredients")
      .select("id, name, category, unit, current_stock, unit_cost")
      .eq("outlet_id", staff.outletId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    admin
      .from("stock_opnames")
      .select("*")
      .eq("outlet_id", staff.outletId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  return {
    ingredients: (ingRes.data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      category: r.category as string,
      unit: r.unit as string,
      system_stock: Number(r.current_stock),
      unit_cost: Number(r.unit_cost),
    })),
    opnames: (opnRes.data ?? []) as StockOpnameRow[],
    currentRole: staff.role,
  };
}

const submitOpnameSchema = z.object({
  counts: z
    .array(
      z.object({
        ingredientId: z.string().uuid(),
        physicalQty: z.number().min(0, "Qty fisik tidak boleh negatif."),
      })
    )
    .min(1, "Minimal 1 bahan baku harus dihitung."),
  notes: z.string().trim().max(300).optional(),
  photoEvidenceNote: z.string().trim().max(200).optional(),
  digitalSignature: z.string().trim().min(2, "Tanda tangan digital (nama terang) wajib diisi."),
});

export async function submitBlindStockOpnameAction(
  input: z.infer<typeof submitOpnameSchema>
): Promise<ActionResult> {
  const staff = await requireStaffRole(["owner", "warehouse"]);
  const parsed = submitOpnameSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Data opname tidak valid.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: ingRows } = await admin
    .from("ingredients")
    .select("*")
    .eq("outlet_id", staff.outletId)
    .is("deleted_at", null);

  const ingMap = new Map(
    (ingRows ?? []).map((r) => [r.id as string, r as IngredientRow])
  );

  const itemsJson: StockOpnameItemJson[] = [];
  let totalVarianceAmount = 0;

  for (const c of parsed.data.counts) {
    const ing = ingMap.get(c.ingredientId);
    if (!ing) continue;
    const systemQty = Number(ing.current_stock);
    const physicalQty = Number(c.physicalQty.toFixed(3));
    const varianceQty = Number((physicalQty - systemQty).toFixed(3));
    const unitCost = Number(ing.unit_cost);
    const varianceAmount = roundRupiah(varianceQty * unitCost);
    totalVarianceAmount += varianceAmount;

    itemsJson.push({
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      unit: ing.unit,
      system_qty: systemQty,
      physical_qty: physicalQty,
      variance_qty: varianceQty,
      unit_cost: unitCost,
      variance_amount: varianceAmount,
    });
  }

  const opnameNo = makeRefCode("OPN");
  const { error } = await admin.from("stock_opnames").insert({
    outlet_id: staff.outletId,
    opname_no: opnameNo,
    opname_date: new Date().toISOString().slice(0, 10),
    status: "waiting_approval",
    items_json: itemsJson,
    total_variance_amount: totalVarianceAmount,
    notes: parsed.data.notes ?? null,
    photo_evidence_note: parsed.data.photoEvidenceNote ?? "Foto bukti opname terlampir",
    digital_signature: parsed.data.digitalSignature,
    submitted_by_name: staff.fullName,
    created_by: staff.userId,
  });

  if (error) {
    return {
      ok: false,
      message: `Gagal mengirim hasil opname: ${error.message}`,
    };
  }

  revalidatePath("/dashboard/opname");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: `Stock Opname ${opnameNo} berhasil disubmit dan menunggu approval Owner.`,
  };
}

export async function approveOrRejectStockOpnameAction(input: {
  opnameId: string;
  decision: "approved" | "rejected";
}): Promise<ActionResult> {
  const staff = await requireStaffRole(["owner"]);
  const admin = createSupabaseAdminClient();

  const { data: opname, error: fetchErr } = await admin
    .from("stock_opnames")
    .select("*")
    .eq("id", input.opnameId)
    .eq("outlet_id", staff.outletId)
    .single();

  if (fetchErr || !opname) {
    return { ok: false, message: "Dokumen Stock Opname tidak ditemukan." };
  }

  if (opname.status !== "waiting_approval") {
    return { ok: false, message: "Stock Opname ini sudah diproses sebelumnya." };
  }

  if (input.decision === "rejected") {
    await admin
      .from("stock_opnames")
      .update({
        status: "rejected",
        approved_by: staff.userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", opname.id);

    revalidatePath("/dashboard/opname");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: `Stock Opname ${opname.opname_no} ditolak.`,
    };
  }

  const items = (opname.items_json ?? []) as StockOpnameItemJson[];
  for (const item of items) {
    if (Math.abs(item.variance_qty) < 0.001) continue;

    await admin
      .from("ingredients")
      .update({
        current_stock: item.physical_qty,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.ingredient_id)
      .eq("outlet_id", staff.outletId);

    await admin.from("stock_movements").insert({
      outlet_id: staff.outletId,
      ingredient_id: item.ingredient_id,
      movement_type: "opname_adjustment",
      qty_delta: item.variance_qty,
      stock_before: item.system_qty,
      stock_after: item.physical_qty,
      unit_cost: item.unit_cost,
      total_cost: Math.abs(item.variance_amount),
      reference_type: "stock_opname",
      reference_id: opname.opname_no,
      notes: `Penyesuaian Stock Opname ${opname.opname_no}`,
      created_by: staff.userId,
    });
  }

  await admin
    .from("stock_opnames")
    .update({
      status: "approved",
      approved_by: staff.userId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", opname.id);

  const netVariance = Number(opname.total_variance_amount);
  if (netVariance !== 0) {
    await admin.from("accounting_journals").insert({
      outlet_id: staff.outletId,
      journal_no: makeRefCode("JV-OPN"),
      entry_date: new Date().toISOString().slice(0, 10),
      description: `Penyesuaian Selisih Stock Opname (${opname.opname_no})`,
      debit_account:
        netVariance < 0 ? "Beban Selisih Opname" : "Persediaan Bahan Baku",
      credit_account:
        netVariance < 0 ? "Persediaan Bahan Baku" : "Pendapatan Selisih Opname",
      amount: Math.abs(netVariance),
      source_type: "opname",
      reference_id: opname.opname_no,
      created_by: staff.userId,
    });
  }

  revalidatePath("/dashboard/opname");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/keuangan");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: `Stock Opname ${opname.opname_no} di-approve! Stok bahan baku & jurnal akuntansi telah diperbarui otomatis.`,
  };
}

// ============================================================================
// 3. WASTE & SPOILAGE TRACKING
// ============================================================================

export interface WastePageData {
  ingredients: IngredientRow[];
  wasteLogs: WasteLogRow[];
  totalRevenueMonth: number;
}

export async function getWastePageData(): Promise<WastePageData> {
  const staff = await requireStaffRole(["owner", "warehouse"]);
  const admin = createSupabaseAdminClient();

  const [ingRes, wasteRes, journalsRes] = await Promise.all([
    admin
      .from("ingredients")
      .select("*")
      .eq("outlet_id", staff.outletId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    admin
      .from("waste_logs")
      .select("*")
      .eq("outlet_id", staff.outletId)
      .order("waste_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("accounting_journals")
      .select("amount")
      .eq("outlet_id", staff.outletId)
      .eq("source_type", "order_paid"),
  ]);

  const totalRevenueMonth = (journalsRes.data ?? []).reduce(
    (sum, r) => sum + Number(r.amount),
    0
  );

  return {
    ingredients: (ingRes.data ?? []).map((r) => ({
      ...(r as IngredientRow),
      current_stock: Number(r.current_stock),
      min_stock: Number(r.min_stock),
      unit_cost: Number(r.unit_cost),
    })),
    wasteLogs: ((wasteRes.data ?? []) as WasteLogRow[]).map((w) => ({
      ...w,
      qty: Number(w.qty),
      cost_amount: Number(w.cost_amount),
    })),
    totalRevenueMonth: Math.max(totalRevenueMonth, 3850000),
  };
}

const recordWasteSchema = z.object({
  ingredientId: z.string().uuid(),
  qty: z.number().positive("Kuantitas waste harus > 0."),
  reason: z.enum(["Busuk", "Expired", "Tumpah", "Rusak Produksi", "Lainnya"]),
  notes: z.string().trim().max(200).optional(),
});

export async function recordWasteAction(
  input: z.infer<typeof recordWasteSchema>
): Promise<ActionResult> {
  const staff = await requireStaffRole(["owner", "warehouse"]);
  const parsed = recordWasteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Input waste tidak valid.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: ing } = await admin
    .from("ingredients")
    .select("*")
    .eq("id", parsed.data.ingredientId)
    .eq("outlet_id", staff.outletId)
    .single();

  if (!ing) {
    return { ok: false, message: "Bahan baku tidak ditemukan." };
  }

  const stockBefore = Number(ing.current_stock);
  const qty = Number(parsed.data.qty.toFixed(3));
  const stockAfter = Math.max(0, Number((stockBefore - qty).toFixed(3)));
  const costAmount = roundRupiah(qty * Number(ing.unit_cost));

  const { error: wErr } = await admin.from("waste_logs").insert({
    outlet_id: staff.outletId,
    waste_date: new Date().toISOString().slice(0, 10),
    ingredient_id: ing.id,
    ingredient_name_snapshot: ing.name,
    qty,
    unit: ing.unit,
    reason: parsed.data.reason,
    cost_amount: costAmount,
    recorded_by_name: staff.fullName,
    created_by: staff.userId,
    notes: parsed.data.notes ?? null,
  });

  if (wErr) {
    return { ok: false, message: `Gagal mencatat waste: ${wErr.message}` };
  }

  await admin
    .from("ingredients")
    .update({
      current_stock: stockAfter,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ing.id);

  await admin.from("stock_movements").insert({
    outlet_id: staff.outletId,
    ingredient_id: ing.id,
    movement_type: "waste",
    qty_delta: -qty,
    stock_before: stockBefore,
    stock_after: stockAfter,
    unit_cost: Number(ing.unit_cost),
    total_cost: costAmount,
    reference_type: "waste",
    reference_id: parsed.data.reason,
    notes: `Waste (${parsed.data.reason}): ${parsed.data.notes ?? ""}`,
    created_by: staff.userId,
  });

  await admin.from("accounting_journals").insert({
    outlet_id: staff.outletId,
    journal_no: makeRefCode("JV-WST"),
    entry_date: new Date().toISOString().slice(0, 10),
    description: `Waste Bahan Baku: ${ing.name} (${qty} ${ing.unit} - ${parsed.data.reason})`,
    debit_account: "Beban Waste & Spoilage",
    credit_account: "Persediaan Bahan Baku",
    amount: costAmount,
    source_type: "waste",
    reference_id: ing.name,
    created_by: staff.userId,
  });

  revalidatePath("/dashboard/waste");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/keuangan");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: `Waste ${ing.name} (${qty} ${ing.unit}) tercatat. Stok berkurang & Jurnal Beban Waste Rp ${costAmount.toLocaleString("id-ID")} tercatat otomatis.`,
  };
}

// ============================================================================
// 4. SUPPLIER & PURCHASE ORDER (PO)
// ============================================================================

export interface SupplierPageData {
  suppliers: SupplierRow[];
  purchaseOrders: PurchaseOrderRow[];
  ingredients: IngredientRow[];
}

export async function getSupplierPageData(): Promise<SupplierPageData> {
  const staff = await requireStaffRole(["owner", "warehouse", "cashier"]);
  const admin = createSupabaseAdminClient();

  const [supRes, poRes, ingRes] = await Promise.all([
    admin
      .from("suppliers")
      .select("*")
      .eq("outlet_id", staff.outletId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    admin
      .from("purchase_orders")
      .select("*")
      .eq("outlet_id", staff.outletId)
      .order("created_at", { ascending: false })
      .limit(35),
    admin
      .from("ingredients")
      .select("*")
      .eq("outlet_id", staff.outletId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
  ]);

  return {
    suppliers: (supRes.data ?? []) as SupplierRow[],
    purchaseOrders: (poRes.data ?? []) as PurchaseOrderRow[],
    ingredients: (ingRes.data ?? []).map((r) => ({
      ...(r as IngredientRow),
      current_stock: Number(r.current_stock),
      min_stock: Number(r.min_stock),
      unit_cost: Number(r.unit_cost),
    })),
  };
}

const createSupplierSchema = z.object({
  name: z.string().trim().min(2, "Nama supplier minimal 2 karakter.").max(100),
  category: z.string().trim().min(2).max(60),
  contact: z.string().trim().min(4).max(50),
  address: z.string().trim().min(3).max(150),
  paymentTerm: z.enum(["COD", "7 Hari", "14 Hari", "30 Hari"]),
  rating: z.number().int().min(1).max(5),
});

export async function createSupplierAction(
  input: z.infer<typeof createSupplierSchema>
): Promise<ActionResult> {
  const staff = await requireStaffRole(["owner", "warehouse"]);
  const parsed = createSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Input supplier tidak valid.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("suppliers").insert({
    outlet_id: staff.outletId,
    name: parsed.data.name,
    category: parsed.data.category,
    contact: parsed.data.contact,
    address: parsed.data.address,
    payment_term: parsed.data.paymentTerm,
    rating: parsed.data.rating,
    payable_balance: 0,
    is_active: true,
  });

  if (error) {
    return { ok: false, message: `Gagal menambah supplier: ${error.message}` };
  }

  revalidatePath("/dashboard/supplier");
  return {
    ok: true,
    message: `Supplier "${parsed.data.name}" berhasil ditambahkan.`,
  };
}

const createPoSchema = z.object({
  supplierId: z.string().uuid(),
  ingredientId: z.string().uuid(),
  qty: z.number().positive("Kuantitas beli harus > 0."),
  unitCost: z.number().int().positive("Harga satuan harus > 0."),
  notes: z.string().trim().max(200).optional(),
});

export async function createPurchaseOrderAction(
  input: z.infer<typeof createPoSchema>
): Promise<ActionResult> {
  const staff = await requireStaffRole(["owner", "warehouse"]);
  const parsed = createPoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Input PO tidak valid.",
    };
  }

  const admin = createSupabaseAdminClient();
  const [{ data: sup }, { data: ing }] = await Promise.all([
    admin
      .from("suppliers")
      .select("*")
      .eq("id", parsed.data.supplierId)
      .eq("outlet_id", staff.outletId)
      .single(),
    admin
      .from("ingredients")
      .select("*")
      .eq("id", parsed.data.ingredientId)
      .eq("outlet_id", staff.outletId)
      .single(),
  ]);

  if (!sup || !ing) {
    return { ok: false, message: "Supplier atau bahan baku tidak ditemukan." };
  }

  const subtotal = roundRupiah(parsed.data.qty * parsed.data.unitCost);
  const poNo = makeRefCode("PO");
  const itemJson: PurchaseOrderItemJson = {
    ingredient_id: ing.id,
    ingredient_name: ing.name,
    qty: parsed.data.qty,
    unit: ing.unit,
    unit_cost: parsed.data.unitCost,
    subtotal,
  };

  const { error } = await admin.from("purchase_orders").insert({
    outlet_id: staff.outletId,
    po_no: poNo,
    supplier_id: sup.id,
    supplier_name_snapshot: sup.name,
    order_date: new Date().toISOString().slice(0, 10),
    status: "pending",
    items_summary: `${ing.name} ${parsed.data.qty} ${ing.unit}`,
    items_json: [itemJson],
    total_amount: subtotal,
    paid_amount: 0,
    notes: parsed.data.notes ?? null,
    created_by: staff.userId,
  });

  if (error) {
    return { ok: false, message: `Gagal membuat PO: ${error.message}` };
  }

  revalidatePath("/dashboard/supplier");
  return {
    ok: true,
    message: `Purchase Order ${poNo} ke ${sup.name} senilai Rp ${subtotal.toLocaleString("id-ID")} berhasil dibuat.`,
  };
}

export async function receivePurchaseOrderAction(input: {
  poId: string;
}): Promise<ActionResult> {
  const staff = await requireStaffRole(["owner", "warehouse"]);
  const admin = createSupabaseAdminClient();

  const { data: po } = await admin
    .from("purchase_orders")
    .select("*")
    .eq("id", input.poId)
    .eq("outlet_id", staff.outletId)
    .single();

  if (!po) {
    return { ok: false, message: "Purchase Order tidak ditemukan." };
  }
  if (po.status === "diterima" || po.status === "lunas") {
    return { ok: false, message: "Purchase Order ini sudah diterima." };
  }

  const { data: sup } = await admin
    .from("suppliers")
    .select("*")
    .eq("id", po.supplier_id)
    .single();

  const items = (po.items_json ?? []) as PurchaseOrderItemJson[];
  for (const item of items) {
    const { data: ing } = await admin
      .from("ingredients")
      .select("*")
      .eq("id", item.ingredient_id)
      .single();
    if (!ing) continue;

    const stockBefore = Number(ing.current_stock);
    const stockAfter = Number((stockBefore + Number(item.qty)).toFixed(3));
    const storage = (ing.storage_stock as IngredientStorageStock) ?? {
      gudang: stockBefore,
      dapur: 0,
      bar: 0,
    };

    await admin
      .from("ingredients")
      .update({
        current_stock: stockAfter,
        unit_cost: item.unit_cost,
        storage_stock: {
          ...storage,
          gudang: Number(((storage.gudang ?? 0) + Number(item.qty)).toFixed(3)),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", ing.id);

    await admin.from("stock_movements").insert({
      outlet_id: staff.outletId,
      ingredient_id: ing.id,
      movement_type: "po_receive",
      qty_delta: Number(item.qty),
      stock_before: stockBefore,
      stock_after: stockAfter,
      unit_cost: item.unit_cost,
      total_cost: item.subtotal,
      reference_type: "purchase_order",
      reference_id: po.po_no,
      notes: `Penerimaan ${po.po_no} dari ${po.supplier_name_snapshot}`,
      created_by: staff.userId,
    });
  }

  const isCod = sup?.payment_term === "COD";
  await admin
    .from("purchase_orders")
    .update({
      status: isCod ? "lunas" : "diterima",
      paid_amount: isCod ? po.total_amount : 0,
      received_at: new Date().toISOString(),
      paid_at: isCod ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", po.id);

  if (!isCod && sup) {
    await admin
      .from("suppliers")
      .update({
        payable_balance: Number(sup.payable_balance) + Number(po.total_amount),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sup.id);
  }

  await admin.from("accounting_journals").insert({
    outlet_id: staff.outletId,
    journal_no: makeRefCode("JV-PO"),
    entry_date: new Date().toISOString().slice(0, 10),
    description: `Penerimaan ${po.po_no} — ${po.supplier_name_snapshot} (${po.items_summary})`,
    debit_account: "Persediaan Bahan Baku",
    credit_account: isCod ? "Kas & Bank" : "Hutang Usaha",
    amount: Number(po.total_amount),
    source_type: "po_received",
    reference_id: po.po_no,
    created_by: staff.userId,
  });

  revalidatePath("/dashboard/supplier");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/keuangan");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: `PO ${po.po_no} diterima! Stok gudang bertambah & Jurnal Akuntansi Rp ${Number(po.total_amount).toLocaleString("id-ID")} tercatat otomatis.`,
  };
}

export async function paySupplierPurchaseOrderAction(input: {
  poId: string;
}): Promise<ActionResult> {
  const staff = await requireStaffRole(["owner"]);
  const admin = createSupabaseAdminClient();

  const { data: po } = await admin
    .from("purchase_orders")
    .select("*")
    .eq("id", input.poId)
    .eq("outlet_id", staff.outletId)
    .single();

  if (!po || po.status !== "diterima") {
    return {
      ok: false,
      message: "Hanya PO berstatus 'diterima' yang dapat dilunasi.",
    };
  }

  const { data: sup } = await admin
    .from("suppliers")
    .select("*")
    .eq("id", po.supplier_id)
    .single();

  await admin
    .from("purchase_orders")
    .update({
      status: "lunas",
      paid_amount: po.total_amount,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", po.id);

  if (sup) {
    await admin
      .from("suppliers")
      .update({
        payable_balance: Math.max(
          0,
          Number(sup.payable_balance) - Number(po.total_amount)
        ),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sup.id);
  }

  await admin.from("accounting_journals").insert({
    outlet_id: staff.outletId,
    journal_no: makeRefCode("JV-PAY"),
    entry_date: new Date().toISOString().slice(0, 10),
    description: `Pelunasan Hutang ${po.po_no} — ${po.supplier_name_snapshot}`,
    debit_account: "Hutang Usaha",
    credit_account: "Kas & Bank",
    amount: Number(po.total_amount),
    source_type: "po_paid",
    reference_id: po.po_no,
    created_by: staff.userId,
  });

  revalidatePath("/dashboard/supplier");
  revalidatePath("/dashboard/keuangan");
  return {
    ok: true,
    message: `Hutang ${po.po_no} ke ${po.supplier_name_snapshot} berhasil dilunasi.`,
  };
}

// ============================================================================
// 5. TRANSFER / MUTASI STOK ANTAR LOKASI (GUDANG <-> DAPUR <-> BAR)
// ============================================================================

export interface StockTransferPageData {
  ingredients: IngredientRow[];
  transfers: StockTransferRow[];
  currentRole: string;
}

export async function getStockTransferPageData(): Promise<StockTransferPageData> {
  const staff = await requireStaffRole(["owner", "warehouse", "cashier"]);
  const admin = createSupabaseAdminClient();

  const [ingRes, trfRes] = await Promise.all([
    admin
      .from("ingredients")
      .select("*")
      .eq("outlet_id", staff.outletId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    admin
      .from("stock_transfers")
      .select("*")
      .eq("outlet_id", staff.outletId)
      .order("created_at", { ascending: false })
      .limit(35),
  ]);

  return {
    ingredients: (ingRes.data ?? []).map((r) => ({
      ...(r as IngredientRow),
      current_stock: Number(r.current_stock),
      min_stock: Number(r.min_stock),
      unit_cost: Number(r.unit_cost),
      storage_stock: (r.storage_stock as IngredientStorageStock) ?? {
        gudang: Number(r.current_stock),
        dapur: 0,
        bar: 0,
      },
    })),
    transfers: ((trfRes.data ?? []) as StockTransferRow[]).map((t) => ({
      ...t,
      qty: Number(t.qty),
      total_value: Number(t.total_value),
    })),
    currentRole: staff.role,
  };
}

const createTransferSchema = z.object({
  fromLocation: z.enum(["Gudang Utama", "Dapur Utama", "Bar Minuman"]),
  toLocation: z.enum(["Gudang Utama", "Dapur Utama", "Bar Minuman"]),
  ingredientId: z.string().uuid(),
  qty: z.number().positive("Kuantitas transfer harus > 0."),
  notes: z.string().trim().max(200).optional(),
});

function locationToKey(loc: string): keyof IngredientStorageStock {
  if (loc.toLowerCase().includes("dapur")) return "dapur";
  if (loc.toLowerCase().includes("bar")) return "bar";
  return "gudang";
}

export async function createStockTransferAction(
  input: z.infer<typeof createTransferSchema>
): Promise<ActionResult> {
  const staff = await requireStaffRole(["owner", "warehouse", "cashier"]);
  const parsed = createTransferSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Input transfer tidak valid.",
    };
  }

  if (parsed.data.fromLocation === parsed.data.toLocation) {
    return {
      ok: false,
      message: "Lokasi asal dan lokasi tujuan tidak boleh sama.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: ing } = await admin
    .from("ingredients")
    .select("*")
    .eq("id", parsed.data.ingredientId)
    .eq("outlet_id", staff.outletId)
    .single();

  if (!ing) {
    return { ok: false, message: "Bahan baku tidak ditemukan." };
  }

  const storage = (ing.storage_stock as IngredientStorageStock) ?? {
    gudang: Number(ing.current_stock),
    dapur: 0,
    bar: 0,
  };
  const fromKey = locationToKey(parsed.data.fromLocation);
  const availableAtOrigin = Number(storage[fromKey] ?? 0);

  if (parsed.data.qty > availableAtOrigin) {
    return {
      ok: false,
      message: `Stok di ${parsed.data.fromLocation} tidak cukup! Tersedia: ${availableAtOrigin} ${ing.unit}.`,
    };
  }

  const transferNo = makeRefCode("TRF");
  const totalValue = roundRupiah(parsed.data.qty * Number(ing.unit_cost));

  const { error } = await admin.from("stock_transfers").insert({
    outlet_id: staff.outletId,
    transfer_no: transferNo,
    transfer_date: new Date().toISOString().slice(0, 10),
    from_location: parsed.data.fromLocation,
    to_location: parsed.data.toLocation,
    ingredient_id: ing.id,
    ingredient_name_snapshot: ing.name,
    qty: parsed.data.qty,
    unit: ing.unit,
    total_value: totalValue,
    status: "pending",
    sender_name: staff.fullName,
    notes: parsed.data.notes ?? null,
    created_by: staff.userId,
  });

  if (error) {
    return { ok: false, message: `Gagal membuat transfer: ${error.message}` };
  }

  revalidatePath("/dashboard/transfer-stok");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: `Request Transfer ${transferNo} (${parsed.data.fromLocation} → ${parsed.data.toLocation}) berhasil dibuat dan menunggu approval.`,
  };
}

export async function approveStockTransferAction(input: {
  transferId: string;
}): Promise<ActionResult> {
  const staff = await requireStaffRole(["owner", "cashier"]);
  const admin = createSupabaseAdminClient();

  const { data: trf } = await admin
    .from("stock_transfers")
    .select("*")
    .eq("id", input.transferId)
    .eq("outlet_id", staff.outletId)
    .single();

  if (!trf || trf.status !== "pending") {
    return { ok: false, message: "Transfer stok tidak dalam status pending." };
  }

  const { data: ing } = await admin
    .from("ingredients")
    .select("*")
    .eq("id", trf.ingredient_id)
    .single();

  if (!ing) {
    return { ok: false, message: "Bahan baku tidak ditemukan." };
  }

  const storage = (ing.storage_stock as IngredientStorageStock) ?? {
    gudang: Number(ing.current_stock),
    dapur: 0,
    bar: 0,
  };
  const fromKey = locationToKey(trf.from_location);
  const available = Number(storage[fromKey] ?? 0);
  if (Number(trf.qty) > available) {
    return {
      ok: false,
      message: `Stok ${trf.from_location} tidak mencukupi (${available} ${trf.unit}).`,
    };
  }

  storage[fromKey] = Number((available - Number(trf.qty)).toFixed(3));

  await admin
    .from("ingredients")
    .update({
      storage_stock: storage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ing.id);

  await admin
    .from("stock_transfers")
    .update({
      status: "in_transit",
      approved_by: staff.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", trf.id);

  await admin.from("accounting_journals").insert({
    outlet_id: staff.outletId,
    journal_no: makeRefCode("JV-TRF1"),
    entry_date: new Date().toISOString().slice(0, 10),
    description: `Transfer ${trf.transfer_no} (${trf.from_location} → ${trf.to_location}) In-Transit`,
    debit_account: "Persediaan In-Transit",
    credit_account: `Persediaan ${trf.from_location}`,
    amount: Number(trf.total_value),
    source_type: "transfer",
    reference_id: trf.transfer_no,
    created_by: staff.userId,
  });

  revalidatePath("/dashboard/transfer-stok");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/keuangan");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: `Transfer ${trf.transfer_no} di-approve (In-Transit). Stok ${trf.from_location} dikurangi & Jurnal In-Transit tercatat.`,
  };
}

export async function receiveStockTransferAction(input: {
  transferId: string;
}): Promise<ActionResult> {
  const staff = await requireStaffRole(["owner", "warehouse", "cashier"]);
  const admin = createSupabaseAdminClient();

  const { data: trf } = await admin
    .from("stock_transfers")
    .select("*")
    .eq("id", input.transferId)
    .eq("outlet_id", staff.outletId)
    .single();

  if (!trf || trf.status !== "in_transit") {
    return {
      ok: false,
      message: "Hanya transfer berstatus In-Transit yang dapat diterima.",
    };
  }

  const { data: ing } = await admin
    .from("ingredients")
    .select("*")
    .eq("id", trf.ingredient_id)
    .single();

  if (ing) {
    const storage = (ing.storage_stock as IngredientStorageStock) ?? {
      gudang: Number(ing.current_stock),
      dapur: 0,
      bar: 0,
    };
    const toKey = locationToKey(trf.to_location);
    storage[toKey] = Number(
      (Number(storage[toKey] ?? 0) + Number(trf.qty)).toFixed(3)
    );

    await admin
      .from("ingredients")
      .update({
        storage_stock: storage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ing.id);
  }

  await admin
    .from("stock_transfers")
    .update({
      status: "received",
      receiver_name: staff.fullName,
      received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", trf.id);

  await admin.from("accounting_journals").insert({
    outlet_id: staff.outletId,
    journal_no: makeRefCode("JV-TRF2"),
    entry_date: new Date().toISOString().slice(0, 10),
    description: `Penerimaan Transfer ${trf.transfer_no} di ${trf.to_location}`,
    debit_account: `Persediaan ${trf.to_location}`,
    credit_account: "Persediaan In-Transit",
    amount: Number(trf.total_value),
    source_type: "transfer",
    reference_id: trf.transfer_no,
    created_by: staff.userId,
  });

  revalidatePath("/dashboard/transfer-stok");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/keuangan");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: `Transfer ${trf.transfer_no} diterima di ${trf.to_location}! Stok & jurnal selesai diperbarui.`,
  };
}

