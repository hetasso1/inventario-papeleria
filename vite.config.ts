import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), ['VITE_', 'PUBLIC_']);
	const rawUrl = env.VITE_SUPABASE_URL || env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || '';
	const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
	const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || '';

	return {
		define: {
			'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
			'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey)
		},
		plugins: [
			tailwindcss(),
			sveltekit()
		],
		test: {
			projects: [
				{
					extends: './vite.config.ts',
					test: {
						name: 'server',
						environment: 'node',
						include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
						exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'src/lib/vitest-examples/**']
					}
				}
			]
		}
	};
});
