/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // AttendX design tokens — a scanner/surveillance-adjacent but
        // trustworthy palette: deep ink backgrounds, a cyan "scan" accent
        // standing in for the camera/recognition motif, calm status colors.
        ink: {
          950: '#0A0E14',
          900: '#0F141C',
          800: '#161D28',
          700: '#212B3A',
          600: '#2C3A4E',
        },
        scan: {
          400: '#5EEAD4',
          500: '#2DD4BF',
        },
        mist: '#E8EDF4',
        fog: '#8593A8',
        status: {
          present: '#34D399',
          absent: '#FB7185',
          pending: '#8593A8',
          review: '#F2B705',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '80%, 100%': { transform: 'scale(1.8)', opacity: '0' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.2,0.6,0.4,1) infinite',
      },
    },
  },
  plugins: [],
};
