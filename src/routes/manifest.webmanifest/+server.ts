import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ locals }) => {
  const en = locals.locale === "en";
  return json(
    {
      id: "/",
      name: "Moto Track",
      short_name: "Moto Track",
      lang: en ? "en" : "pt-BR",
      description: en
        ? "Fuel, maintenance and reminders for your motorcycle."
        : "Combustível, manutenção e lembretes para a sua moto.",
      scope: "/",
      start_url: "/dashboard",
      display: "standalone",
      background_color: "#fafafa",
      theme_color: "#18181b",
      categories: ["utilities", "productivity"],
      icons: [
        {
          src: "/brand/web/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/brand/web/android-chrome-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/brand/web/maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
      shortcuts: [
        { name: en ? "My garage" : "Minha garagem", url: "/garage" },
        { name: en ? "Fuel" : "Combustível", url: "/fuel" },
        { name: en ? "Reminders" : "Lembretes", url: "/reminders" },
      ],
    },
    {
      headers: {
        "cache-control": "private, max-age=0, must-revalidate",
        vary: "Accept-Language, Cookie",
      },
    },
  );
};
