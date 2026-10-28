import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Straight from the logo: red-600 on a cool zinc scale.
        brand: {
          DEFAULT: "#dc2626",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          900: "#7f1d1d",
        },
        ink: "#18181b",
        asphalt: "#27272a",
        paper: "#fafafa",
        steel: "#71717a",

        // Theme-aware role colours. These resolve to the CSS tokens in app.css
        // so they follow dark mode; static hex values here used to fail
        // contrast on dark panels.
        danger: "var(--danger)",
        success: "var(--success)",
        warning: "var(--warning)",
        info: "var(--info)",
        cat: {
          fuel: "var(--cat-fuel)",
          maintenance: "var(--cat-maintenance)",
          tires: "var(--cat-tires)",
          fees: "var(--cat-fees)",
        },
      },
      fontFamily: {
        sans: ["Archivo Variable", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Archivo Variable", "ui-sans-serif", "sans-serif"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(24, 24, 27, 0.04)",
        lift: "0 12px 32px -8px rgba(24, 24, 27, 0.18)",
        brand: "0 12px 32px -8px rgba(220, 38, 38, 0.4)",
      },
      borderRadius: {
        panel: "4px",
      },
    },
  },
  plugins: [],
} satisfies Config;
