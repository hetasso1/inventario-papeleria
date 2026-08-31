import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * Server-side load and actions for /login route.
 */
export const load: PageServerLoad = async ({ locals }) => {
	// If already authenticated, redirect to /caja
	if (locals.user) {
		throw redirect(303, '/caja');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = formData.get('email');
		const password = formData.get('password');

		if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
			return fail(400, {
				email: typeof email === 'string' ? email : '',
				error: 'Correo electrónico y contraseña requeridos.'
			});
		}

		if (!locals.supabase?.auth) {
			return fail(500, {
				email,
				error: 'Servicio de autenticación no disponible.'
			});
		}

		const { data, error } = await locals.supabase.auth.signInWithPassword({
			email: email.trim(),
			password: password
		});

		if (error || !data?.user) {
			// Do not leak sensitive internal auth error details
			return fail(400, {
				email,
				error: 'Credenciales inválidas. Verifique su correo y contraseña.'
			});
		}

		// Upon successful authentication, redirect with HTTP 303 to /caja
		throw redirect(303, '/caja');
	}
};
