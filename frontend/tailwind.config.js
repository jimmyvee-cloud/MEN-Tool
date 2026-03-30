/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        night: "#121212",
        surface: "#1e1e1e",
        gold: { DEFAULT: "#d4a64b", bright: "#f5c84c" },
        muted: "#9ca3af",
      },
    },
  },
  plugins: [],
};
