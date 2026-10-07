import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import crypto from 'node:crypto';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/inventario_dev';

/**
 * Direct pool for admin user-management queries that operate on auth.users
 * without RLS context (admin-only, verified server-side).
 */
const pool = new pg.Pool({
	connectionString: DATABASE_URL,
	max: 3,
	idleTimeoutMillis: 30000
});

/**
 * Hash a password using PBKDF2-HMAC-SHA512 with the same format as server.ts:
 * salt:hash (16-byte random salt, 100000 iterations, 64-byte key)
 */
function hashPassword(password: string): string {
	const salt = crypto.randomBytes(16).toString('hex');
	const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
	return `${salt}:${hash}`;
}

/**
 * Server-side Load for /admin/usuarios
 * Lists all users from auth.users with role, username, display_name, is_active.
 * NEVER returns encrypted_password.
 */
export const load: PageServerLoad = async ({ locals }) => {
	// RBAC: Require authenticated admin (defense-in-depth; hooks.server.ts also guards /admin/*)
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	if (locals.role !== 'admin') {
		throw redirect(303, '/caja');
	}

	try {
		const client = await pool.connect();
		try {
			const result = await client.query(
				`SELECT id, email, username, display_name, is_active,
				        raw_app_meta_data->>'role' as role,
				        created_at
				 FROM auth.users
				 ORDER BY created_at ASC`
			);

			return {
				users: result.rows.map((u: any) => ({
					id: u.id,
					email: u.email,
					username: u.username || '',
					display_name: u.display_name || '',
					role: u.role || 'cajero',
					is_active: u.is_active !== false,
					created_at: u.created_at
				}))
			};
		} finally {
			client.release();
		}
	} catch (err: any) {
		console.error('[UserManagement Load Error]', err.message);
		return {
			users: [],
			error: 'Error al cargar usuarios.'
		};
	}
};

export const actions: Actions = {
	/**
	 * Action: create — Create a new Cajero user
	 * Role is ALWAYS fixed to 'cajero'. A second admin cannot be created from this interface.
	 */
	create: async ({ request, locals }) => {
		// RBAC server-side guard
		if (!locals.user || locals.role !== 'admin') {
			return fail(403, { error: 'Acceso denegado. Solo administradores pueden gestionar usuarios.' });
		}

		const formData = await request.formData();
		const username = (formData.get('username') as string)?.trim();
		const displayName = (formData.get('display_name') as string)?.trim();
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirm_password') as string;

		// Validation
		if (!username || username.length < 3) {
			return fail(400, { error: 'El nombre de usuario es obligatorio (mínimo 3 caracteres).' });
		}
		if (!displayName || displayName.length < 2) {
			return fail(400, { error: 'El nombre para mostrar es obligatorio (mínimo 2 caracteres).' });
		}
		if (!password || password.length < 6) {
			return fail(400, { error: 'La contraseña es obligatoria (mínimo 6 caracteres).' });
		}
		if (password !== confirmPassword) {
			return fail(400, { error: 'Las contraseñas no coinciden.' });
		}

		// Sanitize username: only alphanumeric, underscores, hyphens
		if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
			return fail(400, { error: 'El nombre de usuario solo puede contener letras, números, guiones y guiones bajos.' });
		}

		const client = await pool.connect();
		try {
			// Check unique username
			const existing = await client.query(
				'SELECT id FROM auth.users WHERE LOWER(username) = LOWER($1)',
				[username]
			);
			if (existing.rows.length > 0) {
				return fail(400, { error: `El nombre de usuario "${username}" ya está en uso.` });
			}

			// Generate email from username (for compatibility with existing email-based login)
			const email = `${username.toLowerCase()}@papeleria.local`;

			// Check email uniqueness too
			const existingEmail = await client.query(
				'SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1)',
				[email]
			);
			if (existingEmail.rows.length > 0) {
				return fail(400, { error: `Ya existe un usuario con el correo "${email}".` });
			}

			// Hash password with PBKDF2-HMAC-SHA512 (same mechanism as server.ts)
			const encryptedPassword = hashPassword(password);

			// Insert new user — the trigger handle_first_user_admin will set the role,
			// but since users already exist, it will always assign 'cajero'.
			// We also explicitly set raw_app_meta_data to enforce cajero role.
			await client.query(
				`INSERT INTO auth.users (id, email, encrypted_password, username, display_name, is_active, raw_app_meta_data)
				 VALUES (gen_random_uuid(), $1, $2, $3, $4, true, '{"role": "cajero"}'::jsonb)`,
				[email, encryptedPassword, username, displayName]
			);

			return { success: true, message: `Usuario "${username}" creado exitosamente como Cajero.` };
		} catch (err: any) {
			console.error('[UserManagement Create Error]', err.message);
			if (err.message?.includes('users_username_unique')) {
				return fail(400, { error: `El nombre de usuario "${username}" ya está en uso.` });
			}
			return fail(500, { error: 'Error interno al crear el usuario.' });
		} finally {
			client.release();
		}
	},

	/**
	 * Action: update — Update username, display_name, and/or password of an existing user
	 * NEVER returns or exposes encrypted_password.
	 */
	update: async ({ request, locals }) => {
		if (!locals.user || locals.role !== 'admin') {
			return fail(403, { error: 'Acceso denegado.' });
		}

		const formData = await request.formData();
		const userId = (formData.get('user_id') as string)?.trim();
		const username = (formData.get('username') as string)?.trim();
		const displayName = (formData.get('display_name') as string)?.trim();
		const newPassword = formData.get('new_password') as string;
		const confirmPassword = formData.get('confirm_password') as string;

		if (!userId) {
			return fail(400, { error: 'ID de usuario requerido.' });
		}

		if (!username || username.length < 3) {
			return fail(400, { error: 'El nombre de usuario es obligatorio (mínimo 3 caracteres).' });
		}
		if (!displayName || displayName.length < 2) {
			return fail(400, { error: 'El nombre para mostrar es obligatorio (mínimo 2 caracteres).' });
		}
		if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
			return fail(400, { error: 'El nombre de usuario solo puede contener letras, números, guiones y guiones bajos.' });
		}

		// If password is being changed, validate
		if (newPassword) {
			if (newPassword.length < 6) {
				return fail(400, { error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
			}
			if (newPassword !== confirmPassword) {
				return fail(400, { error: 'Las contraseñas no coinciden.' });
			}
		}

		const client = await pool.connect();
		try {
			// Check username uniqueness (excluding current user)
			const existing = await client.query(
				'SELECT id FROM auth.users WHERE LOWER(username) = LOWER($1) AND id != $2',
				[username, userId]
			);
			if (existing.rows.length > 0) {
				return fail(400, { error: `El nombre de usuario "${username}" ya está en uso por otro usuario.` });
			}

			// Build update query
			const updates: string[] = ['username = $1', 'display_name = $2'];
			const values: any[] = [username, displayName];
			let paramIdx = 3;

			// Also update email to keep it in sync with username
			const email = `${username.toLowerCase()}@papeleria.local`;
			updates.push(`email = $${paramIdx}`);
			values.push(email);
			paramIdx++;

			if (newPassword) {
				const encryptedPassword = hashPassword(newPassword);
				updates.push(`encrypted_password = $${paramIdx}`);
				values.push(encryptedPassword);
				paramIdx++;
			}

			values.push(userId);
			await client.query(
				`UPDATE auth.users SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
				values
			);

			return { success: true, message: `Usuario "${username}" actualizado exitosamente.` };
		} catch (err: any) {
			console.error('[UserManagement Update Error]', err.message);
			return fail(500, { error: 'Error interno al actualizar el usuario.' });
		} finally {
			client.release();
		}
	},

	/**
	 * Action: toggle — Activate or deactivate a user (soft-delete)
	 * Cannot deactivate the only admin.
	 * Does NOT physically delete from auth.users (stock_outlets.user_id FK preserved).
	 */
	toggle: async ({ request, locals }) => {
		if (!locals.user || locals.role !== 'admin') {
			return fail(403, { error: 'Acceso denegado.' });
		}

		const formData = await request.formData();
		const userId = (formData.get('user_id') as string)?.trim();
		const activate = formData.get('activate') === 'true';

		if (!userId) {
			return fail(400, { error: 'ID de usuario requerido.' });
		}

		const client = await pool.connect();
		try {
			// If deactivating, check if this is an admin
			if (!activate) {
				const userResult = await client.query(
					`SELECT raw_app_meta_data->>'role' as role FROM auth.users WHERE id = $1`,
					[userId]
				);
				const targetRole = userResult.rows[0]?.role;

				if (targetRole === 'admin') {
					// Count active admins — cannot deactivate the only admin
					const adminCount = await client.query(
						`SELECT COUNT(*) as cnt FROM auth.users
						 WHERE raw_app_meta_data->>'role' = 'admin' AND is_active = true`
					);
					const activeAdmins = parseInt(adminCount.rows[0]?.cnt || '0', 10);
					if (activeAdmins <= 1) {
						return fail(400, { error: 'No se puede desactivar al único Administrador activo.' });
					}
				}
			}

			await client.query(
				'UPDATE auth.users SET is_active = $1 WHERE id = $2',
				[activate, userId]
			);

			return {
				success: true,
				message: activate
					? 'Usuario reactivado exitosamente.'
					: 'Usuario desactivado exitosamente.'
			};
		} catch (err: any) {
			console.error('[UserManagement Toggle Error]', err.message);
			return fail(500, { error: 'Error interno al cambiar el estado del usuario.' });
		} finally {
			client.release();
		}
	}
};
