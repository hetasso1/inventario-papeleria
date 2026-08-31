import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * Server-side load and actions for /admin/productos (Product Catalog & Cost Management).
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	// Guard: Ensure user is authenticated and is admin
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	if (locals.role !== 'admin') {
		throw redirect(303, '/caja');
	}

	const searchQuery = url.searchParams.get('q')?.trim() ?? '';

	// 1. Fetch active products
	let query = locals.supabase
		.from('products')
		.select('id, sku_code, name, description, price, stock, min_stock, image_url, is_active, created_at, updated_at')
		.eq('is_active', true)
		.order('name', { ascending: true });

	if (searchQuery) {
		query = query.or(`name.ilike.%${searchQuery}%,sku_code.ilike.%${searchQuery}%`);
	}

	const { data: products, error: prodError } = await query;

	if (prodError) {
		return {
			products: [],
			search: searchQuery,
			error: 'Error al cargar el catálogo de productos.'
		};
	}

	// 2. Fetch costs securely for admin (RLS allows only admin)
	const { data: costs } = await locals.supabase
		.from('product_costs')
		.select('product_id, cost');

	const costMap = new Map<string, number>(
		(costs ?? []).map((c: { product_id: string; cost: number }) => [c.product_id, Number(c.cost)])
	);

	// Attach cost to each product
	const enrichedProducts = (products ?? []).map((p: any) => ({
		...p,
		price: Number(p.price),
		stock: Number(p.stock),
		min_stock: Number(p.min_stock),
		cost: costMap.get(p.id) ?? 0
	}));

	return {
		products: enrichedProducts,
		search: searchQuery
	};
};

export const actions: Actions = {
	upsert: async ({ request, locals }) => {
		// Strict server-side RBAC check
		if (!locals.user || locals.role !== 'admin') {
			return fail(403, { error: 'No autorizado. Solo administradores pueden gestionar el catálogo.' });
		}

		const formData = await request.formData();
		const id = formData.get('id')?.toString().trim() || null;
		const skuCode = formData.get('sku_code')?.toString().trim();
		const name = formData.get('name')?.toString().trim();
		const description = formData.get('description')?.toString().trim() || null;
		const priceRaw = formData.get('price');
		const costRaw = formData.get('cost');
		const stockRaw = formData.get('stock');
		const minStockRaw = formData.get('min_stock');
		const imageUrl = formData.get('image_url')?.toString().trim() || null;

		// Input validation
		if (!skuCode || !name) {
			return fail(400, { error: 'El código SKU y el nombre del producto son obligatorios.' });
		}

		const price = Number(priceRaw);
		const cost = Number(costRaw);
		const stock = Number(stockRaw);
		const minStock = Number(minStockRaw);

		if (isNaN(price) || price < 0) {
			return fail(400, { error: 'El precio de venta debe ser un número mayor o igual a 0.' });
		}
		if (isNaN(cost) || cost < 0) {
			return fail(400, { error: 'El costo unitario debe ser un número mayor o igual a 0.' });
		}
		if (isNaN(stock) || stock < 0) {
			return fail(400, { error: 'El stock actual debe ser un número mayor o igual a 0.' });
		}
		if (isNaN(minStock) || minStock < 0) {
			return fail(400, { error: 'El stock mínimo debe ser un número mayor o igual a 0.' });
		}

		// Atomic Upsert via RPC defined in SRS v8.0
		const { data: productId, error } = await locals.supabase.rpc('upsert_product_with_cost', {
			p_id: id,
			p_sku_code: skuCode,
			p_name: name,
			p_description: description,
			p_price: price,
			p_cost: cost,
			p_stock: stock,
			p_min_stock: minStock,
			p_image_url: imageUrl
		});

		if (error) {
			return fail(400, { error: 'Error al guardar el producto. Verifique que el código SKU no esté duplicado.' });
		}

		return { success: true, productId };
	},

	softDelete: async ({ request, locals }) => {
		// Strict server-side RBAC check
		if (!locals.user || locals.role !== 'admin') {
			return fail(403, { error: 'No autorizado. Solo administradores pueden desactivar productos.' });
		}

		const formData = await request.formData();
		const id = formData.get('id')?.toString().trim();

		if (!id) {
			return fail(400, { error: 'Identificador de producto no especificado.' });
		}

		// Soft Delete: UPDATE is_active = false (NO physical DELETE)
		const { error } = await locals.supabase
			.from('products')
			.update({ is_active: false, updated_at: new Date().toISOString() })
			.eq('id', id);

		if (error) {
			return fail(400, { error: 'Error al desactivar el producto.' });
		}

		return { success: true, deletedId: id };
	}
};
