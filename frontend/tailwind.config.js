/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      colors: {
        primary: {
          light: '#34d399',
          DEFAULT: '#059669', // Emerald 600 - Green buttons
          dark: '#047857',
        },
        dark: {
          sidebar: '#0f172a', // Slate 900
          content: '#f8fafc', // Slate 50
        }
      }
    },
  },
  plugins: [],
}
