/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        wordle: {
          bg: '#121213',
          tile: '#121213',
          'tile-border': '#3a3a3c',
          'tile-filled': '#565758',
          correct: '#538d4e',
          present: '#b59f3b',
          absent: '#3a3a3c',
          key: '#818384',
          'key-text': '#ffffff',
          header: '#1a1a1b',
          'header-border': '#3a3a3c',
          text: '#ffffff',
          'text-muted': '#818384',
        },
      },
      keyframes: {
        flip: {
          '0%': { transform: 'rotateX(0deg)' },
          '50%': { transform: 'rotateX(-90deg)' },
          '100%': { transform: 'rotateX(0deg)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
        bounce: {
          '0%, 20%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(-20px)' },
          '50%': { transform: 'translateY(5px)' },
          '60%': { transform: 'translateY(-10px)' },
          '80%': { transform: 'translateY(2px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { transform: 'translateY(-40px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        flip: 'flip 0.5s ease forwards',
        shake: 'shake 0.5s ease',
        bounce: 'bounce 1s ease',
        'slide-in': 'slide-in 0.3s ease',
        'fade-in': 'fade-in 0.4s ease',
        pop: 'pop 0.1s ease',
      },
    },
  },
  plugins: [],
};
