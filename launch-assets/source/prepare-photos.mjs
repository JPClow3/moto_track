import sharp from "sharp";
import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const names = ["serra-road", "workshop-care", "fuel-stop"];
await mkdir(resolve(root, "launch-assets/photos"), { recursive: true });
await mkdir(resolve(root, "static/images/launch"), { recursive: true });
for (const [i, name] of names.entries()) {
  const source =
    process.argv[i + 2] ?? resolve(root, "launch-assets/photos", name + ".png");
  const target = resolve(root, "launch-assets/photos", name + ".png");
  if (resolve(source) !== target) await copyFile(source, target);
  await sharp(source)
    .resize({ width: 1536, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(resolve(root, "static/images/launch", name + ".webp"));
}
const icon = resolve(root, "static/brand/moto-track-icon.png");
await sharp(icon)
  .resize(384, 384)
  .flatten({ background: "#ffffff" })
  .extend({ top: 64, bottom: 64, left: 64, right: 64, background: "#ffffff" })
  .png()
  .toFile(resolve(root, "static/brand/web/maskable-512.png"));
console.log(
  "Three photo masters, three optimized WebP assets and safe-zone maskable icon ready.",
);
