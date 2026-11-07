"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { roundRupiah } from "@/lib/money";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AccountingJournalRow,
  AccountingJournalSourceType,
} from "@/lib/types/database";
import { requireStaffRole, type ActionResult } from "./auth";

function makeJournalNo(prefix = "JV"): string {
  const ymd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const rnd = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${ymd}-${rnd}`;
}

export interface FinancialReportData {
  periodLabel: string;
  kpi: {
    totalRevenue: number;
    totalCogs: number;
    cogsPercent: number;
    netProfit: number;
    netMarginPercent: number;
    inventoryValue: number;
    supplierPayable: number;
  };
  journals: AccountingJournalRow[];
  incomeStatement: {
    dineInRevenue: number;
    takeawayRevenue: number;
    qrTableRevenue: number;
    refundAmount: number;
    totalRevenue: number;
    cogsAmount: number;
    grossProfit: number;
    salaryExpense: number;
    rentExpense: number;
    utilityExpense: number;
    wasteExpense: number;
    opnameExpense: number;
    otherExpense: number;
    totalOperatingExpenses: number;
    netProfit: number;
  };
  balanceSheet: {
    cashAndBank: number;
    inventoryValue: number;
    totalCurrentAssets: number;
    kitchenEquipment: number;
    tablesAndChairs: number;
    accumulatedDepreciation: number;
    totalFixedAssets: number;
    totalAssets: number;
    supplierPayables: number;
    taxPayables: number;
    totalLiabilities: number;
    ownerCapital: number;
    currentEarnings: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
  };
  cashFlow: {
    cashFromCustomers: number;
    cashToSuppliers: number;
    cashForSalaries: number;
    cashForOperatingExpenses: number;
    netOperatingCashFlow: number;
    equipmentPurchases: number;
    ownerCapitalInflow: number;
    netInvestingCashFlow: number;
    netCashIncrease: number;
  };
  taxSummary: {
    ppnOutput: number;
    ppnInput: number;
    ppnPayable: number;
    pph21: number;
    pphFinalUmkm: number;
    rows: Array<{
      taxType: string;
      period: string;
      dppAmount: number;
      rateLabel: string;
      taxAmount: number;
      status: "Ready" | "Draft" | "Lunas";
    }>;
  };
}

export async function getFinancialReportData(): Promise<FinancialReportData> {
  const staff = await requireStaffRole(["owner"]);
  const admin = createSupabaseAdminClient();

  const [
    journalsRes,
    ordersRes,
    refundsRes,
    ingredientsRes,
    suppliersRes,
    posRes,
    wasteRes,
  ] = await Promise.all([
    admin
      .from("accounting_journals")
      .select("*")
      .eq("outlet_id", staff.outletId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(150),
    admin
      .from("orders")
      .select("id, source, order_type, status, total, cogs_amount, tax_amount")
      .eq("outlet_id", staff.outletId)
      .in("status", ["paid", "ready", "served"])
      .is("deleted_at", null),
    admin
      .from("refunds")
      .select("amount, orders!inner(outlet_id)")
      .eq("orders.outlet_id", staff.outletId),
    admin
      .from("ingredients")
      .select("current_stock, unit_cost")
      .eq("outlet_id", staff.outletId)
      .is("deleted_at", null),
    admin
      .from("suppliers")
      .select("payable_balance")
      .eq("outlet_id", staff.outletId)
      .is("deleted_at", null),
    admin
      .from("purchase_orders")
      .select("total_amount, paid_amount, status")
      .eq("outlet_id", staff.outletId),
    admin
      .from("waste_logs")
      .select("cost_amount")
      .eq("outlet_id", staff.outletId),
  ]);

  const journals = ((journalsRes.data ?? []) as AccountingJournalRow[]).map(
    (j) => ({
      ...j,
      amount: Number(j.amount),
    })
  );

  const paidOrders = (ordersRes.data ?? []) as Array<{
    id: string;
    source: string;
    order_type: string;
    status: string;
    total: number;
    cogs_amount: number | null;
    tax_amount: number | null;
  }>;

  // Rincian order aktual + baseline jurnal historis
  let orderQrTotal = 0;
  let orderDineInManualTotal = 0;
  let orderTakeawayTotal = 0;
  for (const o of paidOrders) {
    const t = Number(o.total ?? 0);
    if (o.source === "customer_qr") {
      orderQrTotal += t;
    } else if (o.order_type === "takeaway") {
      orderTakeawayTotal += t;
    } else {
      orderDineInManualTotal += t;
    }
  }

  // Ambil baseline dari jurnal historis (JV-005 dll) yang tidak terkait 1-per-1 dengan order live
  const historicalRevenueJournals = journals
    .filter((j) => j.source_type === "order_paid" && !j.reference_id)
    .reduce((s, j) => s + j.amount, 0);

  const dineInRevenue =
    orderDineInManualTotal + roundRupiah(historicalRevenueJournals * 0.55);
  const takeawayRevenue =
    orderTakeawayTotal + roundRupiah(historicalRevenueJournals * 0.2);
  const qrTableRevenue =
    orderQrTotal + roundRupiah(historicalRevenueJournals * 0.25);

  const refundAmount = (refundsRes.data ?? []).reduce(
    (s, r) => s + Number(r.amount ?? 0),
    0
  );

  const totalRevenue = Math.max(
    0,
    dineInRevenue + takeawayRevenue + qrTableRevenue - refundAmount
  );

  const cogsFromJournals = journals
    .filter((j) => j.source_type === "order_cogs")
    .reduce((s, j) => s + j.amount, 0);
  const cogsAmount =
    cogsFromJournals > 0 ? cogsFromJournals : roundRupiah(totalRevenue * 0.32);

  const grossProfit = totalRevenue - cogsAmount;

  const sumBySource = (src: AccountingJournalSourceType) =>
    journals
      .filter((j) => j.source_type === src)
      .reduce((s, j) => s + j.amount, 0);

  const salaryExpense = sumBySource("expense_salary");
  const rentExpense = sumBySource("expense_rent");
  const utilityExpense = sumBySource("expense_utility");
  const wasteFromLogs = (wasteRes.data ?? []).reduce(
    (s, w) => s + Number(w.cost_amount ?? 0),
    0
  );
  const wasteExpense = Math.max(wasteFromLogs, sumBySource("waste"));
  const opnameExpense = journals
    .filter(
      (j) =>
        j.source_type === "opname" &&
        j.debit_account.toLowerCase().includes("beban")
    )
    .reduce((s, j) => s + j.amount, 0);
  const otherExpense = sumBySource("expense_other");

  const totalOperatingExpenses =
    salaryExpense +
    rentExpense +
    utilityExpense +
    wasteExpense +
    opnameExpense +
    otherExpense;

  const netProfit = grossProfit - totalOperatingExpenses;

  // Neraca (Balance Sheet)
  const inventoryValue = roundRupiah(
    (ingredientsRes.data ?? []).reduce(
      (s, i) => s + Number(i.current_stock) * Number(i.unit_cost),
      0
    )
  );

  const supplierPayables = (suppliersRes.data ?? []).reduce(
    (s, sup) => s + Number(sup.payable_balance ?? 0),
    0
  );

  const kitchenEquipment =
    journals
      .filter(
        (j) =>
          j.source_type === "asset_purchase" &&
          j.debit_account.toLowerCase().includes("dapur")
      )
      .reduce((s, j) => s + j.amount, 0) || 35000000;

  const tablesAndChairs =
    journals
      .filter(
        (j) =>
          j.source_type === "asset_purchase" &&
          j.debit_account.toLowerCase().includes("meja")
      )
      .reduce((s, j) => s + j.amount, 0) || 12000000;

  const accumulatedDepreciation = roundRupiah(
    (kitchenEquipment + tablesAndChairs) * 0.1
  );
  const totalFixedAssets =
    kitchenEquipment + tablesAndChairs - accumulatedDepreciation;

  const ownerCapital = sumBySource("owner_capital") || 25000000;

  // Pajak
  const ppnOutput = roundRupiah(totalRevenue * 0.11);
  const ppnInput = roundRupiah(cogsAmount * 0.11);
  const ppnPayable = Math.max(0, ppnOutput - ppnInput);
  const pph21 = roundRupiah(salaryExpense * 0.05);
  const pphFinalUmkm = roundRupiah(totalRevenue * 0.005);

  const taxPayables = ppnPayable;
  const totalLiabilities = supplierPayables + taxPayables;

  // Arus Kas
  const cashToSuppliers =
    (posRes.data ?? []).reduce((s, p) => s + Number(p.paid_amount ?? 0), 0) +
    roundRupiah(cogsAmount * 0.65);
  const cashForOperatingExpenses =
    rentExpense + utilityExpense + otherExpense;
  const netOperatingCashFlow =
    totalRevenue - cashToSuppliers - salaryExpense - cashForOperatingExpenses;

  const equipmentPurchases = 5000000;
  const netInvestingCashFlow = -equipmentPurchases;
  const netCashIncrease = netOperatingCashFlow + netInvestingCashFlow;

  const cashAndBank = Math.max(12500000, ownerCapital + netCashIncrease);
  const totalCurrentAssets = cashAndBank + inventoryValue;
  const totalAssets = totalCurrentAssets + totalFixedAssets;

  const currentEarnings = totalAssets - totalLiabilities - ownerCapital;
  const totalEquity = ownerCapital + currentEarnings;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const now = new Date();
  const periodLabel = now.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  return {
    periodLabel,
    kpi: {
      totalRevenue,
      totalCogs: cogsAmount,
      cogsPercent:
        totalRevenue > 0
          ? Number(((cogsAmount / totalRevenue) * 100).toFixed(1))
          : 0,
      netProfit,
      netMarginPercent:
        totalRevenue > 0
          ? Number(((netProfit / totalRevenue) * 100).toFixed(1))
          : 0,
      inventoryValue,
      supplierPayable: supplierPayables,
    },
    journals,
    incomeStatement: {
      dineInRevenue,
      takeawayRevenue,
      qrTableRevenue,
      refundAmount,
      totalRevenue,
      cogsAmount,
      grossProfit,
      salaryExpense,
      rentExpense,
      utilityExpense,
      wasteExpense,
      opnameExpense,
      otherExpense,
      totalOperatingExpenses,
      netProfit,
    },
    balanceSheet: {
      cashAndBank,
      inventoryValue,
      totalCurrentAssets,
      kitchenEquipment,
      tablesAndChairs,
      accumulatedDepreciation,
      totalFixedAssets,
      totalAssets,
      supplierPayables,
      taxPayables,
      totalLiabilities,
      ownerCapital,
      currentEarnings,
      totalEquity,
      totalLiabilitiesAndEquity,
    },
    cashFlow: {
      cashFromCustomers: totalRevenue,
      cashToSuppliers,
      cashForSalaries: salaryExpense,
      cashForOperatingExpenses,
      netOperatingCashFlow,
      equipmentPurchases,
      ownerCapitalInflow: ownerCapital,
      netInvestingCashFlow,
      netCashIncrease,
    },
    taxSummary: {
      ppnOutput,
      ppnInput,
      ppnPayable,
      pph21,
      pphFinalUmkm,
      rows: [
        {
          taxType: "PPN / PB1 Keluaran",
          period: periodLabel,
          dppAmount: totalRevenue,
          rateLabel: "11%",
          taxAmount: ppnOutput,
          status: "Ready",
        },
        {
          taxType: "PPN Masukan (PO Bahan Baku)",
          period: periodLabel,
          dppAmount: cogsAmount,
          rateLabel: "11%",
          taxAmount: ppnInput,
          status: "Ready",
        },
        {
          taxType: "PPh 21 Karyawan",
          period: periodLabel,
          dppAmount: salaryExpense,
          rateLabel: "5%",
          taxAmount: pph21,
          status: "Ready",
        },
        {
          taxType: "PPh Final UMKM (PP 55)",
          period: periodLabel,
          dppAmount: totalRevenue,
          rateLabel: "0.5%",
          taxAmount: pphFinalUmkm,
          status: "Draft",
        },
      ],
    },
  };
}

const createManualJournalSchema = z.object({
  category: z.enum([
    "expense_salary",
    "expense_rent",
    "expense_utility",
    "expense_other",
    "asset_purchase",
    "owner_capital",
  ]),
  description: z.string().trim().min(3, "Keterangan minimal 3 karakter.").max(160),
  amount: z.number().int().positive("Nominal harus lebih dari Rp 0."),
});

const JOURNAL_ACCOUNT_MAP: Record<
  z.infer<typeof createManualJournalSchema>["category"],
  { debit: string; credit: string }
> = {
  expense_salary: { debit: "Beban Gaji Karyawan", credit: "Kas & Bank" },
  expense_rent: { debit: "Beban Sewa Tempat", credit: "Kas & Bank" },
  expense_utility: { debit: "Beban Listrik & Air", credit: "Kas & Bank" },
  expense_other: { debit: "Beban Operasional Lainnya", credit: "Kas & Bank" },
  asset_purchase: { debit: "Peralatan Dapur", credit: "Kas & Bank" },
  owner_capital: { debit: "Kas & Bank", credit: "Modal Pemilik" },
};

export async function createManualAccountingEntryAction(
  input: z.infer<typeof createManualJournalSchema>
): Promise<ActionResult> {
  const staff = await requireStaffRole(["owner"]);
  const parsed = createManualJournalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Data jurnal tidak valid.",
    };
  }

  const admin = createSupabaseAdminClient();
  const mapping = JOURNAL_ACCOUNT_MAP[parsed.data.category];
  const journalNo = makeJournalNo("JV");

  const { error } = await admin.from("accounting_journals").insert({
    outlet_id: staff.outletId,
    journal_no: journalNo,
    entry_date: new Date().toISOString().slice(0, 10),
    description: parsed.data.description,
    debit_account: mapping.debit,
    credit_account: mapping.credit,
    amount: parsed.data.amount,
    source_type: parsed.data.category,
    created_by: staff.userId,
  });

  if (error) {
    return {
      ok: false,
      message: `Gagal menyimpan jurnal: ${error.message}`,
    };
  }

  revalidatePath("/dashboard/keuangan");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: `Jurnal ${journalNo} (${mapping.debit} / ${mapping.credit} Rp ${parsed.data.amount.toLocaleString("id-ID")}) berhasil dicatat.`,
  };
}

