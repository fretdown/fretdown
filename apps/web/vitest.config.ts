import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		include: ['src/**/*.{test,spec}.ts'],
	},
	resolve: {
		alias: {
			'@': new URL('./src', import.meta.url).pathname,
		},
	},
});
