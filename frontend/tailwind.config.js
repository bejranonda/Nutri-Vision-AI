/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        // Shinny Guide Brand Colors
        brand: {
          primary: {
            50: '#fff5f5',
            100: '#ffe0e0',
            200: '#ffc5c5',
            300: '#ffa3a3',
            400: '#ff6b6b', // Coral Red - Main
            500: '#f25c5c',
            600: '#e04545',
            700: '#c73232',
            800: '#a52828',
            900: '#8a2424',
          },
          secondary: {
            50: '#f0fdfb',
            100: '#ccfcf5',
            200: '#99f7eb',
            300: '#66efe0',
            400: '#4ecdc4', // Teal - Main
            500: '#3dbdb4',
            600: '#32a49c',
            700: '#2b8580',
            800: '#266b68',
            900: '#225a57',
          },
          accent: {
            50: '#fffdf0',
            100: '#fff8d4',
            200: '#ffefa8',
            300: '#ffe36d',
            400: '#ffe66d', // Warm Yellow - Main
            500: '#f5d855',
            600: '#e8c33d',
            700: '#c9a52e',
            800: '#a68628',
            900: '#8a6f25',
          },
          neutral: '#2C3E50',
          success: '#95E1A3',
          warning: '#FFB347',
        },
        // Food sequence colors
        sequence: {
          fiber: '#22c55e', // Green for Vegetables/Fiber
          protein: '#3b82f6', // Blue for Protein
          carb: '#f59e0b', // Amber for Carbohydrates
          sugar: '#ef4444', // Red for Sweets
        },
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        thai: ['Prompt', 'Sarabun', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'brand': '0 4px 20px rgba(255, 107, 107, 0.15)',
        'brand-lg': '0 8px 30px rgba(255, 107, 107, 0.2)',
        'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
        'glass-hover': '0 8px 32px rgba(0, 0, 0, 0.15)',
        'success': '0 4px 20px rgba(149, 225, 163, 0.3)',
        'warning': '0 4px 20px rgba(255, 179, 71, 0.3)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-light': 'bounce-light 2s infinite',
        'bounce-in': 'bounce-in 0.5s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'wiggle': 'wiggle 0.5s ease-in-out',
        'celebrate': 'celebrate 0.6s ease-in-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: '.8' },
        },
        'bounce-light': {
          '0%, 100%': {
            transform: 'translateY(-5%)',
            animationTimingFunction: 'cubic-bezier(0.8,0,1,1)'
          },
          '50%': {
            transform: 'none',
            animationTimingFunction: 'cubic-bezier(0,0,0.2,1)'
          }
        },
        'bounce-in': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        'celebrate': {
          '0%': { transform: 'scale(1) rotate(0deg)' },
          '25%': { transform: 'scale(1.1) rotate(-5deg)' },
          '50%': { transform: 'scale(1.2) rotate(5deg)' },
          '75%': { transform: 'scale(1.1) rotate(-3deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)' },
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
