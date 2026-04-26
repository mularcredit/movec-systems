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
        bgPrimary: 'var(--color-bg-primary)',
        bgSecondary: 'var(--color-bg-secondary)',
        accentPrimary: 'var(--color-accent-primary)',
        accentSecondary: 'var(--color-accent-secondary)',
        accentLight: 'var(--color-accent-light)',
        accentMuted: 'var(--color-accent-muted)',
        accentDeep: 'var(--color-accent-deep)',
        textPrimary: 'var(--color-text-primary)',
        textSecondary: 'var(--color-text-secondary)',
        primary: {
          light: '#34d399',
          DEFAULT: '#059669', // Emerald 600 - Green buttons
          dark: '#047857',
        },
        dark: {
          sidebar: 'var(--color-bg-secondary)', 
          content: 'var(--color-bg-primary)', 
        }
      }
    },
  },
  plugins: [],
}
