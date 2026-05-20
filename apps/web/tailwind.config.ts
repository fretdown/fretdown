import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{ts,tsx,md,mdx}'],
	theme: {
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				muted: 'hsl(var(--muted))',
				'muted-foreground': 'hsl(var(--muted-foreground))',
				primary: 'hsl(var(--primary))',
				'primary-foreground': 'hsl(var(--primary-foreground))',
				accent: 'hsl(var(--accent))',
				card: 'hsl(var(--card))',
			},
			fontFamily: {
				mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
			},
		},
	},
	plugins: [],
} satisfies Config;
