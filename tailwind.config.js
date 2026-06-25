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
        
        // Luminous Visual System
        luminous: {
          bg: "#050505",
          card: "#0A0A0A",
          primary: "#f97316",
          primaryStart: "#fb923c",
          primaryEnd: "#ea580c",
          text: "#ffffff",
          muted: "#a3a3a3",
          border: "rgba(255, 255, 255, 0.05)",
          glow: "rgba(249, 115, 22, 0.3)"
        }
      },
      fontFamily: {
        sans: ["'Inter'", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        headline: ["'Bricolage Grotesque'", "'Inter'", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        display: ["'Bricolage Grotesque'", "'Inter'", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      spacing: {
        18: "4.5rem",
        section: "6rem",
      },
      borderRadius: {
        xl: "0.5rem",
        "2xl": "0.625rem",
        card: "var(--radius-card)",
        button: "var(--radius-button)",
        control: "0.5rem",
        large: "32px",
      },
      boxShadow: {
        ambient: "var(--shadow-panel)",
        panel: "var(--shadow-panel)",
        subtle: "var(--shadow-soft)",
        electric: "0 0 40px rgba(249, 115, 22, 0.2), inset 0 0 20px rgba(249, 115, 22, 0.1)",
      },
      animation: {
        'fade-in-up-blur': 'fadeInUpBlur 1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'pulse-glow': 'pulseGlow 2s infinite',
      },
      keyframes: {
        fadeInUpBlur: {
          '0%': { opacity: '0', transform: 'translateY(20px)', filter: 'blur(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.7', transform: 'scale(1.05)' },
        }
      }
    }
  },
  plugins: []
};
