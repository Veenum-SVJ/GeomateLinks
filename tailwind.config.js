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
        display: ["DM Sans", "system-ui", "sans-serif"],
        body: ["DM Sans", "system-ui", "sans-serif"],
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
        background: "#FAF6F0",
        foreground: "#1C1917",
        border: "#E5DED2",
        input: "#D9D0C1",
        ring: "#5C3A1E",
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#1C1917",
        },
        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#1C1917",
        },
        muted: {
          DEFAULT: "#F3EFE8",
          foreground: "#7A7068",
        },
        primary: {
          DEFAULT: "#5C3A1E",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#F3EFE8",
          foreground: "#5C3A1E",
        },
        accent: {
          DEFAULT: "#8B6914",
          foreground: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "#B3261E",
          foreground: "#FFFFFF",
        },
        success: {
          DEFAULT: "#2D6A2E",
          foreground: "#FFFFFF",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
