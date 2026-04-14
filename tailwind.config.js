module.exports = {
  content: [
    "./templates/**/*.html",
    "./apps/**/*.py"
  ],
  theme: {
    extend: {
      colors: {
        // Mechanical Atelier (stitch_exports) inspired palette
        surface: "#f7f9fb",
        "surface-low": "#f0f4f7",
        "surface-lowest": "#ffffff",
        "surface-high": "#e1e9ee",
        "surface-highest": "#d9e4ea",
        "surface-variant": "#d9e4ea",
        "inverse-surface": "#172433",
        "on-surface": "#2a3439",
        "on-surface-variant": "#566166",
        primary: "#485e8d",
        "primary-dim": "#3c5280",
        "on-primary": "#ffffff",
        outline: "#717c82",
        "outline-variant": "#a9b4b9",
        error: "#9e3f4e",
        "on-error": "#ffffff",
        success: "#2f6f4d",
        warning: "#b46a11",
        info: "#4d63a2",
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
