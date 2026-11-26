import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getWibPeriodBounds,
  normalizeFinancialPeriod,
  parseWibDateRange,
} from "../datetime.ts";

describe("src/lib/datetime.ts", () => {
  it("menormalisasi parameter periode laporan keuangan secara aman dengan default month", () => {
    assert.equal(normalizeFinancialPeriod(undefined), "month");
    assert.equal(normalizeFinancialPeriod("invalid"), "month");
    assert.equal(normalizeFinancialPeriod("today"), "today");
    assert.equal(normalizeFinancialPeriod("7d"), "7d");
    assert.equal(normalizeFinancialPeriod("30d"), "30d");
    assert.equal(normalizeFinancialPeriod("all"), "all");
  });

  it("menghitung batas rentang WIB (UTC+7) untuk Hari Ini, 7 Hari, Bulan Ini, dan Semua Periode", () => {
    // 2026-11-25 14:00:00 WIB == 2026-11-25T07:00:00.000Z
    const sampleUtc = Date.parse("2026-11-25T07:00:00.000Z");

    const today = getWibPeriodBounds("today", sampleUtc);
    assert.equal(today.startDateWib, "2026-11-25");
    assert.equal(today.endDateWib, "2026-11-25");
    assert.equal(today.startIso, "2026-11-24T17:00:00.000Z");
    assert.equal(today.endIso, "2026-11-25T16:59:59.999Z");

    const week = getWibPeriodBounds("7d", sampleUtc);
    assert.equal(week.startDateWib, "2026-11-19");
    assert.equal(week.endDateWib, "2026-11-25");

    const month = getWibPeriodBounds("month", sampleUtc);
    assert.equal(month.startDateWib, "2026-11-01");
    assert.equal(month.endDateWib, "2026-11-25");

    const all = getWibPeriodBounds("all", sampleUtc);
    assert.equal(all.startIso, null);
    assert.equal(all.endIso, null);
    assert.equal(all.startDateWib, null);
    assert.equal(all.endDateWib, null);
  });

  it("mem-parsing tanggal tunggal maupun rentang tanggal custom WIB secara akurat", () => {
    assert.equal(parseWibDateRange(undefined, undefined), null);
    assert.equal(parseWibDateRange("2026-02-30", null), null);

    // Tanggal tunggal
    const single = parseWibDateRange("2026-11-20", "");
    assert.ok(single);
    assert.equal(single.startDateWib, "2026-11-20");
    assert.equal(single.endDateWib, "2026-11-20");
    assert.equal(single.dayCount, 1);
    assert.equal(single.startIso, "2026-11-19T17:00:00.000Z");
    assert.equal(single.endIso, "2026-11-20T16:59:59.999Z");
    assert.equal(single.prevStartIso, "2026-11-18T17:00:00.000Z");
    assert.equal(single.prevEndIso, "2026-11-19T16:59:59.999Z");

    // Urutan terbalik otomatis dibalik menjadi [start..end]
    const reversed = parseWibDateRange("2026-11-25", "2026-11-21");
    assert.ok(reversed);
    assert.equal(reversed.startDateWib, "2026-11-21");
    assert.equal(reversed.endDateWib, "2026-11-25");
    assert.equal(reversed.dayCount, 5);
  });
});
