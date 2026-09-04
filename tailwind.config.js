/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        body: ["DM Sans", "system-ui", "sans-serif"],
        headline: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["Space Mono", "monospace"],
      },
      colors: {
        brand: {
          gold: "#8B6914",
          "gold-light": "#C4A035",
          brown: "#5C3A1E",
          green: "#2D6A2E",
          cream: "#FAF6F0",
          white: "#FFFFFF",
          "warm-gray": "#7A7068",
          dark: "#1C1917",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
