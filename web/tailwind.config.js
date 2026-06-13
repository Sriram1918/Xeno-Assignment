/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tb: {
          purple: "#5C2D91", // deep brand purple
          grape: "#7B2D8E",
          magenta: "#C8159E", // bright magenta
          pink: "#E4007C",
          yellow: "#FFC72C", // cheese-yellow CTA
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
