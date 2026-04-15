module.exports = {
  content: [
    "./templates/**/*.html",
    "./apps/**/*.py"
  ],
  theme: {
    extend: {
      colors: {
        // Brighter, higher-contrast palette (keeps existing token names).
        surface: "#f6f8fc",
        "surface-low": "#edf2fb",
        "surface-lowest": "#ffffff",
        "surface-high": "#dfe8f6",
        "surface-highest": "#cfdcf0",
        "surface-variant": "#cfdcf0",
        "inverse-surface": "#0b1220",
        "on-surface": "#0f172a",
        "on-surface-variant": "#475569",
        primary: "#2563eb",
        "primary-dim": "#1d4ed8",
        "on-primary": "#ffffff",
        outline: "#64748b",
        "outline-variant": "#cbd5e1",
        error: "#dc2626",
        "on-error": "#ffffff",
        success: "#16a34a",
        warning: "#f59e0b",
        info: "#06b6d4",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "Segoe UI", "Tahoma", "sans-serif"],
        headline: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "Segoe UI", "Tahoma", "sans-serif"],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        ambient: "0 8px 24px rgba(42, 52, 57, 0.06)",
      },
    }
  },
  plugins: [require("@tailwindcss/forms")]
};
