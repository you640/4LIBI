/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ForenzDetectiv design tokens (BACKLOG.md S2.5)
        bg: {
          DEFAULT: "#020617", // slate-950
          surface: "#0f172a", // slate-900
        },
        cta: {
          DEFAULT: "#f59e0b", // amber-500
          hover: "#d97706", // amber-600
        },
        accent: "#60a5fa", // blue-400
        danger: "#ef4444", // red-500
        success: "#34d399", // emerald-400
      },
      borderColor: {
        danger: "#ef4444",
        accent: "#60a5fa",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      // Mobile-first: max width pre app shell
      maxWidth: {
        app: "480px",
      },
    },
  },
  plugins: [],
};
