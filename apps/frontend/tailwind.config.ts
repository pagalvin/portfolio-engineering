import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

const config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', ...defaultTheme.fontFamily.sans],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        // Semantic token mapping to Tailwind scale
        'text-primary': 'var(--color-text-primary)',
        'text-strong': 'var(--color-text-strong)',
        'text-muted': 'var(--color-text-muted)',
        'bg-canvas': 'var(--color-bg-canvas)',
        'surface-default': 'var(--color-surface-default)',
        'surface-emphasis': 'var(--color-surface-emphasis)',
        'surface-muted': 'var(--color-surface-muted)',
        'surface-code': 'var(--color-surface-code)',
        'border-subtle': 'var(--color-border-subtle)',
        'action-primary': 'var(--color-action-primary)',
        'state-success': 'var(--color-state-success)',
        'state-warning': 'var(--color-state-warning)',
        'state-error': 'var(--color-state-error)',
      },
      boxShadow: {
        elevation: 'var(--shadow-elevation-soft)',
      },
      borderRadius: {
        lg: '1rem',
        md: '0.75rem',
        sm: '0.4rem',
      },
      spacing: {
        xs: '0.35rem',
        sm: '0.75rem',
        base: '1rem',
        lg: '1.5rem',
        xl: '3rem',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
} satisfies Config

export default config
