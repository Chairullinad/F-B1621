const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function process() {
  const inputPath = 'C:/Users/Admin/.gemini/antigravity/brain/9fbb08e6-ede3-447b-bbf5-33d80929b473/.user_uploaded/media_1794101335897_a3dd57a0.jpg';
  const outputPath = path.join(__dirname, '../public/logo-1621group-stacked.png');
  const fallbackPath = path.join(__dirname, '../public/logo-1621.png');

  const { data, info } = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    const brightness = (r + g + b) / 3;

    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;

    if (brightness < 30) {
      rgba[i * 4 + 3] = 0;
    } else if (brightness < 70) {
      const alpha = Math.round(((brightness - 30) / 40) * 255);
      rgba[i * 4 + 3] = alpha;
    } else {
      rgba[i * 4 + 3] = 255;
    }
  }

  // Extend with 12px transparent border and save
  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .extend({
      top: 12,
      bottom: 12,
      left: 12,
      right: 12,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  // Also copy to fallback path logo-1621.png
  fs.copyFileSync(outputPath, fallbackPath);

  const meta = await sharp(outputPath).metadata();
  console.log('Successfully saved transparent stacked logo:', outputPath);
  console.log('Dimensions:', meta.width, 'x', meta.height);
}

process().catch(console.error);

