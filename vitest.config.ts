import { defineConfig } from 'vitest/config';

// Standalone config: the unit-tested modules are plain TypeScript with no
// SvelteKit imports, so tests run without the kit plugin (SvelteKit 3's Vite
// plugin requires a runnable dev environment that vitest does not provide).
export default defineConfig({
	esbuild: { tsconfigRaw: '{}' },
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
