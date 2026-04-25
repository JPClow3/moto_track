module.exports = {
  content: [
    "./templates/**/*.html",
    "./apps/**/*.py"
  ],
  theme: {
    extend: {
      colors: {
        // Semantic palette driven by CSS variables and data-theme.
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-low": "rgb(var(--color-surface-low) / <alpha-value>)",
        "surface-lowest": "rgb(var(--color-surface-lowest) / <alpha-value>)",
        "surface-high": "rgb(var(--color-surface-high) / <alpha-value>)",
        "surface-highest": "rgb(var(--color-surface-highest) / <alpha-value>)",
        "surface-variant": "rgb(var(--color-surface-variant) / <alpha-value>)",
        "inverse-surface": "rgb(var(--color-inverse-surface) / <alpha-value>)",
        "on-surface": "rgb(var(--color-on-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--color-on-surface-variant) / <alpha-value>)",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        "primary-dim": "rgb(var(--color-primary-dim) / <alpha-value>)",
        "on-primary": "rgb(var(--color-on-primary) / <alpha-value>)",
        outline: "rgb(var(--color-outline) / <alpha-value>)",
        "outline-variant": "rgb(var(--color-outline-variant) / <alpha-value>)",
        error: "rgb(var(--color-error) / <alpha-value>)",
        "on-error": "rgb(var(--color-on-error) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        info: "rgb(var(--color-info) / <alpha-value>)",
        brand: "#DC2626",
        "brand-hover": "#EF4444",
        "brand-active": "#B91C1C",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Tahoma", "sans-serif"],
        headline: ["Rajdhani", "Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Tahoma", "sans-serif"],
        display: ["Rajdhani", "Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Tahoma", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1rem",
        card: "1rem",
        control: "0.875rem",
      },
      boxShadow: {
        ambient: "var(--shadow-panel)",
        panel: "var(--shadow-panel)",
        subtle: "var(--shadow-soft)",
      },
    }
  },
  plugins: []
};
