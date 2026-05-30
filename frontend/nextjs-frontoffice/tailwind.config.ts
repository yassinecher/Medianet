import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        // Brand palette uses CSS variables so the landing page can override
        // them at runtime from admin-chosen `primaryColor` (see app/page.tsx).
        // Fallback RGB triplets keep the default theme when no override is set.
        brand: {
          50:  'rgb(var(--brand-50,  240 244 255) / <alpha-value>)',
          100: 'rgb(var(--brand-100, 224 234 255) / <alpha-value>)',
          200: 'rgb(var(--brand-200, 199 215 254) / <alpha-value>)',
          300: 'rgb(var(--brand-300, 165 188 253) / <alpha-value>)',
          400: 'rgb(var(--brand-400, 128 152 250) / <alpha-value>)',
          500: 'rgb(var(--brand-500,  98 114 246) / <alpha-value>)',
          600: 'rgb(var(--brand-600,  74  82 235) / <alpha-value>)',
          700: 'rgb(var(--brand-700,  61  63 208) / <alpha-value>)',
          800: 'rgb(var(--brand-800,  50  53 168) / <alpha-value>)',
          900: 'rgb(var(--brand-900,  46  50 133) / <alpha-value>)',
          950: 'rgb(var(--brand-950,  27  29  78) / <alpha-value>)',
        },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      fontFamily: { sans: ['var(--font-inter)', 'system-ui', 'sans-serif'] },
      animation: {
        'border-beam': 'border-beam calc(var(--duration)*1s) infinite linear',
        'shimmer': 'shimmer 2s linear infinite',
        'gradient': 'gradient 8s linear infinite',
        'slide-up': 'slideUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        'border-beam': { '100%': { 'offset-distance': '100%' } },
        shimmer: {
          '0%, 90%, 100%': { 'background-position': 'calc(-100% - var(--shimmer-width)) 0' },
          '30%, 60%': { 'background-position': 'calc(100% + var(--shimmer-width)) 0' },
        },
        gradient: {
          '0%, 100%': { 'background-position': '0% center' },
          '50%':       { 'background-position': '100% center' },
        },
        slideUp: { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      },
    },
  },
  plugins: [],
}

export default config
