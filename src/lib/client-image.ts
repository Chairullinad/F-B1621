/**
 * Mengompres file gambar di browser menjadi Data URL untuk kebutuhan logo/banner.
 */
export async function compressImageFileToDataUrl(
  file: File,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    maxDataUrlLength?: number;
    preserveTransparency?: boolean;
  }
): Promise<string> {
  const maxWidth = options?.maxWidth ?? 256;
  const maxHeight = options?.maxHeight ?? 256;
  const maxDataUrlLength = options?.maxDataUrlLength ?? 360_000;
  const preserveTransparency = options?.preserveTransparency ?? true;

  if (file.type === "image/svg+xml") {
    const svgData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Gagal membaca file SVG."));
      reader.readAsDataURL(file);
    });
    if (svgData.length > maxDataUrlLength) {
      throw new Error("Ukuran file SVG terlalu besar.");
    }
    return svgData;
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Format gambar tidak dapat dimuat."));
    image.src = rawDataUrl;
  });

  const scale = Math.min(
    1,
    maxWidth / Math.max(img.width, 1),
    maxHeight / Math.max(img.height, 1)
  );
  const targetW = Math.max(1, Math.round(img.width * scale));
  const targetH = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Browser tidak mendukung kanvas pemrosesan gambar.");
  }

  ctx.clearRect(0, 0, targetW, targetH);
  ctx.drawImage(img, 0, 0, targetW, targetH);

  if (preserveTransparency && (file.type === "image/png" || file.type === "image/webp")) {
    const pngUrl = canvas.toDataURL("image/png");
    if (pngUrl.length <= maxDataUrlLength) {
      return pngUrl;
    }
  }

  for (const quality of [0.88, 0.78, 0.68]) {
    const webpUrl = canvas.toDataURL("image/webp", quality);
    if (webpUrl.length <= maxDataUrlLength) {
      return webpUrl;
    }
  }

  for (const quality of [0.85, 0.72]) {
    const jpegUrl = canvas.toDataURL("image/jpeg", quality);
    if (jpegUrl.length <= maxDataUrlLength) {
      return jpegUrl;
    }
  }

  throw new Error(
    "Ukuran gambar masih terlalu besar setelah dikompresi. Gunakan gambar dengan resolusi lebih kecil."
  );
}
