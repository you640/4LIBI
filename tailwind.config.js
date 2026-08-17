/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--md-sys-color-primary)",
          container: "var(--md-sys-color-primary-container)",
          on: "var(--md-sys-color-on-primary)",
          "on-container": "var(--md-sys-color-on-primary-container)",
        },
        surface: {
          DEFAULT: "var(--md-sys-color-surface)",
          lowest: "var(--md-sys-color-surface-container-lowest)",
          low: "var(--md-sys-color-surface-container-low)",
          container: "var(--md-sys-color-surface-container)",
          high: "var(--md-sys-color-surface-container-high)",
          highest: "var(--md-sys-color-surface-container-highest)",
          on: "var(--md-sys-color-on-surface)",
        },
        outline: {
          DEFAULT: "var(--md-sys-color-outline)",
          variant: "var(--md-sys-color-outline-variant)",
        },
        error: {
          DEFAULT: "var(--md-sys-color-error)",
          container: "var(--md-sys-color-error-container)",
          on: "var(--md-sys-color-on-error)",
          "on-container": "var(--md-sys-color-on-error-container)",
        },
        success: {
          DEFAULT: "var(--md-sys-color-success)",
          container: "var(--md-sys-color-success-container)",
          "on-container": "var(--md-sys-color-on-success-container)",
        },
        /* keep short aliases used in older components */
        cta: {
          DEFAULT: "var(--md-sys-color-primary)",
          hover: "var(--md-sys-color-on-primary-container)",
        },
        danger: "var(--md-sys-color-error)",
        accent: "var(--md-sys-color-outline)",
        bg: {
          DEFAULT: "var(--md-sys-color-surface)",
          milk: "var(--md-sys-color-surface-container-low)",
          surface: "var(--md-sys-color-surface-container-lowest)",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "SF Pro Display",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      maxWidth: {
        app: "430px",
      },
    },
  },
  plugins: [],
};
