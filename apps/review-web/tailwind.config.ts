import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        review: {
          bg: "oklch(0.18 0.035 260)",
          low: "oklch(0.23 0.033 260)",
          surface: "oklch(0.27 0.032 260)",
          high: "oklch(0.33 0.031 260)",
          highest: "oklch(0.39 0.029 260)",
          border: "oklch(0.45 0.018 260)",
          outline: "oklch(0.66 0.017 260)",
          text: "oklch(0.91 0.035 260)",
          muted: "oklch(0.82 0.026 260)",
          primary: "oklch(0.82 0.095 260)",
          "primary-strong": "oklch(0.64 0.18 260)",
          green: "oklch(0.79 0.16 160)",
          red: "oklch(0.82 0.12 25)",
          light: {
            bg: "oklch(0.98 0.009 260)",
            low: "oklch(0.95 0.014 260)",
            surface: "oklch(0.992 0.006 260)",
            high: "oklch(0.92 0.018 260)",
            highest: "oklch(0.88 0.024 260)",
            border: "oklch(0.82 0.02 260)",
            outline: "oklch(0.55 0.028 260)",
            text: "oklch(0.25 0.035 260)",
            muted: "oklch(0.46 0.026 260)",
            primary: "oklch(0.55 0.17 260)",
            "primary-strong": "oklch(0.45 0.19 260)",
            green: "oklch(0.55 0.15 160)",
            red: "oklch(0.56 0.17 25)"
          }
        }
      }
    }
  },
  plugins: []
} satisfies Config;
