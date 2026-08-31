import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Root route / redirects based on user authentication status:
 * - Unauthenticated -> /login
 * - Authenticated -> /caja
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	throw redirect(303, '/caja');
};
