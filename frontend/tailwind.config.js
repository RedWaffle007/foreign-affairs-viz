/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        slate900: "#0f172a",
        slate800: "#1e293b",
        accent: "#06b6d4",
      },
    },
  },
  plugins: [],
};
