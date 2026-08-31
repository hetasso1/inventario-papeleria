import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * Server-side load and actions for /caja (POS Checkout & Barcode Sales).
 */
export const load: PageServerLoad = async ({ locals }) => {
	// Guard: Ensure user is authenticated (both admin and cajero are allowed)
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	// Fetch active products for the POS catalog (NO product_costs queried to prevent leaking costs)
	const { data: products, error } = await locals.supabase
		.from('products')
		.select('id, sku_code, name, description, price, stock, min_stock, image_url, is_active')
		.eq('is_active', true)
		.order('name', { ascending: true });

	if (error) {
		return {
			products: [],
			error: 'Error al cargar el catálogo de productos.'
		};
	}

	const sanitizedProducts = (products ?? []).map((p: any) => ({
		id: p.id,
		sku_code: p.sku_code,
		name: p.name,
		description: p.description,
		price: Number(p.price),
		stock: Number(p.stock),
		min_stock: Number(p.min_stock),
		image_url: p.image_url,
		is_active: p.is_active
	}));

	return {
		products: sanitizedProducts,
		user: {
			id: locals.user.id,
			role: locals.role
		}
	};
};

export const actions: Actions = {
	checkout: async ({ request, locals }) => {
		// Strict server authentication check
		if (!locals.user) {
			return fail(401, { error: 'No autorizado. Debe iniciar sesión para realizar ventas.' });
		}

		const formData = await request.formData();
		const itemsRaw = formData.get('items')?.toString();
		let idempotencyKey = formData.get('idempotency_key')?.toString()?.trim();

		// Ensure an idempotency key UUID exists
		if (!idempotencyKey) {
			idempotencyKey = crypto.randomUUID();
		}

		if (!itemsRaw) {
			return fail(400, {
				error: 'El carrito de venta no contiene productos.',
				idempotencyKey
			});
		}

		let parsedItems: Array<{ product_id: string; quantity: number }>;
		try {
			parsedItems = JSON.parse(itemsRaw);
		} catch {
			return fail(400, {
				error: 'Formato de artículos del carrito inválido.',
				idempotencyKey
			});
		}

		if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
			return fail(400, {
				error: 'El carrito debe tener al menos un producto.',
				idempotencyKey
			});
		}

		// Validate each item (product_id non-empty and quantity > 0)
		for (const item of parsedItems) {
			if (!item.product_id || typeof item.product_id !== 'string') {
				return fail(400, {
					error: 'Producto inválido en el carrito.',
					idempotencyKey
				});
			}
			const qty = Number(item.quantity);
			if (isNaN(qty) || qty <= 0) {
				return fail(400, {
					error: 'La cantidad para cada producto debe ser mayor a 0.',
					idempotencyKey
				});
			}
		}

		// Prepare strictly sanitized payload for process_stock_outlet RPC
		// (Notice: client unit prices are completely ignored; DB price is authoritative)
		const rpcItems = parsedItems.map((item) => ({
			product_id: item.product_id,
			quantity: Number(item.quantity)
		}));

		// Invoke atomic & idempotent RPC defined in SRS v8.0
		const { data: outletId, error } = await locals.supabase.rpc('process_stock_outlet', {
			p_items: rpcItems,
			p_idempotency_key: idempotencyKey
		});

		if (error) {
			// Do not clear cart or lose idempotencyKey on failure (allows retry)
			return fail(400, {
				error: error.message || 'Error al procesar la salida de inventario. Verifique existencias suficientes.',
				idempotencyKey
			});
		}

		return {
			success: true,
			outletId,
			idempotencyKey
		};
	}
};
