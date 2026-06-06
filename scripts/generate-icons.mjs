/**
 * Cedar Boost — PWA Icon Generator
 * ─────────────────────────────────
 * Generates all required PNG icon sizes from the master SVG.
 *
 * Usage:
 *   npm install sharp   (one-time)
 *   node scripts/generate-icons.mjs
 *
 * Output: public/icons/icon-{size}.png
 *         public/icons/apple-touch-icon.png  (180×180)
 *         public/og-image.png                (1200×630 social preview)
 */

import sharp from 'sharp';
import fs    from 'fs';
import path  from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const PNG_SRC   = path.join(ROOT, 'public', 'cedar1.png');
const OUT_DIR   = path.join(ROOT, 'public', 'icons');

// ── All required PWA + browser icon sizes ────────────────────────────────────
const ICON_SIZES = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 384, 512];

// ── OG / social preview ───────────────────────────────────────────────────────
const OG_WIDTH  = 1200;
const OG_HEIGHT = 630;

async function main() {
  // Ensure output directory
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const pngBuffer = fs.readFileSync(PNG_SRC);

  console.log('🎨 Generating PNG icons from cedar1.png...\n');

  // ── Icon sizes ──────────────────────────────────────────────────────────────
  for (const size of ICON_SIZES) {
    const outPath = path.join(OUT_DIR, `icon-${size}.png`);
    await sharp(pngBuffer)
      .resize(size, size)
      .png({ compressionLevel: 9, quality: 100 })
      .toFile(outPath);
    console.log(`  ✅ icon-${size}.png`);
  }

  // Apple touch icon alias
  fs.copyFileSync(
    path.join(OUT_DIR, 'icon-180.png'),
    path.join(OUT_DIR, 'apple-touch-icon.png'),
  );
  console.log('  ✅ apple-touch-icon.png  (copy of 180)');

  // ── Favicon.ico (16+32+48 combined) ─────────────────────────────────────────
  // Note: sharp doesn't write .ico natively.
  // Copy icon-32.png as favicon fallback if needed.
  fs.copyFileSync(
    path.join(OUT_DIR, 'icon-32.png'),
    path.join(ROOT, 'public', 'favicon-32.png'),
  );
  console.log('  ✅ favicon-32.png');

  // ── OG social preview (1200×630) ─────────────────────────────────────────────
  // Red background + centered logo
  const logoSize  = 260;
  const logoLeft  = Math.round((OG_WIDTH  - logoSize) / 2);
  const logoTop   = Math.round((OG_HEIGHT - logoSize) / 2) - 30;

  const logoBuffer = await sharp(pngBuffer)
    .resize(logoSize, logoSize)
    .png()
    .toBuffer();

  // Build OG SVG overlay (text)
  const ogSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}">
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#0a0a0a"/>
      <!-- Red glow -->
      <ellipse cx="600" cy="280" rx="320" ry="200" fill="#D61414" opacity="0.08"/>
      <!-- Wordmark -->
      <text
        x="600" y="${logoTop + logoSize + 60}"
        font-family="'Space Grotesk', Arial, sans-serif"
        font-weight="900"
        font-size="72"
        fill="#ffffff"
        text-anchor="middle"
        letter-spacing="12"
      >CEDAR BOOST</text>
      <text
        x="600" y="${logoTop + logoSize + 110}"
        font-family="'Inter', Arial, sans-serif"
        font-weight="500"
        font-size="28"
        fill="#888888"
        text-anchor="middle"
        letter-spacing="6"
      >PREMIUM DIGITAL HUB</text>
    </svg>`;

  await sharp({
    create: {
      width:      OG_WIDTH,
      height:     OG_HEIGHT,
      channels:   4,
      background: { r: 10, g: 10, b: 10, alpha: 1 },
    }
  })
  .composite([
    { input: Buffer.from(ogSvg), top: 0, left: 0 },
    { input: logoBuffer, top: logoTop, left: logoLeft },
  ])
  .png({ compressionLevel: 9 })
  .toFile(path.join(ROOT, 'public', 'og-image.png'));

  console.log('  ✅ og-image.png  (1200×630 social preview)');

  console.log('\n✨ All icons generated successfully!');
  console.log(`   Location: public/icons/`);
  console.log('\n📋 Next: update index.html apple-touch-icon to /icons/apple-touch-icon.png');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
