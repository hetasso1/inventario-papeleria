import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	throw redirect(303, '/login');
};

export const actions: Actions = {
	default: async ({ locals }) => {
		if (locals.supabase?.auth) {
			try {
				await locals.supabase.auth.signOut();
			} catch {
				// Ignore errors during signOut
			}
		}
		throw redirect(303, '/login');
	}
};
