import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const assets = [
  ["node_modules/htmx.org/dist/htmx.min.js", "static/vendor/htmx/htmx.min.js"],
  ["node_modules/alpinejs/dist/cdn.min.js", "static/vendor/alpine/alpine.min.js"],
  ["node_modules/lucide/dist/umd/lucide.min.js", "static/vendor/lucide/lucide.min.js"],
  ["node_modules/chart.js/dist/chart.umd.js", "static/vendor/chart/chart.umd.js"],
];

for (const [source, target] of assets) {
  const from = join(root, source);
  const to = join(root, target);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}
