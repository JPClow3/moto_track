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

        // Red is the only red. A filled red button reads as destructive
        // because red never appears as a filled surface anywhere else.
        danger: "#dc2626",

        // Status colours are deliberately low-chroma so red stays the
        // loudest thing on the page.
        success: "#15803d",
        warning: "#b45309",

        // Legacy aliases. `signal` was amber and `moss` was green; both are
        // still referenced by pages not yet migrated, so they point at the
        // new brand values to keep those pages coherent in the meantime.
        signal: "#dc2626",
        moss: "#15803d",
      },
      fontFamily: {
        sans: ["Barlow", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Barlow Condensed", "Barlow", "ui-sans-serif", "sans-serif"],
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
