import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	return {
		user: locals.user
			? {
					id: locals.user.id,
					email: locals.user.email,
					role: locals.role ?? (locals.user.app_metadata?.role as 'admin' | 'cajero') ?? 'cajero'
				}
			: null,
		role: locals.role ?? (locals.user?.app_metadata?.role as 'admin' | 'cajero') ?? null,
		pathname: url.pathname
	};
};
