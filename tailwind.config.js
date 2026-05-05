module.exports = {
  content: [
    "./templates/**/*.html",
    "./apps/**/*.py"
  ],
  theme: {
    letterSpacing: {
      tighter: "0",
      tight: "0",
      normal: "0",
      wide: "0",
      wider: "0",
      widest: "0",
    },
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
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Inter", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        headline: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Inter", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        display: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Inter", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      spacing: {
        18: "4.5rem",
      },
      borderRadius: {
        xl: "0.5rem",
        "2xl": "0.625rem",
        card: "0.5rem",
        control: "0.5rem",
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
