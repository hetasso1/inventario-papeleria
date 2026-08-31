import { describe, it, expect, vi } from 'vitest';
import { handle } from '../../src/hooks.server';
import { load as loginLoad, actions as loginActions } from '../../src/routes/login/+page.server';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * ISSUE-002: Authentication, RBAC & Server-Side Route Guards Tests
 *
 * Validates:
 * 1. Unauthenticated user accessing /admin/* -> 303 Redirect to /login.
 * 2. Role 'cajero' accessing /admin/* -> 303 Redirect to /caja (SRS v8.0 requirement).
 * 3. Role 'admin' accessing /admin/* -> Allowed (resolve called).
 * 4. Authenticated users (admin or cajero) accessing /caja/* -> Allowed.
 * 5. Unauthenticated user accessing /caja/* -> 303 Redirect to /login.
 * 6. Unauthenticated user accessing /login -> Allowed.
 * 7. Authenticated user accessing /login -> 303 Redirect to /caja.
 * 8. Role is strictly derived from user.app_metadata.role.
 * 9. Server-side login action validates inputs and handles credentials securely.
 */

function createMockEvent(pathname: string, user: any = null) {
	const resolve = vi.fn().mockImplementation(async () => new Response('OK', { status: 200 }));
	const cookiesMap = new Map<string, string>();

	const event = {
		url: new URL(`http://localhost:5173${pathname}`),
		cookies: {
			getAll: () => Array.from(cookiesMap.entries()).map(([name, value]) => ({ name, value })),
			get: (key: string) => cookiesMap.get(key),
			set: (key: string, value: string) => cookiesMap.set(key, value),
			delete: (key: string) => cookiesMap.delete(key)
		},
		locals: {
			supabase: {
				auth: {
					getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
					signInWithPassword: vi.fn()
				}
			},
			user: null,
			role: null
		},
		request: new Request(`http://localhost:5173${pathname}`)
	} as unknown as RequestEvent;

	return { event, resolve };
}

describe('ISSUE-002: Server-Side RBAC Route Guards (hooks.server.ts)', () => {
	it('redirects unauthenticated user accessing /admin to /login with HTTP 303', async () => {
		const { event, resolve } = createMockEvent('/admin/productos', null);

		try {
			await handle({ event, resolve });
			expect.unreachable('Should have thrown a redirect');
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toBe('/login');
			expect(resolve).not.toHaveBeenCalled();
		}
	});

	it('redirects role cajero accessing /admin/* to /caja with HTTP 303 (SRS requirement)', async () => {
		const cajeroUser = {
			id: '22222222-2222-2222-2222-222222222222',
			email: 'cajero@papeleria.local',
			app_metadata: { role: 'cajero' }
		};
		const { event, resolve } = createMockEvent('/admin/productos', cajeroUser);

		try {
			await handle({ event, resolve });
			expect.unreachable('Should have thrown a redirect');
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toBe('/caja');
			expect(resolve).not.toHaveBeenCalled();
		}
	});

	it('allows role admin to access /admin/*', async () => {
		const adminUser = {
			id: '11111111-1111-1111-1111-111111111111',
			email: 'admin@papeleria.local',
			app_metadata: { role: 'admin' }
		};
		const { event, resolve } = createMockEvent('/admin/productos', adminUser);

		const response = await handle({ event, resolve });
		expect(response.status).toBe(200);
		expect(resolve).toHaveBeenCalled();
		expect(event.locals.role).toBe('admin');
	});

	it('allows authenticated user (cajero or admin) to access /caja', async () => {
		const cajeroUser = {
			id: '22222222-2222-2222-2222-222222222222',
			email: 'cajero@papeleria.local',
			app_metadata: { role: 'cajero' }
		};
		const { event, resolve } = createMockEvent('/caja', cajeroUser);

		const response = await handle({ event, resolve });
		expect(response.status).toBe(200);
		expect(resolve).toHaveBeenCalled();
		expect(event.locals.role).toBe('cajero');
	});

	it('redirects unauthenticated user accessing /caja to /login with HTTP 303', async () => {
		const { event, resolve } = createMockEvent('/caja', null);

		try {
			await handle({ event, resolve });
			expect.unreachable('Should have thrown a redirect');
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toBe('/login');
			expect(resolve).not.toHaveBeenCalled();
		}
	});

	it('allows unauthenticated user to access /login', async () => {
		const { event, resolve } = createMockEvent('/login', null);

		const response = await handle({ event, resolve });
		expect(response.status).toBe(200);
		expect(resolve).toHaveBeenCalled();
	});

	it('redirects already authenticated user requesting /login to /caja with HTTP 303', async () => {
		const cajeroUser = {
			id: '22222222-2222-2222-2222-222222222222',
			email: 'cajero@papeleria.local',
			app_metadata: { role: 'cajero' }
		};
		const { event, resolve } = createMockEvent('/login', cajeroUser);

		try {
			await handle({ event, resolve });
			expect.unreachable('Should have thrown a redirect');
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toBe('/caja');
			expect(resolve).not.toHaveBeenCalled();
		}
	});

	it('strictly derives role from app_metadata.role and rejects client spoofing', async () => {
		const spoofedUser = {
			id: '33333333-3333-3333-3333-333333333333',
			email: 'spoofed@papeleria.local',
			user_metadata: { role: 'admin' }, // Client-editable user metadata should NOT grant admin
			app_metadata: { role: 'cajero' } // Authoritative server app_metadata
		};
		const { event, resolve } = createMockEvent('/admin/auditoria', spoofedUser);

		try {
			await handle({ event, resolve });
			expect.unreachable('Should have thrown a redirect');
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toBe('/caja');
			expect(event.locals.role).toBe('cajero');
		}
	});
});

describe('ISSUE-002: Login Page Server Load & Actions (+page.server.ts)', () => {
	it('load function redirects already authenticated user to /caja with HTTP 303', async () => {
		const user = { id: '11111111-1111-1111-1111-111111111111', app_metadata: { role: 'admin' } };
		const event = {
			locals: { user }
		} as unknown as RequestEvent;

		try {
			await loginLoad(event as any);
			expect.unreachable('Should have thrown a redirect');
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toBe('/caja');
		}
	});

	it('load function returns empty object for unauthenticated user', async () => {
		const event = {
			locals: { user: null }
		} as unknown as RequestEvent;

		const result = await loginLoad(event as any);
		expect(result).toEqual({});
	});

	it('action fails with 400 when email or password is empty', async () => {
		const formData = new FormData();
		formData.append('email', '');
		formData.append('password', '');

		const event = {
			request: { formData: vi.fn().mockResolvedValue(formData) },
			locals: { supabase: { auth: {} } }
		} as unknown as RequestEvent;

		const result: any = await (loginActions as any).default(event);
		expect(result.status).toBe(400);
		expect(result.data.error).toContain('Correo electrónico y contraseña requeridos');
	});

	it('action fails with 400 when Supabase auth returns invalid credentials without leaking details', async () => {
		const formData = new FormData();
		formData.append('email', 'usuario@papeleria.local');
		formData.append('password', 'wrongpassword');

		const signInWithPassword = vi.fn().mockResolvedValue({
			data: { user: null },
			error: { message: 'Invalid login credentials' }
		});

		const event = {
			request: { formData: vi.fn().mockResolvedValue(formData) },
			locals: { supabase: { auth: { signInWithPassword } } }
		} as unknown as RequestEvent;

		const result: any = await (loginActions as any).default(event);
		expect(result.status).toBe(400);
		expect(result.data.error).toBe('Credenciales inválidas. Verifique su correo y contraseña.');
		expect(signInWithPassword).toHaveBeenCalledWith({
			email: 'usuario@papeleria.local',
			password: 'wrongpassword'
		});
	});

	it('action redirects with HTTP 303 to /caja upon successful authentication', async () => {
		const formData = new FormData();
		formData.append('email', 'cajero@papeleria.local');
		formData.append('password', 'validpassword123');

		const signInWithPassword = vi.fn().mockResolvedValue({
			data: {
				user: {
					id: '22222222-2222-2222-2222-222222222222',
					app_metadata: { role: 'cajero' }
				}
			},
			error: null
		});

		const event = {
			request: { formData: vi.fn().mockResolvedValue(formData) },
			locals: { supabase: { auth: { signInWithPassword } } }
		} as unknown as RequestEvent;

		try {
			await (loginActions as any).default(event);
			expect.unreachable('Should have thrown a redirect');
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toBe('/caja');
		}
	});
});
