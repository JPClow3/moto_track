import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: "#18211f",
        paper: "#f8f6f0",
        asphalt: "#242826",
        moss: "#697d63",
        signal: "#e6b325",
        danger: "#c2413d",
        steel: "#64748b",
      },
      boxShadow: {
        panel: "0 18px 60px rgba(24, 33, 31, 0.12)",
      },
      borderRadius: {
        panel: "8px",
      },
    },
  },
  plugins: [],
} satisfies Config;
