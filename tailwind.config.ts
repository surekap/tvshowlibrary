import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-syne)", "system-ui", "sans-serif"],
      },
      colors: {
        background: "var(--bg-base)",
        surface:    "var(--bg-surface)",
        elevated:   "var(--bg-elevated)",
        overlay:    "var(--bg-overlay)",
        border:     "var(--border)",
        accent:     "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "text-primary":   "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-dim":       "var(--text-dim)",
        watched:    "var(--watched)",
      },
      boxShadow: {
        glow: "0 0 24px rgba(99, 102, 241, 0.25)",
        card: "0 4px 16px rgba(0,0,0,0.5)",
      },
      borderRadius: {
        xl:  "0.875rem",
        "2xl": "1rem",
      },
      animation: {
        "fade-up": "fadeUp 0.3s ease forwards",
        shimmer:   "shimmer 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
