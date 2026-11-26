import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assignDistinctOutletColors,
  buildQrStandeeFilename,
  DEFAULT_OUTLET_TABLE_COUNT,
  getStandeeContrastPalette,
  isSafeActionLinkUrl,
  mapOutletRowToSidebarView,
  mapOutletRowToView,
  parseLandingBanners,
  planOutletTableCountSync,
} from "../outlets.ts";

describe("src/lib/outlets.ts", () => {
  it("memetakan kolom asli tabel outlets dan fallback JSON legacy di receipt_footer", () => {
    const direct = mapOutletRowToView({
      id: "outlet-1",
      name: "KOPI 1621",
      address: "Jl. Sudirman 10",
      phone: "08123456789",
      description: "Coffee Roastery",
      receipt_footer: "Sampai jumpa kembali!",
      logo_url: "data:image/png;base64,AAA",
      theme_color: "#E11D48",
      is_active: true,
      order_expiry_minutes: 15,
      tax_enabled: true,
      tax_percent: 10,
      service_enabled: false,
      service_percent: null,
      created_at: "2026-01-01T00:00:00Z",
      deleted_at: null,
      landing_banners: [
        { id: "b1", imageUrl: "/promo-1.png", caption: "Combo 25K" },
      ],
      landing_news_title: "INFO KEDAI",
      landing_news_banner_url: "/news-1.png",
      operating_hours: "08.00 - 23.00 WIB",
      landing_tagline: "Ngopi santai setiap hari",
      partnership_url: "https://wa.me/628123456789",
      reservation_url: "https://forms.gle/reservasi",
      feedback_url: "mailto:halo@kopi1621.id",
    });

    assert.equal(direct.name, "KOPI 1621");
    assert.equal(direct.phone, "08123456789");
    assert.equal(direct.description, "Coffee Roastery");
    assert.equal(direct.receiptFooter, "Sampai jumpa kembali!");
    assert.equal(direct.logoUrl, "data:image/png;base64,AAA");
    assert.equal(direct.themeColor, "#E11D48");
    assert.equal(direct.isActive, true);
    assert.equal(direct.landingBanners.length, 1);
    assert.equal(direct.landingBanners[0]?.caption, "Combo 25K");
    assert.equal(direct.landingNewsTitle, "INFO KEDAI");
    assert.equal(direct.landingNewsBannerUrl, "/news-1.png");
    assert.equal(direct.operatingHours, "08.00 - 23.00 WIB");
    assert.equal(direct.landingTagline, "Ngopi santai setiap hari");
    assert.equal(direct.partnershipUrl, "https://wa.me/628123456789");
    assert.equal(direct.reservationUrl, "https://forms.gle/reservasi");
    assert.equal(direct.feedbackUrl, "mailto:halo@kopi1621.id");

    const legacy = mapOutletRowToView({
      id: "outlet-2",
      name: "SAIKO RAMEN",
      cover_banner_url: "/legacy-cover.jpg",
      receipt_footer: JSON.stringify({
        description: "Ramen Bar",
        themeColor: "#059669",
        logoUrl: "/saiko.png",
        phone: "08999",
        receiptFooter: "Arigato!",
      }),
      is_active: true,
      created_at: "2026-01-02T00:00:00Z",
      deleted_at: null,
    });

    assert.equal(legacy.description, "Ramen Bar");
    assert.equal(legacy.themeColor, "#059669");
    assert.equal(legacy.logoUrl, "/saiko.png");
    assert.equal(legacy.phone, "08999");
    assert.equal(legacy.receiptFooter, "Arigato!");
    assert.equal(legacy.landingBanners.length, 1);
    assert.equal(legacy.landingBanners[0]?.imageUrl, "/legacy-cover.jpg");
  });

  it("memberikan warna kontras yang berbeda untuk setiap outlet meskipun warna bawaannya sama atau mirip", () => {
    const colorMap = assignDistinctOutletColors([
      { id: "a", themeColor: "#0284C7" },
      { id: "b", themeColor: "#0284C7" },
      { id: "c", themeColor: "#1E88E5" }, // biru mirip dengan #0284C7
      { id: "d", themeColor: "#7C3AED" },
    ]);

    const colors = [
      colorMap.get("a"),
      colorMap.get("b"),
      colorMap.get("c"),
      colorMap.get("d"),
    ];
    assert.equal(colorMap.get("a"), "#0284C7");
    assert.notEqual(colorMap.get("c"), "#1E88E5");
    assert.equal(colorMap.get("d"), "#7C3AED");
    assert.equal(new Set(colors).size, 4);
  });

  it("memvalidasi protokol aman untuk tautan tombol landing page", () => {
    assert.equal(isSafeActionLinkUrl("https://wa.me/628123"), true);
    assert.equal(isSafeActionLinkUrl("http://example.com/form"), true);
    assert.equal(isSafeActionLinkUrl("mailto:cs@1621.id"), true);
    assert.equal(isSafeActionLinkUrl("tel:+628123"), true);
    assert.equal(isSafeActionLinkUrl("javascript:alert(1)"), false);
    assert.equal(isSafeActionLinkUrl("data:text/html,hi"), false);
    assert.equal(isSafeActionLinkUrl(""), false);

    assert.equal(parseLandingBanners(null, null).length, 0);
  });

  it("menghitung warna background, outline, dan kontras teks dinamis untuk standee QR Meja", () => {
    const redStandee = getStandeeContrastPalette("#e11d48");
    assert.equal(redStandee.backgroundHex, "#E11D48");
    assert.equal(redStandee.isLightBackground, false);
    assert.equal(redStandee.foregroundColor, "#FFFFFF");
    assert.equal(redStandee.pillTextColor, "#E11D48");

    const lightYellow = getStandeeContrastPalette("#FEF08A");
    assert.equal(lightYellow.isLightBackground, true);
    assert.equal(lightYellow.foregroundColor, "#0F172A");
    assert.equal(lightYellow.pillTextColor, "#0F172A");

    const invalid = getStandeeContrastPalette("not-a-color");
    assert.equal(invalid.backgroundHex, "#0284C7");

    assert.equal(
      buildQrStandeeFilename("SAIKO RAMEN", 9),
      "qr-meja-09-saiko-ramen.png"
    );
    assert.equal(
      buildQrStandeeFilename("LATTESPACE @ 1621!", 1),
      "qr-meja-01-lattespace-1621.png"
    );

    const sidebarOutlet = mapOutletRowToSidebarView({
      id: "out-side",
      name: "KOPI 1621",
      description: "Roastery",
      logo_url: "/logo.png",
      theme_color: "#1E88E5",
    });
    assert.deepEqual(sidebarOutlet, {
      id: "out-side",
      name: "KOPI 1621",
      description: "Roastery",
      logoUrl: "/logo.png",
      themeColor: "#1E88E5",
    });
  });

  it("menyusun rencana sinkronisasi jumlah meja (default 50, tambah baru, pulihkan soft-delete, dan kurangi)", () => {
    assert.equal(DEFAULT_OUTLET_TABLE_COUNT, 50);

    // 1. Outlet baru (0 meja -> 50 meja)
    const freshPlan = planOutletTableCountSync([], DEFAULT_OUTLET_TABLE_COUNT);
    assert.equal(freshPlan.toInsertNos.length, 50);
    assert.equal(freshPlan.toInsertNos[0], 1);
    assert.equal(freshPlan.toInsertNos[49], 50);
    assert.equal(freshPlan.toRestoreIds.length, 0);
    assert.equal(freshPlan.toSoftDeleteIds.length, 0);

    // 2. Kurangi dari 5 meja ke 3 meja -> meja 4 & 5 di-soft-delete
    const shrinkPlan = planOutletTableCountSync(
      [
        { id: "t1", tableNo: 1, isActive: true, deletedAt: null },
        { id: "t2", tableNo: 2, isActive: true, deletedAt: null },
        { id: "t3", tableNo: 3, isActive: true, deletedAt: null },
        { id: "t4", tableNo: 4, isActive: true, deletedAt: null },
        { id: "t5", tableNo: 5, isActive: true, deletedAt: null },
      ],
      3
    );
    assert.deepEqual(shrinkPlan.toSoftDeleteIds, ["t4", "t5"]);
    assert.deepEqual(shrinkPlan.toSoftDeleteNos, [4, 5]);
    assert.equal(shrinkPlan.toInsertNos.length, 0);

    // 3. Tambah kembali dari 3 ke 6 meja (meja 4 & 5 dipulihkan, meja 6 dibuat baru)
    const expandPlan = planOutletTableCountSync(
      [
        { id: "t1", tableNo: 1, isActive: true, deletedAt: null },
        { id: "t2", tableNo: 2, isActive: true, deletedAt: null },
        { id: "t3", tableNo: 3, isActive: true, deletedAt: null },
        { id: "t4", tableNo: 4, isActive: false, deletedAt: "2026-11-25T10:00:00Z" },
        { id: "t5", tableNo: 5, isActive: false, deletedAt: "2026-11-25T10:00:00Z" },
      ],
      6
    );
    assert.deepEqual(expandPlan.toRestoreIds, ["t4", "t5"]);
    assert.deepEqual(expandPlan.toInsertNos, [6]);
    assert.deepEqual(expandPlan.toSoftDeleteIds, []);
  });
});
