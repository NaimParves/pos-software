/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Poppins', 'system-ui', 'sans-serif'] },
      colors: {
        sidebar: { DEFAULT: '#2a3042', hover: '#353c52', text: '#a6b0cf' },
        primary: '#556ee6',
        success: '#34c38f',
        danger: '#f46a6a',
        info: '#50a5f1',
        warning: '#f1b44c',
        page: '#f8f8fb',
      },
    },
  },
  plugins: [],
}
