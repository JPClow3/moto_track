import { json } from "@sveltejs/kit";
function GET() {
  return json({
    name: "Moto Track",
    short_name: "Moto Track",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f8f6f0",
    theme_color: "#18211f",
    icons: [
      {
        src: "/brand/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/brand/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  });
}
export {
  GET
};
