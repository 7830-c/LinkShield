import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#0a0a0f",
        surface: "#12121a",
        border: "#1e1e2e",
        accent: "#00d4aa",
        accentDim: "#00a884",
        danger: "#ff4757",
        warn: "#ffa502",
        muted: "#6b7280",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      animation: {
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "slide-up": "slide-up 0.5s ease-out forwards",
        "slide-in": "slide-in 0.35s ease-out forwards",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "fade-up": "fade-up 0.6s ease-out forwards",
        "scale-in": "scale-in 0.4s ease-out forwards",
        "float": "float 6s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0,212,170,0.2)" },
          "50%": { boxShadow: "0 0 30px rgba(0,212,170,0.35)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
