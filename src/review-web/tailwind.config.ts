import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        review: {
          bg: "#081425",
          low: "#111c2d",
          surface: "#152031",
          high: "#1f2a3c",
          highest: "#2a3548",
          border: "#424754",
          outline: "#8c909f",
          text: "#d8e3fb",
          muted: "#c2c6d6",
          primary: "#adc6ff",
          "primary-strong": "#4d8eff",
          green: "#4edea3",
          red: "#ffb4ab"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
