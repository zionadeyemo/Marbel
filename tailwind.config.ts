import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ivory: "#faf8f5",
        warm: "#f2ede6",
        beige: "#e5dfd5",
        stone: { DEFAULT: "#c8c1b5", light: "#dbd6cf" },
        taupe: "#a09588",
        olive: "#6b6760",
        charcoal: "#2e2b27",
        ink: "#1a1815",
        sage: { DEFAULT: "#7a8a76", light: "#d4ddd3" },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
