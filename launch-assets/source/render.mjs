import { chromium } from "@playwright/test";
import sharp from "sharp";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const out = resolve(root, "launch-assets");
const base = process.env.LAUNCH_BASE_URL ?? "http://localhost:5194";
const data = async (path, type) =>
  "data:" +
  type +
  ";base64," +
  (await readFile(resolve(root, path))).toString("base64");
const font = await data(
  "node_modules/@fontsource/barlow/files/barlow-latin-400-normal.woff2",
  "font/woff2",
);
const bold = await data(
  "node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2",
  "font/woff2",
);
const logo = await data(
  "static/brand/svg/moto-track-logo-horizontal-dark.svg",
  "image/svg+xml",
);
const photos = await Promise.all(
  ["serra-road", "fuel-stop", "workshop-care"].map((name) =>
    data("static/images/launch/" + name + ".webp", "image/webp"),
  ),
);
const fonts =
  "@font-face{font-family:Barlow;src:url(" +
  font +
  ")}@font-face{font-family:Condensed;src:url(" +
  bold +
  ");font-weight:700}";
const common =
  fonts +
  "*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#101012;color:#fafafa;font-family:Barlow,sans-serif}h1,h2,p{margin:0}h1,h2{font-family:Condensed,sans-serif;font-weight:700;letter-spacing:-.02em}";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const context = await browser.newContext({
  locale: "pt-BR",
  reducedMotion: "reduce",
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const inventory = [];
async function save(path, width, height, body, css = "") {
  await page.setViewportSize({ width, height });
  await page.setContent(
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>' +
      common +
      css +
      "</style></head><body>" +
      body +
      "</body></html>",
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode()));
  });
  await page.screenshot({ path: resolve(out, path), omitBackground: false });
  const meta = await sharp(resolve(out, path)).metadata();
  if (meta.width !== width * 2 || meta.height !== height * 2 || meta.hasAlpha)
    throw new Error("Invalid opaque raster: " + path);
  inventory.push({
    file: path,
    width: meta.width,
    height: meta.height,
    kind: "promotional-artwork",
  });
}

for (const directory of [
  "apple",
  "google",
  "microsoft",
  "social",
  "captures",
  "motion",
])
  await mkdir(resolve(out, directory), { recursive: true });
const views = [
  {
    id: "overview",
    headline: "Toda a vida<br>da sua moto.",
    sub: "Custos, cuidados e histórico<br>em um só painel.",
    photo: photos[0],
    number: "01",
  },
  {
    id: "fuel",
    headline: "Cada km,<br>mais claro.",
    sub: "Registre abastecimentos.<br>Entenda o consumo.",
    photo: photos[1],
    number: "02",
  },
  {
    id: "maintenance",
    headline: "Cada cuidado<br>fica na história.",
    sub: "Peças, serviços e despesas<br>sempre à mão.",
    photo: photos[2],
    number: "03",
  },
  {
    id: "reminders",
    headline: "Sua próxima<br>revisão, à vista.",
    sub: "Organize os cuidados por<br>data ou quilometragem.",
    photo: photos[0],
    number: "04",
  },
];
for (const view of views) {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(base + "/demo?view=" + view.id);
  await page.locator('html[data-app-ready="true"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page
    .getByRole("tab", {
      name: {
        overview: "Visão geral",
        fuel: "Combustível",
        maintenance: "Manutenção",
        reminders: "Lembretes",
      }[view.id],
      exact: true,
    })
    .click();
  await page
    .locator("#product-preview img")
    .first()
    .evaluate((image) => image.decode());
  await page
    .locator("#product-preview")
    .screenshot({ path: resolve(out, "captures/" + view.id + ".png") });
  view.capture = await data(
    "launch-assets/captures/" + view.id + ".png",
    "image/png",
  );
  const body =
    '<img class="photo" src="' +
    view.photo +
    '"><div class="shade"></div><div class="copy"><img class="logo" src="' +
    logo +
    '"><p class="eyebrow">CADA QUILÔMETRO CONTA / ' +
    view.number +
    "</p><h1>" +
    view.headline +
    '</h1><p class="sub">' +
    view.sub +
    '</p></div><div class="window"><div class="window-bar"><i></i><i></i><i></i><span>MOTO TRACK</span></div><img src="' +
    view.capture +
    '"></div><p class="foot">Demonstração com dados ilustrativos</p>';
  const css =
    ".photo{position:absolute;inset:0;width:100%;height:55%;object-fit:cover;opacity:.43}.shade{position:absolute;inset:0;background:linear-gradient(0deg,#101012 38%,transparent 100%)}.copy{position:relative;z-index:1;padding:48px 54px}.logo{width:165px;height:auto}.eyebrow{margin-top:40px;color:#f87171;font-size:13px;letter-spacing:2px}h1{font-size:86px;line-height:.94;margin-top:20px}.sub{color:#d4d4d8;font-size:23px;line-height:1.35;margin-top:22px}.window{position:absolute;z-index:2;top:505px;left:115px;width:430px;border:6px solid #3f3f46;border-radius:20px;overflow:hidden;box-shadow:0 30px 70px #0008;background:#fafafa}.window>img{display:block;width:100%}.window-bar{height:24px;background:#27272a;display:flex;align-items:center;gap:4px;padding:0 10px}.window-bar i{width:5px;height:5px;background:#71717a;border-radius:50%}.window-bar span{font-size:8px;letter-spacing:2px;margin-left:auto;color:#a1a1aa}.foot{position:absolute;bottom:0;z-index:3;width:100%;padding:28px 20px 26px;text-align:center;font-size:13px;color:#a1a1aa;background:linear-gradient(transparent,#101012 25%)}";
  await save(
    "apple/" + view.number + "-" + view.id + "-1320x2868.png",
    660,
    1434,
    body,
    css,
  );
  await save(
    "google/" + view.number + "-" + view.id + "-1080x1920.png",
    540,
    960,
    body,
    css +
      ".copy{padding:32px 40px}.logo{width:140px}.eyebrow{margin-top:26px;font-size:11px}h1{font-size:66px;margin-top:16px}.sub{font-size:20px;margin-top:17px}.window{top:365px;left:100px;width:340px}.foot{font-size:11px;padding:20px}.photo{height:60%}",
  );
}
const heroBody =
  '<img class="bg" src="' +
  photos[0] +
  '"><div class="shade"></div><div class="words"><img src="' +
  logo +
  '"><p class="eyebrow">CADA QUILÔMETRO CONTA</p><h1>Menos achismo.<br>Mais estrada.</h1><p class="sub">Sua moto, seus custos e seus cuidados.<br>Tudo em um só painel.</p></div>';
const heroCss =
  ".bg{position:absolute;width:100%;height:100%;object-fit:cover;object-position:center}.shade{position:absolute;inset:0;background:linear-gradient(90deg,#101012 0%,#101012ec 22%,#10101218 90%)}.words{position:relative;padding:55px 60px;width:65%}.words>img{width:160px}.eyebrow{font-size:12px;letter-spacing:2px;color:#f87171;margin-top:40px}h1{font-size:76px;line-height:.97;margin-top:18px}.sub{font-size:19px;color:#d4d4d8;margin-top:22px;line-height:1.4}";
await save("microsoft/hero-1920x1080.png", 960, 540, heroBody, heroCss);
await save(
  "google/feature-1024x500.png",
  512,
  250,
  heroBody,
  heroCss +
    ".words{padding:22px 28px;width:66%}.words>img{width:95px}.eyebrow{font-size:7px;margin-top:18px;letter-spacing:1px}h1{font-size:42px;margin-top:10px}.sub{font-size:11px;margin-top:10px}",
);
await save(
  "social/launch-1080x1080.png",
  540,
  540,
  heroBody,
  heroCss +
    ".words{padding:38px;width:100%}.words>img{width:140px}.eyebrow{font-size:11px;margin-top:170px}h1{font-size:64px}.sub{font-size:16px}.shade{background:linear-gradient(0deg,#101012 0%,#101012cc 40%,#10101222 100%)}",
);
await sharp(resolve(root, "static/brand/moto-track-icon.png"))
  .flatten({ background: "#ffffff" })
  .resize(1024, 1024)
  .png()
  .toFile(resolve(out, "apple/app-icon-1024.png"));
await sharp(resolve(root, "static/brand/moto-track-icon.png"))
  .flatten({ background: "#ffffff" })
  .resize(512, 512)
  .png()
  .toFile(resolve(out, "google/app-icon-512.png"));
await sharp(resolve(root, "static/brand/moto-track-icon.png"))
  .flatten({ background: "#ffffff" })
  .resize(300, 300)
  .png()
  .toFile(resolve(out, "microsoft/app-tile-300.png"));

await page.setViewportSize({ width: 960, height: 540 });
await page.goto(base + "/demo");
await page.locator('html[data-app-ready="true"]').waitFor();
await page.evaluate(() => document.fonts.ready);
await page.screenshot({
  path: resolve(out, "microsoft/demo-desktop-1920x1080.png"),
});
inventory.push({
  file: "microsoft/demo-desktop-1920x1080.png",
  width: 1920,
  height: 1080,
  kind: "web-demo-capture-not-native",
});

if (!process.argv.includes("--stills-only")) {
  await context.close();
  const motionContext = await browser.newContext({
    locale: "pt-BR",
    deviceScaleFactor: 2,
    reducedMotion: "no-preference",
  });
  const motionPage = await motionContext.newPage();
  await motionPage.setViewportSize({ width: 540, height: 960 });
  await motionPage.goto(base + "/midia");
  await motionPage.locator('html[data-app-ready="true"]').waitFor();
  const svgs = await motionPage
    .locator("svg.motion")
    .evaluateAll((elements) => elements.map((element) => element.outerHTML));
  const motionSource = await readFile(
    resolve(root, "src/lib/components/LaunchMotion.svelte"),
    "utf8",
  );
  const motionStyles = motionSource.match(/<style>([\s\S]*?)<\/style>/)[1];
  const motionItems = [
    {
      id: "cost",
      headline: "Cada km,<br>mais claro.",
      sub: "Conheça seu custo por quilômetro.",
      photo: photos[1],
    },
    {
      id: "service",
      headline: "Cada cuidado<br>fica na história.",
      sub: "Guarde o histórico da sua moto.",
      photo: photos[2],
    },
    {
      id: "reminder",
      headline: "Mais cuidado.<br>Mais estrada.",
      sub: "Veja a próxima revisão por data ou km.",
      photo: photos[0],
    },
  ];
  for (const [index, item] of motionItems.entries()) {
    const frameDir = await mkdtemp(join(tmpdir(), "moto-track-motion-"));
    try {
      const body =
        '<img class="backdrop" src="' +
        item.photo +
        '"><div class="fade"></div><div class="motion-copy"><img src="' +
        logo +
        '"><p class="eyebrow">CADA QUILÔMETRO CONTA</p><h1>' +
        item.headline +
        '</h1><p class="sub">' +
        item.sub +
        '</p></div><div class="motion-panel">' +
        svgs[index] +
        '</div><div class="end">moto-track.net <span>DADOS ILUSTRATIVOS</span></div>';
      await motionPage.setContent(
        '<!doctype html><html lang="pt-BR"><style>' +
          common +
          motionStyles +
          ".backdrop{position:absolute;inset:0;width:100%;height:56%;object-fit:cover;transform-origin:60% 40%;opacity:.65}.fade{position:absolute;inset:0;background:linear-gradient(0deg,#101012 43%,transparent 100%)}.motion-copy{position:relative;padding:40px}.motion-copy>img{width:155px}.eyebrow{margin-top:265px;font-size:12px;letter-spacing:2px;color:#f87171}h1{font-size:72px;line-height:.95;margin-top:15px}.sub{font-size:19px;color:#d4d4d8;margin-top:18px}.motion-panel{position:absolute;top:650px;left:30px;width:480px;border:1px solid #3f3f46;background:#18181b;border-radius:8px;overflow:hidden}.motion-panel svg{display:block;width:100%;height:auto}.end{position:absolute;bottom:30px;left:40px;right:40px;font-size:17px;letter-spacing:1px}.end span{float:right;font-size:9px;letter-spacing:1px;color:#a1a1aa;padding-top:6px}</style><body>" +
          body +
          "</body></html>",
      );
      await motionPage.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((image) => image.decode()));
      });
      for (let frame = 0; frame < 144; frame++) {
        await motionPage.evaluate((frame) => {
          const milliseconds = (frame / 24) * 1000;
          for (const animation of document.getAnimations()) {
            animation.pause();
            animation.currentTime = milliseconds;
          }
          const progress = Math.min(1, milliseconds / 900);
          document.querySelector(".motion-copy").style.opacity =
            String(progress);
          document.querySelector(".motion-copy").style.transform =
            "translateY(" + (1 - progress) * 18 + "px)";
          document.querySelector(".backdrop").style.transform =
            "scale(" + (1 + (frame / 144) * 0.035) + ")";
        }, frame);
        await motionPage.screenshot({
          path: join(frameDir, String(frame).padStart(4, "0") + ".jpg"),
          type: "jpeg",
          quality: 90,
        });
        if (frame === 72)
          await motionPage.screenshot({
            path: resolve(out, "motion/" + item.id + "-poster.png"),
          });
      }
      const result = spawnSync(
        process.env.FFMPEG_PATH ?? "ffmpeg",
        [
          "-y",
          "-loglevel",
          "error",
          "-framerate",
          "24",
          "-i",
          join(frameDir, "%04d.jpg"),
          "-c:v",
          "libx264",
          "-crf",
          "20",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          "-an",
          resolve(out, "motion/" + item.id + "-1080x1920.mp4"),
        ],
        { encoding: "utf8" },
      );
      if (result.status !== 0)
        throw new Error(result.stderr || String(result.error));
      inventory.push({
        file: "motion/" + item.id + "-1080x1920.mp4",
        width: 1080,
        height: 1920,
        fps: 24,
        seconds: 6,
        audio: false,
      });
      console.log("Rendered motion:", item.id);
    } finally {
      await rm(frameDir, { recursive: true, force: true });
    }
  }
  await motionContext.close();
}
await browser.close();
await writeFile(
  resolve(out, "inventory.json"),
  JSON.stringify(inventory, null, 2) + "\n",
);
console.log("Launch renders complete:", inventory.length);
