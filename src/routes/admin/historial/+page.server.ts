import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * Server-side load and actions for /admin/historial (Sales History & Return/Cancellation Management).
 */
export const load: PageServerLoad = async ({ locals }) => {
	// Guard: Ensure user is authenticated and is admin
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	if (locals.role !== 'admin') {
		throw redirect(303, '/caja');
	}

	// Fetch sales outlets with associated items and product names (NO costs queried)
	const { data: outlets, error } = await locals.supabase
		.from('stock_outlets')
		.select(`
			id,
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
		`)
		.order('created_at', { ascending: false });

	if (error) {
		return {
			outlets: [],
			error: 'Error al cargar el historial de ventas.'
		};
	}

	const sanitizedOutlets = (outlets ?? []).map((o: any) => ({
		id: o.id,
		user_id: o.user_id,
		total_amount: Number(o.total_amount),
		is_canceled: Boolean(o.is_canceled),
		canceled_at: o.canceled_at,
		canceled_by: o.canceled_by,
		cancel_reason: o.cancel_reason,
		idempotency_key: o.idempotency_key,
		created_at: o.created_at,
		items: (o.stock_outlet_items ?? []).map((item: any) => ({
			id: item.id,
			product_id: item.product_id,
			product_name: item.products?.name ?? 'Producto',
			sku_code: item.products?.sku_code ?? 'N/A',
			quantity: Number(item.quantity),
			unit_price: Number(item.unit_price),
			subtotal: Number(item.subtotal)
		}))
	}));

	return {
		outlets: sanitizedOutlets
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
