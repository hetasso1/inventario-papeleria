import type { PageServerLoad } from './$types';
/**
 * Resolves human identity (display_name, username) from auth.users server-side
 * using the existing locals.supabase client context.
 * Does NOT filter by is_active so historical / deactivated users remain resolvable.
 */
async function resolveUsersMap(locals: any): Promise<{ userMap: Map<string, { display_name: string; username: string }>; error: any }> {
	if (locals?.__mockUsersMap) {
		return { userMap: locals.__mockUsersMap, error: null };
	}
	const userMap = new Map<string, { display_name: string; username: string }>();
	if (!locals?.supabase) {
		return { userMap, error: null };
	}
	const res = await locals.supabase
		.from('auth"."users')
		.select('id, display_name, username');

	if (!res || res.error) {
		if (res?.error) {
			console.error('[Admin Auditoria Users Resolution Error]', res.error);
			return { userMap, error: res.error };
		}
		return { userMap, error: null };
	}

	for (const row of res.data ?? []) {
		userMap.set(row.id, {
			display_name: row.display_name || row.username || '',
			username: row.username || ''
		});
	}

	return { userMap, error: null };
}

export interface AuditLogRow {
	id: string;
	product_id: string;
	product_name: string;
	sku_code: string;
	change_type: 'VENTA' | 'DEVOLUCION' | 'REABASTECIMIENTO' | 'AJUSTE_MANUAL' | 'MERMA';
	previous_stock: number;
	new_stock: number;
	quantity_changed: number;
	reference_id: string | null;
	created_by: string | null;
	user_display_name?: string | null;
	user_username?: string | null;
	notes: string | null;
	created_at: string;
}

/**
 * Server-side load for /admin/auditoria (Stock Audit Log).
 *
 * Route protection for /admin/* is delegated to src/hooks.server.ts.
 * Queries inventory_logs with product details using locals.supabase.
 * Resolves human identity via auth.users without parallel tables.
 * Converts database errors into a safe generic message without leaking internals.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const { data, error } = await locals.supabase
		.from('inventory_logs')
		.select(`
			id,
			product_id,
			change_type,
			previous_stock,
			new_stock,
			quantity_changed,
			reference_id,
			created_by,
			notes,
			created_at,
			products (
				name,
				sku_code
			)
		`)
		.order('created_at', { ascending: false });

	if (error) {
		console.error('[Admin Auditoria Load Error]', error);
		return {
			logs: [] as AuditLogRow[],
			error: 'No fue posible cargar el registro de auditoría.'
		};
	}

	const { userMap, error: usersErr } = await resolveUsersMap(locals);
	if (usersErr) {
		console.error('[Admin Auditoria Load Error]', usersErr);
		return {
			logs: [] as AuditLogRow[],
			error: 'No fue posible cargar el registro de auditoría.'
		};
	}

	const logs: AuditLogRow[] = (data ?? []).map((row: any) => {
		const user = row.created_by ? userMap.get(row.created_by) : undefined;
		return {
			id: row.id,
			product_id: row.product_id,
			product_name: row.products?.name ?? 'Producto no especificado',
			sku_code: row.products?.sku_code ?? 'N/A',
			change_type: row.change_type,
			previous_stock: Number(row.previous_stock),
			new_stock: Number(row.new_stock),
			quantity_changed: Number(row.quantity_changed),
			reference_id: row.reference_id ?? null,
			created_by: row.created_by ?? null,
			user_display_name: user?.display_name ?? null,
			user_username: user?.username ?? null,
			notes: row.notes ?? null,
			created_at: row.created_at
		};
	});

	return {
		logs,
		error: null
	};
};
