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
        src: "/brand/moto-track-icon.png",
        sizes: "any",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  });
}
