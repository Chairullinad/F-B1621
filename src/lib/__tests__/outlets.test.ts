import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assignDistinctOutletColors,
  isSafeActionLinkUrl,
  mapOutletRowToView,
  parseLandingBanners,
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

  it("memberikan warna kontras yang berbeda untuk setiap kios meskipun warna bawaannya sama atau mirip", () => {
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
});
