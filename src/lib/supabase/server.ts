import { createServerClient } from '@supabase/ssr';
import type { Cookies } from '@sveltejs/kit';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * Creates a Supabase client for server-side (SSR) usage.
 * Integrates with SvelteKit's cookie API for session management.
 *
 * Usage: call from hooks.server.ts or +page.server.ts load functions,
 * passing the `cookies` object from the event.
 */
export function createSupabaseServerClient(cookies: Cookies) {
	return createServerClient(supabaseUrl, supabaseAnonKey, {
		cookies: {
			getAll: () => cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});
}
