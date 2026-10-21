import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import adapter from '@sveltejs/adapter-vercel';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// SvelteKit 3 removed the built-in $lib; keep it as an explicit alias.
			alias: { $lib: 'src/lib' },
			adapter: adapter({ runtime: 'nodejs22.x' })
		})
	]
});
