import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: "#80020E",
        "accent-hover": "#6b010c",
        "accent-light": "#fdf0f0",
        surface: "#f8f8f8",
        border: "#eaeaea",
        "text-primary": "#111111",
        "text-secondary": "#555555",
        "text-tertiary": "#999999",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
