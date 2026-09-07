import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * Server-side load and actions for /admin/historial (Sales History & Return/Cancellation Management).
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	// Guard: Ensure user is authenticated and is admin
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	if (locals.role !== 'admin') {
		throw redirect(303, '/caja');
	}

	const fechaParam = url.searchParams.get('fecha')?.trim() || '';
	const desdeParam = url.searchParams.get('desde')?.trim() || '';
	const hastaParam = url.searchParams.get('hasta')?.trim() || '';
	const hoyParam = url.searchParams.get('hoy')?.trim() === 'true';

	let startDate: string | null = null;
	let endDate: string | null = null;

	if (hoyParam) {
		const today = new Date().toISOString().slice(0, 10);
		startDate = `${today}T00:00:00.000Z`;
		endDate = `${today}T23:59:59.999Z`;
	} else if (fechaParam) {
		startDate = `${fechaParam}T00:00:00.000Z`;
		endDate = `${fechaParam}T23:59:59.999Z`;
	} else {
		if (desdeParam) {
			startDate = `${desdeParam}T00:00:00.000Z`;
		}
		if (hastaParam) {
			endDate = `${hastaParam}T23:59:59.999Z`;
		}
	}

	// Fetch sales outlets with associated items and product names (NO costs queried)
	let query = locals.supabase
		.from('stock_outlets')
		.select(`
			id,
			folio,
			user_id,
			total_amount,
			is_canceled,
			canceled_at,
			canceled_by,
			cancel_reason,
			idempotency_key,
			created_at,
			stock_outlet_items (
				id,
				product_id,
				quantity,
				unit_price,
				subtotal,
				products (
					id,
					name,
					sku_code
				)
			)
		`);

	if (startDate) {
		query = query.gte('created_at', startDate);
	}
	if (endDate) {
		query = query.lte('created_at', endDate);
	}

	query = query.order('created_at', { ascending: false });

	const { data: outlets, error } = await query;

	if (error) {
		return {
			outlets: [],
			metrics: {
				validSalesCount: 0,
				canceledSalesCount: 0,
				totalRevenue: 0
			},
			filters: {
				fecha: fechaParam,
				desde: desdeParam,
				hasta: hastaParam,
				hoy: hoyParam
			},
			error: 'Error al cargar el historial de ventas.'
		};
	}

	// If any outlet is missing items (e.g. if stock_outlet_items RLS policy is not yet applied),
	// recover the sale items from inventory_logs which records every VENTA with product reference
	const outletsNeedingItems = (outlets ?? []).filter((o: any) => !o.stock_outlet_items || o.stock_outlet_items.length === 0);
	const logsByOutlet: Record<string, any[]> = {};

	if (outletsNeedingItems.length > 0) {
		const outletIds = outletsNeedingItems.map((o: any) => o.id);
		const { data: logs } = await locals.supabase
			.from('inventory_logs')
			.select(`
				id,
				reference_id,
				product_id,
				quantity_changed,
				change_type,
				products (
					id,
					name,
					sku_code,
					price
				)
			`)
			.eq('change_type', 'VENTA')
			.in('reference_id', outletIds)
			.limit(10000);

		if (logs) {
			for (const log of logs) {
				if (!log.reference_id) continue;
				if (!logsByOutlet[log.reference_id]) {
					logsByOutlet[log.reference_id] = [];
				}
				const prod = (log as any).products;
				const qty = Math.abs(Number(log.quantity_changed));
				const unitPrice = Number(prod?.price ?? 0);
				logsByOutlet[log.reference_id].push({
					id: log.id,
					product_id: log.product_id,
					product_name: prod?.name ?? 'Producto',
					sku_code: prod?.sku_code ?? 'N/A',
					quantity: qty,
					unit_price: unitPrice,
					subtotal: qty * unitPrice
				});
			}
		}
	}

	const sanitizedOutlets = (outlets ?? []).map((o: any) => {
		const directItems = (o.stock_outlet_items ?? []).map((item: any) => ({
			id: item.id,
			product_id: item.product_id,
			product_name: item.products?.name ?? 'Producto',
			sku_code: item.products?.sku_code ?? 'N/A',
			quantity: Number(item.quantity),
			unit_price: Number(item.unit_price),
			subtotal: Number(item.subtotal)
		}));

		const items = directItems.length > 0 ? directItems : (logsByOutlet[o.id] ?? []);

		return {
			id: o.id,
			folio: o.folio !== undefined && o.folio !== null ? Number(o.folio) : null,
			user_id: o.user_id,
			total_amount: Number(o.total_amount),
			is_canceled: Boolean(o.is_canceled),
			canceled_at: o.canceled_at,
			canceled_by: o.canceled_by,
			cancel_reason: o.cancel_reason,
			idempotency_key: o.idempotency_key,
			created_at: o.created_at,
			items
		};
	});

	const validOutlets = sanitizedOutlets.filter((o: any) => !o.is_canceled);
	const canceledOutlets = sanitizedOutlets.filter((o: any) => o.is_canceled);
	const validSalesCount = validOutlets.length;
	const canceledSalesCount = canceledOutlets.length;
	const totalRevenue = Math.round(validOutlets.reduce((acc: number, o: any) => acc + (Number(o.total_amount) || 0), 0) * 100) / 100;

	return {
		outlets: sanitizedOutlets,
		metrics: {
			validSalesCount,
			canceledSalesCount,
			totalRevenue
		},
		filters: {
			fecha: fechaParam,
			desde: desdeParam,
			hasta: hastaParam,
			hoy: hoyParam
		}
	};
};

export const actions: Actions = {
	cancel: async ({ request, locals }) => {
		// Strict server RBAC check: only admin can cancel outlets
		if (!locals.user || locals.role !== 'admin') {
			return fail(403, { error: 'No autorizado. Solo administradores pueden cancelar ventas y procesar devoluciones.' });
		}

		const formData = await request.formData();
		const outletId = formData.get('outlet_id')?.toString()?.trim();
		const reason = formData.get('reason')?.toString()?.trim();

		if (!outletId) {
			return fail(400, { error: 'Identificador de venta no especificado.' });
		}

		if (!reason || reason.length < 3) {
			return fail(400, { error: 'Debe proporcionar un motivo válido para la devolución (mínimo 3 caracteres).' });
		}

		// Strictly invoke the cancel_stock_outlet RPC (which restores stock and logs DEVOLUCION atomically)
		const { data, error } = await locals.supabase.rpc('cancel_stock_outlet', {
			p_outlet_id: outletId,
			p_reason: reason
		});

		if (error) {
			return fail(400, {
				error: error.message || 'Error al procesar la devolución de la venta.'
			});
		}

		return {
			success: true,
			outletId
		};
	}
};
