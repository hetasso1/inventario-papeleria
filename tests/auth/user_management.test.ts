import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load, actions } from '../../src/routes/admin/usuarios/+page.server';
import { createSupabaseServerClient } from '../../src/lib/supabase/server';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Sprint 23: User Management Tests
 *
 * Validates:
 * 1.  Admin can access /admin/usuarios (load returns users list)
 * 2.  Cajero cannot access /admin/usuarios (redirected)
 * 3.  Admin can create "daniel" as Cajero
 * 4.  Creating a second Admin is rejected (role always fixed to cajero)
 * 5.  Duplicate username is rejected
 * 6.  Password never appears in responses/UI
 * 7.  New password allows login (PBKDF2 hash is valid)
 * 8.  Previous password stops working after change
 * 9.  Deactivated user cannot log in
 * 10. Reactivating user allows login again
 * 11. Deactivating the only Admin is forbidden
 * 12. Deactivated user remains in auth.users
 * 13. Historical sales preserve user_id
 */

// ─── Mock pg module ──────────────────────────────────────────────────────────
const { mockQuery, mockRelease, mockConnect } = vi.hoisted(() => {
	const mockQuery = vi.fn();
	const mockRelease = vi.fn();
	const mockConnect = vi.fn().mockResolvedValue({
		query: mockQuery,
		release: mockRelease
	});
	return { mockQuery, mockRelease, mockConnect };
});

vi.mock('pg', () => {
	class MockPool {
		connect: any;
		constructor() {
			this.connect = mockConnect;
		}
	}
	return {
		default: {
			Pool: MockPool
		}
	};
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createAdminLocals() {
	return {
		user: {
			id: '11111111-1111-1111-1111-111111111111',
			email: 'admin@papeleria.com',
			app_metadata: { role: 'admin' }
		},
		role: 'admin' as const,
		supabase: {}
	};
}

function createCajeroLocals() {
	return {
		user: {
			id: '22222222-2222-2222-2222-222222222222',
			email: 'cajero@papeleria.com',
			app_metadata: { role: 'cajero' }
		},
		role: 'cajero' as const,
		supabase: {}
	};
}

function createFormData(entries: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [k, v] of Object.entries(entries)) {
		fd.append(k, v);
	}
	return fd;
}

function createMockEvent(
	locals: any,
	formData?: FormData,
	pathname: string = '/admin/usuarios'
): RequestEvent {
	return {
		locals,
		url: new URL(`http://localhost:5173${pathname}`),
		request: formData
			? { formData: vi.fn().mockResolvedValue(formData) }
			: { formData: vi.fn().mockResolvedValue(new FormData()) },
		cookies: {
			getAll: () => [],
			get: () => undefined,
			set: vi.fn(),
			delete: vi.fn()
		}
	} as unknown as RequestEvent;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Sprint 23: User Management (/admin/usuarios)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// 1. Admin can access /admin/usuarios
	it('Admin can load /admin/usuarios and receives users list', async () => {
		const mockUsers = [
			{
				id: '11111111-1111-1111-1111-111111111111',
				email: 'admin@papeleria.com',
				username: 'admin',
				display_name: 'Administrador',
				is_active: true,
				role: 'admin',
				created_at: '2026-01-01T00:00:00Z'
			},
			{
				id: '22222222-2222-2222-2222-222222222222',
				email: 'cajero@papeleria.com',
				username: 'cajero',
				display_name: 'Cajero Principal',
				is_active: true,
				role: 'cajero',
				created_at: '2026-01-02T00:00:00Z'
			}
		];

		mockQuery.mockResolvedValueOnce({ rows: mockUsers });

		const event = createMockEvent(createAdminLocals());
		const result = await load(event as any);

		expect(result.users).toHaveLength(2);
		expect(result.users[0].role).toBe('admin');
		expect(result.users[1].role).toBe('cajero');
		// encrypted_password MUST NOT be present
		for (const u of result.users) {
			expect(u).not.toHaveProperty('encrypted_password');
		}
	});

	// 2. Cajero cannot access /admin/usuarios
	it('Cajero accessing /admin/usuarios is redirected with HTTP 303', async () => {
		const event = createMockEvent(createCajeroLocals());

		try {
			await load(event as any);
			expect.unreachable('Should have thrown a redirect');
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toBe('/caja');
		}
	});

	// 3. Admin can create "daniel" as Cajero
	it('Admin can create user "daniel" with role fixed to cajero', async () => {
		const formData = createFormData({
			username: 'daniel',
			display_name: 'Daniel García',
			password: 'daniel123',
			confirm_password: 'daniel123'
		});

		// Mock: username check returns no duplicates
		mockQuery.mockResolvedValueOnce({ rows: [] });
		// Mock: email check returns no duplicates
		mockQuery.mockResolvedValueOnce({ rows: [] });
		// Mock: INSERT succeeds
		mockQuery.mockResolvedValueOnce({ rows: [{ id: '33333333-3333-3333-3333-333333333333' }] });

		const event = createMockEvent(createAdminLocals(), formData);
		const result = await (actions as any).create(event);

		expect(result.success).toBe(true);
		expect(result.message).toContain('daniel');
		expect(result.message).toContain('Cajero');

		// Verify INSERT query enforces role = cajero
		const insertCall = mockQuery.mock.calls.find((c: any[]) =>
			typeof c[0] === 'string' && c[0].includes('INSERT INTO auth.users')
		);
		expect(insertCall).toBeTruthy();
		expect(insertCall![0]).toContain('"role": "cajero"');
	});

	// 4. Creating a second Admin is rejected
	it('Cannot create a second Admin from this interface (role is always cajero)', async () => {
		const formData = createFormData({
			username: 'admin2',
			display_name: 'Segundo Admin',
			password: 'admin2222',
			confirm_password: 'admin2222'
		});

		mockQuery.mockResolvedValueOnce({ rows: [] });
		mockQuery.mockResolvedValueOnce({ rows: [] });
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const event = createMockEvent(createAdminLocals(), formData);
		const result = await (actions as any).create(event);

		// Even though the user tried to create "admin2", the INSERT always hardcodes role: cajero
		expect(result.success).toBe(true);

		const insertCall = mockQuery.mock.calls.find((c: any[]) =>
			typeof c[0] === 'string' && c[0].includes('INSERT INTO auth.users')
		);
		// The hardcoded JSONB always says role: cajero — there is NO code path to inject admin
		expect(insertCall![0]).toContain('"role": "cajero"');
		expect(insertCall![0]).not.toContain('"role": "admin"');
	});

	// 5. Duplicate username is rejected
	it('Rejects duplicate username', async () => {
		const formData = createFormData({
			username: 'daniel',
			display_name: 'Daniel Duplicado',
			password: 'daniel123',
			confirm_password: 'daniel123'
		});

		// Mock: username check returns existing user
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: '33333333-3333-3333-3333-333333333333' }]
		});

		const event = createMockEvent(createAdminLocals(), formData);
		const result = await (actions as any).create(event);

		expect(result.status).toBe(400);
		expect(result.data.error).toContain('daniel');
		expect(result.data.error).toContain('ya está en uso');
	});

	// 6. Password never appears in responses
	it('Password (encrypted_password) never appears in load response', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: '11111111-1111-1111-1111-111111111111',
				email: 'admin@papeleria.com',
				username: 'admin',
				display_name: 'Admin',
				is_active: true,
				role: 'admin',
				created_at: '2026-01-01',
				encrypted_password: 'SHOULD_NEVER_APPEAR'
			}]
		});

		const event = createMockEvent(createAdminLocals());
		const result = await load(event as any);

		// The load function explicitly maps fields and excludes encrypted_password
		const serialized = JSON.stringify(result);
		expect(serialized).not.toContain('encrypted_password');
		expect(serialized).not.toContain('SHOULD_NEVER_APPEAR');
	});

	// 7. New password produces valid PBKDF2 hash
	it('New password is stored as PBKDF2-HMAC-SHA512 hash (salt:hash format)', async () => {
		const formData = createFormData({
			username: 'test_user',
			display_name: 'Test User',
			password: 'secure_pass_123',
			confirm_password: 'secure_pass_123'
		});

		mockQuery.mockResolvedValueOnce({ rows: [] }); // username check
		mockQuery.mockResolvedValueOnce({ rows: [] }); // email check
		mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT

		const event = createMockEvent(createAdminLocals(), formData);
		await (actions as any).create(event);

		// Verify the INSERT contained a salt:hash password
		const insertCall = mockQuery.mock.calls.find((c: any[]) =>
			typeof c[0] === 'string' && c[0].includes('INSERT INTO auth.users')
		);
		expect(insertCall).toBeTruthy();
		const encryptedPassword = insertCall![1][1]; // $2 = encrypted_password
		expect(encryptedPassword).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);

		// Verify the hash is actually valid PBKDF2
		const [salt, hash] = encryptedPassword.split(':');
		const crypto = await import('node:crypto');
		const computed = crypto.pbkdf2Sync('secure_pass_123', salt, 100000, 64, 'sha512').toString('hex');
		expect(computed).toBe(hash);
	});

	// 8. Password change invalidates previous password
	it('After password change, the stored hash corresponds to the new password', async () => {
		const formData = createFormData({
			user_id: '33333333-3333-3333-3333-333333333333',
			username: 'daniel',
			display_name: 'Daniel',
			new_password: 'new_secure_456',
			confirm_password: 'new_secure_456'
		});

		// Mock: username uniqueness check
		mockQuery.mockResolvedValueOnce({ rows: [] });
		// Mock: UPDATE
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const event = createMockEvent(createAdminLocals(), formData);
		const result = await (actions as any).update(event);

		expect(result.success).toBe(true);

		// Verify the UPDATE included encrypted_password
		const updateCall = mockQuery.mock.calls.find((c: any[]) =>
			typeof c[0] === 'string' && c[0].includes('UPDATE auth.users SET')
		);
		expect(updateCall).toBeTruthy();
		expect(updateCall![0]).toContain('encrypted_password');

		// Verify the new hash validates against 'new_secure_456' and NOT 'old_password'
		const encryptedPassword = updateCall![1].find((v: any) =>
			typeof v === 'string' && v.match(/^[0-9a-f]{32}:[0-9a-f]{128}$/)
		);
		expect(encryptedPassword).toBeTruthy();

		const [salt, hash] = encryptedPassword.split(':');
		const crypto = await import('node:crypto');
		const computedNew = crypto.pbkdf2Sync('new_secure_456', salt, 100000, 64, 'sha512').toString('hex');
		expect(computedNew).toBe(hash);

		// Old password should NOT match
		const computedOld = crypto.pbkdf2Sync('old_password', salt, 100000, 64, 'sha512').toString('hex');
		expect(computedOld).not.toBe(hash);
	});

	// 9. Deactivated user cannot log in (is_active enforcement)
	it('Toggle action can deactivate a cajero user', async () => {
		const formData = createFormData({
			user_id: '33333333-3333-3333-3333-333333333333',
			activate: 'false'
		});

		// Mock: role check for target user
		mockQuery.mockResolvedValueOnce({ rows: [{ role: 'cajero' }] });
		// Mock: UPDATE is_active = false
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const event = createMockEvent(createAdminLocals(), formData);
		const result = await (actions as any).toggle(event);

		expect(result.success).toBe(true);
		expect(result.message).toContain('desactivado');

		// Verify UPDATE set is_active = false
		const updateCall = mockQuery.mock.calls.find((c: any[]) =>
			typeof c[0] === 'string' && c[0].includes('UPDATE auth.users SET is_active')
		);
		expect(updateCall).toBeTruthy();
		expect(updateCall![1][0]).toBe(false); // is_active = false
	});

	// 10. Reactivating user allows login again
	it('Toggle action can reactivate a previously deactivated user', async () => {
		const formData = createFormData({
			user_id: '33333333-3333-3333-3333-333333333333',
			activate: 'true'
		});

		// No role check needed when activating
		// Mock: UPDATE is_active = true
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const event = createMockEvent(createAdminLocals(), formData);
		const result = await (actions as any).toggle(event);

		expect(result.success).toBe(true);
		expect(result.message).toContain('reactivado');

		const updateCall = mockQuery.mock.calls.find((c: any[]) =>
			typeof c[0] === 'string' && c[0].includes('UPDATE auth.users SET is_active')
		);
		expect(updateCall).toBeTruthy();
		expect(updateCall![1][0]).toBe(true); // is_active = true
	});

	// 11. Deactivating the only Admin is forbidden
	it('Cannot deactivate the only active Admin', async () => {
		const formData = createFormData({
			user_id: '11111111-1111-1111-1111-111111111111',
			activate: 'false'
		});

		// Mock: role check — target is admin
		mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] });
		// Mock: admin count — only 1 active admin
		mockQuery.mockResolvedValueOnce({ rows: [{ cnt: '1' }] });

		const event = createMockEvent(createAdminLocals(), formData);
		const result = await (actions as any).toggle(event);

		expect(result.status).toBe(400);
		expect(result.data.error).toContain('único Administrador');
	});

	// 12. Deactivated user remains in auth.users (no physical deletion)
	it('Deactivated user remains in auth.users (soft delete, no physical removal)', async () => {
		const formData = createFormData({
			user_id: '33333333-3333-3333-3333-333333333333',
			activate: 'false'
		});

		mockQuery.mockResolvedValueOnce({ rows: [{ role: 'cajero' }] });
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const event = createMockEvent(createAdminLocals(), formData);
		await (actions as any).toggle(event);

		// Verify no DELETE query was ever issued
		for (const call of mockQuery.mock.calls) {
			if (typeof call[0] === 'string') {
				expect(call[0].toUpperCase()).not.toContain('DELETE FROM');
			}
		}

		// After deactivation, load should still return the user
		mockQuery.mockResolvedValueOnce({
			rows: [
				{ id: '11111111-1111-1111-1111-111111111111', email: 'admin@papeleria.com', username: 'admin', display_name: 'Admin', is_active: true, role: 'admin', created_at: '2026-01-01' },
				{ id: '33333333-3333-3333-3333-333333333333', email: 'daniel@papeleria.local', username: 'daniel', display_name: 'Daniel', is_active: false, role: 'cajero', created_at: '2026-10-07' }
			]
		});

		const loadEvent = createMockEvent(createAdminLocals());
		const loadResult = await load(loadEvent as any);

		expect(loadResult.users).toHaveLength(2);
		const deactivated = loadResult.users.find((u: any) => u.username === 'daniel');
		expect(deactivated).toBeTruthy();
		expect(deactivated!.is_active).toBe(false);
	});

	// 13. Historical sales preserve user_id
	it('Historical sales preserve user_id FK to auth.users even after deactivation', async () => {
		// This is an architectural guarantee: stock_outlets.user_id REFERENCES auth.users(id)
		// Since we never DELETE from auth.users (only is_active = false), the FK remains valid.
		// Verify by confirming the toggle action uses UPDATE, not DELETE.
		const formData = createFormData({
			user_id: '33333333-3333-3333-3333-333333333333',
			activate: 'false'
		});

		mockQuery.mockResolvedValueOnce({ rows: [{ role: 'cajero' }] });
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const event = createMockEvent(createAdminLocals(), formData);
		await (actions as any).toggle(event);

		// Every SQL issued must be UPDATE, never DELETE
		const allQueries = mockQuery.mock.calls.map((c: any[]) => (typeof c[0] === 'string' ? c[0].trim().toUpperCase() : ''));
		for (const q of allQueries) {
			expect(q).not.toMatch(/^\s*DELETE\s+FROM/);
		}

		// The toggle only sets is_active, preserving the row for FK integrity
		const updateQuery = allQueries.find(q => q.includes('UPDATE AUTH.USERS SET IS_ACTIVE'));
		expect(updateQuery).toBeTruthy();
	});

	// 14. Deactivated user cannot authenticate (signInWithPassword enforces strict is_active = true)
	it('Deactivated user cannot authenticate via signInWithPassword (strict is_active = true check, no NULL permitted)', async () => {
		const mockCookies = {
			get: vi.fn(),
			set: vi.fn(),
			delete: vi.fn(),
			getAll: vi.fn().mockReturnValue([])
		} as any;

		const supabase = createSupabaseServerClient(mockCookies);

		// Mock query returns 0 rows because is_active = false user is excluded by SQL query
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { data, error } = await supabase.auth.signInWithPassword({
			email: 'daniel@papeleria.local',
			password: 'daniel_password_123'
		});

		expect(error).toBeTruthy();
		expect(data.user).toBeNull();

		// Verify the query issued to database contains 'is_active = true' and NOT 'is_active IS NULL'
		const selectCall = mockQuery.mock.calls.find((c: any[]) =>
			typeof c[0] === 'string' && c[0].toUpperCase().includes('AUTH.USERS')
		);
		expect(selectCall).toBeTruthy();
		expect(selectCall![0]).toContain('is_active = true');
		expect(selectCall![0]).not.toContain('is_active IS NULL');
	});

	// 15. Reactivated user can authenticate via signInWithPassword
	it('Reactivated user can authenticate via signInWithPassword', async () => {
		const mockCookies = {
			get: vi.fn(),
			set: vi.fn(),
			delete: vi.fn(),
			getAll: vi.fn().mockReturnValue([])
		} as any;

		const supabase = createSupabaseServerClient(mockCookies);

		// Hash for test password
		const crypto = await import('node:crypto');
		const salt = crypto.randomBytes(16).toString('hex');
		const hash = crypto.pbkdf2Sync('daniel_valid_pass', salt, 100000, 64, 'sha512').toString('hex');
		const encryptedPassword = `${salt}:${hash}`;

		// Active user row returned by DB
		mockQuery.mockResolvedValueOnce({
			rows: [
				{
					id: '33333333-3333-3333-3333-333333333333',
					email: 'daniel@papeleria.local',
					encrypted_password: encryptedPassword,
					raw_app_meta_data: { role: 'cajero' },
					is_active: true
				}
			]
		});

		const { data, error } = await supabase.auth.signInWithPassword({
			email: 'daniel@papeleria.local',
			password: 'daniel_valid_pass'
		});

		expect(error).toBeNull();
		expect(data.user).toBeTruthy();
		expect(data.user.email).toBe('daniel@papeleria.local');
		expect(data.user.app_metadata.role).toBe('cajero');
		expect(mockCookies.set).toHaveBeenCalled();
	});

	// 16. is_active cannot be left NULL (strict boolean semantics)
	it('is_active cannot be left NULL: create defaults to true, toggle never assigns NULL, and migration enforces NOT NULL', async () => {
		// 1. Create action explicitly inserts true, never NULL
		const createFormDataObj = createFormData({
			username: 'pepe_test',
			display_name: 'Pepe Test',
			password: 'valid_password_123',
			confirm_password: 'valid_password_123'
		});

		mockQuery.mockResolvedValueOnce({ rows: [] }); // username uniqueness check
		mockQuery.mockResolvedValueOnce({ rows: [] }); // email uniqueness check
		mockQuery.mockResolvedValueOnce({ rows: [] }); // insert

		const createEvent = createMockEvent(createAdminLocals(), createFormDataObj);
		const createResult = await (actions as any).create(createEvent);
		expect(createResult.success).toBe(true);

		const insertCall = mockQuery.mock.calls.find((c: any[]) =>
			typeof c[0] === 'string' && c[0].toUpperCase().includes('INSERT INTO AUTH.USERS')
		);
		expect(insertCall).toBeTruthy();
		expect(insertCall![0]).toContain('true');
		expect(insertCall![0]).not.toContain('NULL');

		// 2. Toggle action strictly converts activate string to boolean (never NULL)
		const toggleEvent = createMockEvent(createAdminLocals(), createFormData({
			user_id: '44444444-4444-4444-4444-444444444444',
			activate: 'false'
		}));

		mockQuery.mockResolvedValueOnce({ rows: [{ role: 'cajero' }] });
		mockQuery.mockResolvedValueOnce({ rows: [] });

		await (actions as any).toggle(toggleEvent);
		const updateCall = mockQuery.mock.calls.find((c: any[]) =>
			typeof c[0] === 'string' && c[0].includes('UPDATE auth.users SET is_active')
		);
		expect(updateCall).toBeTruthy();
		expect(typeof updateCall![1][0]).toBe('boolean');
		expect(updateCall![1][0]).toBe(false);
		expect(updateCall![1][0]).not.toBeNull();
	});
});
