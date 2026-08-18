/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      animation: {
        'infinite-scroll': 'infinite-scroll 40s linear infinite',
      },
      keyframes: {
        'infinite-scroll': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-100%)' },
        },
      },
    },
  },
  // These are built at runtime as `bg-${stat.color}-500/10`, so the literal
  // strings never appear in the source for Tailwind to find. Without this the
  // stat tiles on the dashboard, admin analytics and citations pages lose their
  // colours silently - no error, just grey boxes.
  safelist: [
    'bg-blue-500/10', 'text-blue-500',
    'bg-purple-500/10', 'text-purple-500',
    'bg-green-500/10', 'text-green-500',
    'bg-red-500/10', 'text-red-500',
    'bg-indigo-500/10', 'text-indigo-500',
    'bg-amber-500/10', 'text-amber-500',
    'bg-cyan-500/10', 'text-cyan-500',
  ],
  plugins: [],
}
