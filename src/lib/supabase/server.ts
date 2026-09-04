import pg from 'pg';
import crypto from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/inventario_dev';
const SESSION_SECRET = process.env.SESSION_SECRET || 'local_insecure_dev_secret_key_inventario_papeleria_2026';
const COOKIE_NAME = 'app_session';

// Shared PostgreSQL connection pool
const pool = new pg.Pool({
	connectionString: DATABASE_URL,
	max: 10,
	idleTimeoutMillis: 30000
});

export interface UserSession {
	id: string;
	email: string;
	app_metadata: {
		role: 'admin' | 'cajero';
	};
}

/**
 * Sign session payload using HMAC-SHA256
 */
function signSession(user: UserSession): string {
	const payload = JSON.stringify({
		...user,
		exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
	});
	const b64Payload = Buffer.from(payload, 'utf-8').toString('base64url');
	const signature = crypto.createHmac('sha256', SESSION_SECRET).update(b64Payload).digest('base64url');
	return `${b64Payload}.${signature}`;
}

/**
 * Verify signed session payload
 */
function verifySession(token: string): UserSession | null {
	try {
		const [b64Payload, signature] = token.split('.');
		if (!b64Payload || !signature) return null;

		const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(b64Payload).digest('base64url');
		if (signature !== expectedSig) return null;

		const json = Buffer.from(b64Payload, 'base64url').toString('utf-8');
		const data = JSON.parse(json);
		if (data.exp && data.exp < Date.now()) return null;

		return {
			id: data.id,
			email: data.email,
			app_metadata: data.app_metadata
		};
	} catch {
		return null;
	}
}

/**
 * Verify password against stored PBKDF2 hash or default local test users
 */
function verifyPasswordHash(password: string, storedHash: string): boolean {
	try {
		const [salt, hash] = storedHash.split(':');
		if (!salt || !hash) return false;
		const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
		return computed === hash;
	} catch {
		return false;
	}
}

/**
 * Executes a function within a dedicated PostgreSQL connection with RLS context
 */
async function withContext<T>(
	user: UserSession | null,
	fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		if (user) {
			await client.query('SET LOCAL ROLE authenticated');
			const claims = JSON.stringify({
				sub: user.id,
				role: 'authenticated',
				app_metadata: user.app_metadata
			});
			await client.query(`SET LOCAL "request.jwt.claims" = '${claims}'`);
		} else {
			await client.query('SET LOCAL ROLE anon');
			await client.query('SET LOCAL "request.jwt.claims" = \'{"role": "anon"}\'');
		}
		const result = await fn(client);
		await client.query('COMMIT');
		return result;
	} catch (err) {
		try {
			await client.query('ROLLBACK');
		} catch {
			// ignore rollback error
		}
		throw err;
	} finally {
		client.release();
	}
}

/**
 * Query Builder compatible with Supabase PostgREST API for local PostgreSQL
 */
class LocalQueryBuilder {
	private table: string;
	private user: UserSession | null;
	private selectCols: string = '*';
	private filters: Array<{ col: string; op: string; val: any }> = [];
	private orderCol: string | null = null;
	private orderAsc: boolean = true;
	private limitVal: number | null = null;
	private isSingle: boolean = false;
	private updateData: Record<string, any> | null = null;
	private insertData: any = null;

	constructor(table: string, user: UserSession | null) {
		this.table = table;
		this.user = user;
	}

	select(cols: string = '*') {
		this.selectCols = cols;
		return this;
	}

	eq(col: string, val: any) {
		this.filters.push({ col, op: '=', val });
		return this;
	}

	neq(col: string, val: any) {
		this.filters.push({ col, op: '!=', val });
		return this;
	}

	in(col: string, values: any[]) {
		this.filters.push({ col, op: 'IN', val: values });
		return this;
	}

	order(col: string, opts?: { ascending?: boolean }) {
		this.orderCol = col;
		this.orderAsc = opts?.ascending !== false;
		return this;
	}

	limit(num: number) {
		this.limitVal = num;
		return this;
	}

	single() {
		this.isSingle = true;
		this.limitVal = 1;
		return this;
	}

	update(data: Record<string, any>) {
		this.updateData = data;
		return this;
	}

	insert(data: any) {
		this.insertData = Array.isArray(data) ? data : [data];
		return this;
	}

	// Make builder then-able to await directly like Supabase
	then(resolve: (value: { data: any; error: any }) => void, reject?: (reason: any) => void) {
		this.execute().then(resolve, reject);
	}

	private async execute(): Promise<{ data: any; error: any }> {
		try {
			const res = await withContext(this.user, async (client) => {
				// 1. UPDATE
				if (this.updateData) {
					const sets: string[] = [];
					const values: any[] = [];
					let pIdx = 1;

					for (const [key, val] of Object.entries(this.updateData)) {
						sets.push(`"${key}" = $${pIdx++}`);
						values.push(val);
					}

					let where = '';
					if (this.filters.length > 0) {
						const clauses = this.filters.map((f) => {
							values.push(f.val);
							return `"${f.col}" ${f.op} $${pIdx++}`;
						});
						where = `WHERE ${clauses.join(' AND ')}`;
					}

					const sql = `UPDATE "${this.table}" SET ${sets.join(', ')} ${where} RETURNING *`;
					const r = await client.query(sql, values);
					return r.rows;
				}

				// 2. INSERT
				if (this.insertData) {
					if (this.insertData.length === 0) return [];
					const keys = Object.keys(this.insertData[0]);
					const cols = keys.map((k) => `"${k}"`).join(', ');
					const values: any[] = [];
					const rowParams: string[] = [];
					let pIdx = 1;

					for (const row of this.insertData) {
						const ps = keys.map((k) => {
							values.push(row[k]);
							return `$${pIdx++}`;
						});
						rowParams.push(`(${ps.join(', ')})`);
					}

					const sql = `INSERT INTO "${this.table}" (${cols}) VALUES ${rowParams.join(', ')} RETURNING *`;
					const r = await client.query(sql, values);
					return r.rows;
				}

				// 3. SELECT - Special aggregations for inventory_logs and stock_outlets
				let sql = '';
				const values: any[] = [];
				let pIdx = 1;

				if (this.table === 'inventory_logs' && this.selectCols.includes('products')) {
					sql = `
						SELECT l.id, l.product_id, l.change_type, l.previous_stock, l.new_stock,
						       l.quantity_changed, l.reference_id, l.created_by, l.notes, l.created_at,
						       json_build_object('id', p.id, 'name', p.name, 'sku_code', p.sku_code, 'price', p.price) as products
						FROM inventory_logs l
						LEFT JOIN products p ON l.product_id = p.id
					`;
				} else if (this.table === 'stock_outlets' && this.selectCols.includes('stock_outlet_items')) {
					sql = `
						SELECT o.id, o.folio, o.user_id, o.total_amount, o.idempotency_key,
						       o.is_canceled, o.canceled_at, o.canceled_by, o.cancel_reason, o.created_at,
						       COALESCE((
						         SELECT json_agg(json_build_object(
						           'id', i.id,
						           'product_id', i.product_id,
						           'quantity', i.quantity,
						           'unit_price', i.unit_price,
						           'subtotal', i.subtotal,
						           'products', json_build_object('id', p.id, 'name', p.name, 'sku_code', p.sku_code)
						         ))
						         FROM stock_outlet_items i
						         LEFT JOIN products p ON i.product_id = p.id
						         WHERE i.outlet_id = o.id
						       ), '[]'::json) as stock_outlet_items
						FROM stock_outlets o
					`;
				} else {
					const cleanCols = this.selectCols.split(',').map((c) => {
						const trimmed = c.trim();
						return trimmed === '*' ? '*' : `"${trimmed}"`;
					}).join(', ');
					sql = `SELECT ${cleanCols} FROM "${this.table}"`;
				}

				// WHERE filters
				if (this.filters.length > 0) {
					const clauses = this.filters.map((f) => {
						if (f.op === 'IN') {
							values.push(f.val);
							return `"${f.col}" = ANY($${pIdx++})`;
						}
						values.push(f.val);
						return `"${f.col}" ${f.op} $${pIdx++}`;
					});
					const whereKeyword = sql.includes('WHERE') ? 'AND' : 'WHERE';
					sql += ` ${whereKeyword} ${clauses.join(' AND ')}`;
				}

				// ORDER BY
				if (this.orderCol) {
					const dir = this.orderAsc ? 'ASC' : 'DESC';
					sql += ` ORDER BY "${this.orderCol}" ${dir}`;
				}

				// LIMIT
				if (this.limitVal) {
					values.push(this.limitVal);
					sql += ` LIMIT $${pIdx++}`;
				}

				const r = await client.query(sql, values);
				return this.isSingle ? (r.rows[0] ?? null) : r.rows;
			});

			return { data: res, error: null };
		} catch (err: any) {
			console.error(`[LocalQueryBuilder Error (${this.table})]`, err.message);
			return { data: null, error: { message: err.message } };
		}
	}
}

/**
 * Creates a local PostgreSQL client that emulates the Supabase interface
 * with authentic RLS session binding and local auth.
 */
export function createSupabaseServerClient(cookies: Cookies) {
	// 1. Read current session from HTTP-only cookie
	const token = cookies.get(COOKIE_NAME);
	let currentUser: UserSession | null = token ? verifySession(token) : null;

	return {
		auth: {
			async signInWithPassword({ email, password }: { email: string; password?: string }) {
				const trimmedEmail = email.trim().toLowerCase();
				try {
					const client = await pool.connect();
					let userRow: any = null;
					try {
						const res = await client.query(
							'SELECT id, email, encrypted_password, raw_app_meta_data FROM auth.users WHERE LOWER(email) = $1',
							[trimmedEmail]
						);
						userRow = res.rows[0];
					} finally {
						client.release();
					}

					let isValid = false;
					if (userRow && userRow.encrypted_password) {
						isValid = verifyPasswordHash(password || '', userRow.encrypted_password);
					}

					// Fallback for standard test accounts if not yet hashed in db
					if (!isValid) {
						if (trimmedEmail.includes('admin') && password === (process.env.TEST_ADMIN_PASSWORD || 'admin777')) {
							userRow = {
								id: '11111111-1111-1111-1111-111111111111',
								email: trimmedEmail,
								raw_app_meta_data: { role: 'admin' }
							};
							isValid = true;
						} else if (trimmedEmail.includes('cajero') && password === (process.env.TEST_CAJERO_PASSWORD || 'cajero111')) {
							userRow = {
								id: '22222222-2222-2222-2222-222222222222',
								email: trimmedEmail,
								raw_app_meta_data: { role: 'cajero' }
							};
							isValid = true;
						}
					}

					if (!isValid || !userRow) {
						return {
							data: { user: null, session: null },
							error: { message: 'Credenciales inválidas. Verifique su correo y contraseña.' }
						};
					}

					const rawRole = userRow.raw_app_meta_data?.role;
					const role: 'admin' | 'cajero' = rawRole === 'admin' || trimmedEmail.includes('admin') ? 'admin' : 'cajero';
					const user: UserSession = {
						id: userRow.id,
						email: userRow.email,
						app_metadata: { role }
					};

					const sessionToken = signSession(user);
					cookies.set(COOKIE_NAME, sessionToken, {
						path: '/',
						httpOnly: true,
						sameSite: 'lax',
						secure: false, // local development
						maxAge: 7 * 24 * 60 * 60
					});

					currentUser = user;
					return {
						data: {
							user: {
								id: user.id,
								email: user.email,
								app_metadata: user.app_metadata
							},
							session: { access_token: sessionToken }
						},
						error: null
					};
				} catch (err: any) {
					console.error('[signInWithPassword Error]', err.message);
					return {
						data: { user: null, session: null },
						error: { message: 'Error interno en servicio de autenticación local.' }
					};
				}
			},

			async getUser() {
				if (!currentUser) {
					const t = cookies.get(COOKIE_NAME);
					if (t) {
						currentUser = verifySession(t);
					}
				}

				if (currentUser) {
					return {
						data: {
							user: {
								id: currentUser.id,
								email: currentUser.email,
								app_metadata: currentUser.app_metadata
							}
						},
						error: null
					};
				}

				return { data: { user: null }, error: null };
			},

			async signOut() {
				cookies.delete(COOKIE_NAME, { path: '/' });
				currentUser = null;
				return { error: null };
			}
		},

		from(table: string) {
			return new LocalQueryBuilder(table, currentUser);
		},

		async rpc(name: string, args: Record<string, any> = {}) {
			try {
				const res = await withContext(currentUser, async (client) => {
					if (name === 'upsert_product_with_cost') {
						const sql = `
							SELECT upsert_product_with_cost(
								$1::uuid, $2::varchar, $3::varchar, $4::text,
								$5::numeric, $6::numeric, $7::numeric, $8::numeric, $9::text
							) as result;
						`;
						const params = [
							args.p_id ?? null,
							args.p_sku_code,
							args.p_name,
							args.p_description ?? null,
							args.p_price,
							args.p_cost,
							args.p_stock ?? 0,
							args.p_min_stock ?? 5,
							args.p_image_url ?? null
						];
						const r = await client.query(sql, params);
						return r.rows[0]?.result;
					}

					if (name === 'process_stock_outlet') {
						const sql = `
							SELECT process_stock_outlet(
								$1::jsonb,
								$2::uuid
							) as result;
						`;
						const itemsJson = typeof args.p_items === 'string' ? args.p_items : JSON.stringify(args.p_items);
						const r = await client.query(sql, [itemsJson, args.p_idempotency_key]);
						return r.rows[0]?.result;
					}

					if (name === 'cancel_stock_outlet') {
						const sql = `
							SELECT cancel_stock_outlet(
								$1::uuid,
								$2::text
							) as result;
						`;
						const r = await client.query(sql, [args.p_outlet_id, args.p_reason]);
						return r.rows[0]?.result;
					}

					throw new Error(`RPC '${name}' no implementada en adaptador local.`);
				});

				return { data: res, error: null };
			} catch (err: any) {
				console.error(`[RPC Error (${name})]`, err.message);
				return { data: null, error: { message: err.message } };
			}
		}
	};
}
