import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        safe: "#34d399",
        warning: "#fbbf24",
        danger: "#f87171",
        "text-primary": "#1e293b",
      },
    },
  },
  plugins: [],
};

export default config;
