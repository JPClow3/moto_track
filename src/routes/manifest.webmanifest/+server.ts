import { json } from "@sveltejs/kit";

export function GET() {
  return json({
    name: "Moto Track",
    short_name: "Moto Track",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#18181b",
    icons: [
      {
        src: "/brand/web/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/brand/web/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  });
}
