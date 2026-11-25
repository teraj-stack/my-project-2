import {defineConfig} from 'vitest/config';

export default defineConfig({
	worker: {
		format: 'es',
	},
	build: {
		target: 'es2022',
	},
	test: {
		include: ['tests/**/*.test.ts'],
		exclude: ['.agents/**', 'node_modules/**', 'dist/**'],
	},
});
