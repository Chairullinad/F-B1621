import {
  buildQrStandeeFilename,
  getStandeeContrastPalette,
} from "@/lib/outlets";
import { generateQrMatrix } from "@/lib/qrcode";
import { createZipBlob, type ZipEntryInput } from "@/lib/zip";

export interface QrStandeePngOptions {
  outletName: string;
  outletLogoUrl: string;
  outletThemeColor: string;
  tableNo: number;
  qrUrl: string;
}

export interface BatchQrStandeeInput {
  outletName: string;
  outletLogoUrl: string;
  outletThemeColor: string;
  tables: ReadonlyArray<{
    tableNo: number;
    qrUrl: string;
  }>;
}

function loadCanvasImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (src.startsWith("http://") || src.startsWith("https://")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: number | [number, number, number, number]
) {
  const [tl, tr, br, bl] = Array.isArray(radii)
    ? radii
    : [radii, radii, radii, radii];
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
) {
  const scale = Math.min(
    boxW / Math.max(1, img.naturalWidth || img.width),
    boxH / Math.max(1, img.naturalHeight || img.height)
  );
  const drawW = (img.naturalWidth || img.width) * scale;
  const drawH = (img.naturalHeight || img.height) * scale;
  const dx = boxX + (boxW - drawW) / 2;
  const dy = boxY + (boxH - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);
}

function drawWhitePill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  textColor: string,
  font = "900 28px Inter, Arial, sans-serif"
) {
  ctx.save();
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const padX = 14;
  const pillW = Math.ceil(metrics.width) + padX * 2;
  const pillH = 38;

  drawRoundedRectPath(ctx, x, y, pillW, pillH, 9);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, x + padX, y + pillH / 2 + 1);
  ctx.restore();
}

function drawStepBadge(
  ctx: CanvasRenderingContext2D,
  stepNum: string,
  cx: number,
  cy: number,
  textColor: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.font = "900 22px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(stepNum, cx, cy + 1);
  ctx.restore();
}

function drawStepPhoneIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  strokeColor: string
) {
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  drawRoundedRectPath(ctx, x + 2, y + 4, 34, 50, 5);
  ctx.stroke();

  drawRoundedRectPath(ctx, x + 24, y + 16, 38, 56, 6);
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fill();
  ctx.stroke();

  ctx.strokeRect(x + 33, y + 27, 8, 8);
  ctx.strokeRect(x + 45, y + 27, 8, 8);
  ctx.strokeRect(x + 33, y + 39, 8, 8);
  ctx.strokeRect(x + 45, y + 39, 8, 8);
  ctx.beginPath();
  ctx.moveTo(x + 37, y + 60);
  ctx.lineTo(x + 49, y + 60);
  ctx.stroke();
  ctx.restore();
}

function drawStepCashierIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  strokeColor: string
) {
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  drawRoundedRectPath(ctx, x + 18, y + 6, 30, 16, 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 33, y + 22);
  ctx.lineTo(x + 33, y + 30);
  ctx.stroke();

  ctx.strokeRect(x + 10, y + 30, 48, 18);
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 48);
  ctx.lineTo(x + 64, y + 48);
  ctx.lineTo(x + 60, y + 70);
  ctx.lineTo(x + 8, y + 70);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + 22, y + 59);
  ctx.lineTo(x + 46, y + 59);
  ctx.stroke();
  ctx.restore();
}

function drawStepFoodIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  strokeColor: string
) {
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(x + 16, y + 24);
  ctx.quadraticCurveTo(x + 22, y + 14, x + 16, y + 6);
  ctx.moveTo(x + 30, y + 24);
  ctx.quadraticCurveTo(x + 36, y + 14, x + 30, y + 6);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + 4, y + 42);
  ctx.lineTo(x + 44, y + 42);
  ctx.quadraticCurveTo(x + 44, y + 68, x + 24, y + 68);
  ctx.quadraticCurveTo(x + 4, y + 68, x + 4, y + 42);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + 48, y + 28);
  ctx.lineTo(x + 68, y + 28);
  ctx.lineTo(x + 64, y + 68);
  ctx.lineTo(x + 52, y + 68);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawStandeeOnCanvas(
  canvas: HTMLCanvasElement,
  options: QrStandeePngOptions,
  assets: {
    outletLogoImg: HTMLImageElement | null;
    groupLogoImg: HTMLImageElement | null;
  }
): Promise<Blob> {
  const size = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Browser tidak mendukung pembuatan gambar kanvas.");
  }

  const palette = getStandeeContrastPalette(options.outletThemeColor);
  const formattedTableNo = String(options.tableNo).padStart(2, "0");

  // 1. Background Card Persegi Sudut Membulat
  ctx.clearRect(0, 0, size, size);
  drawRoundedRectPath(ctx, 0, 0, size, size, 36);
  ctx.fillStyle = palette.backgroundHex;
  ctx.fill();

  // 2. Tab Logo Putih Atas
  const tabW = 540;
  const tabH = 148;
  const tabX = (size - tabW) / 2;
  drawRoundedRectPath(ctx, tabX, 0, tabW, tabH, [0, 0, 32, 32]);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  if (assets.outletLogoImg) {
    drawContainedImage(ctx, assets.outletLogoImg, tabX + 34, 20, 195, 108);
  } else {
    ctx.fillStyle = "#0F172A";
    ctx.font = "900 24px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(options.outletName.slice(0, 14), tabX + 132, 74);
  }

  ctx.fillStyle = "#CBD5E1";
  ctx.fillRect(size / 2 - 2, 28, 4, 92);

  if (assets.groupLogoImg) {
    drawContainedImage(ctx, assets.groupLogoImg, size / 2 + 28, 28, 210, 92);
  } else {
    ctx.fillStyle = "#1E88E5";
    ctx.font = "900 26px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("1621 Group", size / 2 + 132, 74);
  }

  // 3. Headline: mau order? SCAN AJA
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = palette.foregroundColor;
  ctx.font = "800 54px Inter, Arial, sans-serif";
  ctx.fillText("mau order?", size / 2, 224);

  ctx.font = "900 118px Inter, Arial, sans-serif";
  ctx.lineJoin = "round";
  ctx.lineWidth = 18;
  ctx.strokeStyle = palette.outlineHex;
  ctx.strokeText("SCAN AJA", size / 2, 336);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("SCAN AJA", size / 2, 336);

  // 4. Kolom Kiri: Kotak Putih QR Code
  const qrBoxX = 56;
  const qrBoxY = 380;
  const qrBoxSize = 468;
  drawRoundedRectPath(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 32);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = palette.outlineHex;
  ctx.stroke();

  const qrMatrix = generateQrMatrix(options.qrUrl);
  const qrModules = qrMatrix.length;
  const qrInnerPad = 32;
  const qrDrawArea = qrBoxSize - qrInnerPad * 2;
  const cellSize = qrDrawArea / qrModules;

  ctx.fillStyle = "#09090B";
  for (let r = 0; r < qrModules; r++) {
    const row = qrMatrix[r];
    if (!row) continue;
    for (let c = 0; c < qrModules; c++) {
      if (row[c]) {
        const px = Math.floor(qrBoxX + qrInnerPad + c * cellSize);
        const py = Math.floor(qrBoxY + qrInnerPad + r * cellSize);
        const pw = Math.ceil(qrBoxX + qrInnerPad + (c + 1) * cellSize) - px;
        const ph = Math.ceil(qrBoxY + qrInnerPad + (r + 1) * cellSize) - py;
        ctx.fillRect(px, py, pw, ph);
      }
    }
  }

  // 5. Kolom Kanan: Panduan 3 Langkah
  const stepX = 576;
  drawStepBadge(ctx, "1", stepX, 456, palette.pillTextColor);
  drawStepPhoneIcon(ctx, stepX + 36, 418, palette.foregroundColor);
  drawWhitePill(ctx, "SCAN", stepX + 124, 412, palette.pillTextColor);
  ctx.fillStyle = palette.foregroundColor;
  ctx.font = "900 28px Inter, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("& ORDER", stepX + 124, 458);

  drawStepBadge(ctx, "2", stepX, 614, palette.pillTextColor);
  drawStepCashierIcon(ctx, stepX + 34, 578, palette.foregroundColor);
  drawWhitePill(ctx, "BAYAR", stepX + 124, 594, palette.pillTextColor);

  drawStepBadge(ctx, "3", stepX, 772, palette.pillTextColor);
  drawStepFoodIcon(ctx, stepX + 34, 734, palette.foregroundColor);
  ctx.fillStyle = palette.foregroundColor;
  ctx.font = "900 28px Inter, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("PESANAN", stepX + 124, 730);
  drawWhitePill(ctx, "DIANTAR", stepX + 124, 766, palette.pillTextColor);

  // 6. Footer Bawah
  drawRoundedRectPath(ctx, 56, 916, 178, 86, 20);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.fillStyle = "#0F172A";
  ctx.font = "900 26px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("QR ORDER", 56 + 89, 916 + 44);

  ctx.fillStyle = palette.foregroundColor;
  ctx.font = "700 24px Inter, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Apabila sudah order", 254, 914);
  ctx.fillText("MOHON UNTUK TIDAK", 254, 944);
  ctx.fillText("PINDAH MEJA", 254, 974);

  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.font = "800 30px Inter, Arial, sans-serif";
  ctx.fillText("MEJA NO", 1024, 912);

  ctx.font = "900 132px Inter, Arial, sans-serif";
  ctx.lineJoin = "round";
  ctx.lineWidth = 18;
  ctx.strokeStyle = palette.outlineHex;
  ctx.strokeText(formattedTableNo, 1024, 1028);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(formattedTableNo, 1024, 1028);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Gagal mengonversi standee QR ke file PNG."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

/**
 * Merender Standee QR Meja ke Blob PNG beresolusi tinggi (1080 x 1080 px).
 */
export async function renderQrStandeePngBlob(
  options: QrStandeePngOptions
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;

  const [outletLogoImg, groupLogoImg] = await Promise.all([
    loadCanvasImage(options.outletLogoUrl || "/logo-1621group-stacked.png"),
    loadCanvasImage("/logo-1621group.png"),
  ]);

  return drawStandeeOnCanvas(canvas, options, {
    outletLogoImg,
    groupLogoImg,
  });
}

/**
 * Merender lalu memicu unduhan file PNG standee QR Meja langsung di browser.
 */
export async function downloadQrStandeePng(
  options: QrStandeePngOptions
): Promise<string> {
  const blob = await renderQrStandeePngBlob(options);
  const filename = buildQrStandeeFilename(options.outletName, options.tableNo);
  triggerBlobDownload(blob, filename);
  return filename;
}

/**
 * Merender seluruh standee QR Meja lalu membundelnya menjadi 1 file `.zip`
 * (berisi 1 file PNG terpisah per nomor meja, tanpa terblokir popup multiple download Chrome).
 */
export async function downloadAllQrStandeeZip(
  input: BatchQrStandeeInput,
  onProgress?: (current: number, total: number) => void
): Promise<string> {
  if (input.tables.length === 0) {
    throw new Error("Tidak ada meja aktif untuk diunduh.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;

  const [outletLogoImg, groupLogoImg] = await Promise.all([
    loadCanvasImage(input.outletLogoUrl || "/logo-1621group-stacked.png"),
    loadCanvasImage("/logo-1621group.png"),
  ]);

  const entries: ZipEntryInput[] = [];
  for (let i = 0; i < input.tables.length; i++) {
    const tbl = input.tables[i];
    if (!tbl) continue;

    const pngBlob = await drawStandeeOnCanvas(
      canvas,
      {
        outletName: input.outletName,
        outletLogoUrl: input.outletLogoUrl,
        outletThemeColor: input.outletThemeColor,
        tableNo: tbl.tableNo,
        qrUrl: tbl.qrUrl,
      },
      { outletLogoImg, groupLogoImg }
    );
    const bytes = new Uint8Array(await pngBlob.arrayBuffer());
    entries.push({
      name: buildQrStandeeFilename(input.outletName, tbl.tableNo),
      data: bytes,
    });

    onProgress?.(i + 1, input.tables.length);
    // Beri jeda micro agar UI tetap responsif saat merender hingga 100 meja
    if ((i + 1) % 3 === 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  }

  const zipBlob = createZipBlob(entries);
  const slug = input.outletName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const zipFilename = `semua-qr-meja-${slug || "kios"}.zip`;
  triggerBlobDownload(zipBlob, zipFilename);
  return zipFilename;
}

/**
 * Mengunduh seluruh file PNG standee satu per satu secara berurutan dengan jeda aman.
 */
export async function downloadAllQrStandeeSeparately(
  input: BatchQrStandeeInput,
  onProgress?: (current: number, total: number) => void
): Promise<number> {
  if (input.tables.length === 0) {
    throw new Error("Tidak ada meja aktif untuk diunduh.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;

  const [outletLogoImg, groupLogoImg] = await Promise.all([
    loadCanvasImage(input.outletLogoUrl || "/logo-1621group-stacked.png"),
    loadCanvasImage("/logo-1621group.png"),
  ]);

  let count = 0;
  for (let i = 0; i < input.tables.length; i++) {
    const tbl = input.tables[i];
    if (!tbl) continue;

    const pngBlob = await drawStandeeOnCanvas(
      canvas,
      {
        outletName: input.outletName,
        outletLogoUrl: input.outletLogoUrl,
        outletThemeColor: input.outletThemeColor,
        tableNo: tbl.tableNo,
        qrUrl: tbl.qrUrl,
      },
      { outletLogoImg, groupLogoImg }
    );
    triggerBlobDownload(
      pngBlob,
      buildQrStandeeFilename(input.outletName, tbl.tableNo)
    );
    count += 1;
    onProgress?.(i + 1, input.tables.length);
    await new Promise((resolve) => window.setTimeout(resolve, 180));
  }

  return count;
}
