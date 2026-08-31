import { redirect, type Handle } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/supabase/server';

/**
 * Server-side hook for SvelteKit.
 *
 * Implements:
 * 1. Supabase SSR client initialization and session attachment to event.locals.
 * 2. RBAC Route Guards:
 *    - /admin/* requires authenticated user with role === 'admin'.
 *    - cajero attempting /admin/* receives HTTP 303 redirect to /caja (SRS requirement).
 *    - Unauthenticated users requesting protected routes (/admin/*, /caja/*) are redirected to /login.
 *    - Authenticated users requesting /login are redirected to /caja.
 *    - /login remains publicly accessible for unauthenticated users.
 */
export const handle: Handle = async ({ event, resolve }) => {
	// Initialize Supabase SSR client if not already present (e.g. from mock/test)
	if (!event.locals.supabase) {
		try {
			event.locals.supabase = createSupabaseServerClient(event.cookies);
		} catch {
			// Allows running in test environments without full env setup
		}
	}

	// Validate user session securely with Supabase server
	let user = null;
	if (event.locals.supabase?.auth) {
		try {
			const { data, error } = await event.locals.supabase.auth.getUser();
			if (!error && data?.user) {
				user = data.user;
			}
		} catch {
			user = null;
		}
	}

	event.locals.user = user;
	event.locals.role = (user?.app_metadata?.role as 'admin' | 'cajero') ?? null;

	const path = event.url.pathname;

	// 1. Admin Routes Guard (/admin/*)
	if (path.startsWith('/admin')) {
		if (!user) {
			throw redirect(303, '/login');
		}
		if (event.locals.role !== 'admin') {
			// SRS requirement: cajero requesting /admin/* is redirected 303 to /caja
			throw redirect(303, '/caja');
		}
	}

	// 2. Caja Routes Guard (/caja/*)
	if (path.startsWith('/caja')) {
		if (!user) {
			throw redirect(303, '/login');
		}
	}

	// 3. Login Route Guard (/login)
	if (path === '/login') {
		if (user) {
			throw redirect(303, '/caja');
		}
	}

	return resolve(event, {
		filterSerializedResponseHeaders: (name) => name === 'content-range'
	});
};
