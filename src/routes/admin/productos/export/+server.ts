import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * GET /admin/productos/export
 *
 * Exports active products to CSV format compatible with Excel.
 * - Requires admin authentication (defense-in-depth guard).
 * - Exports only active products (is_active = true).
 * - UTF-8 BOM (\uFEFF) for Excel accent compatibility.
 * - Columns: SKU, Nombre, Descripción, Precio de Venta, Stock Actual, Stock Mínimo, Estado.
 * - Strictly excludes product_costs.
 */
export const GET: RequestHandler = async ({ locals }) => {
	// Defense in depth RBAC check: only authenticated admin allowed
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	if (locals.role !== 'admin') {
		throw redirect(303, '/caja');
	}

	// Fetch active products only, selecting strictly public catalog fields
	const { data: products, error: dbError } = await locals.supabase
		.from('products')
		.select('sku_code, name, description, price, stock, min_stock, is_active')
		.eq('is_active', true)
		.order('name', { ascending: true });

	if (dbError) {
		throw error(500, 'Error al exportar el inventario de productos.');
	}

	// Helper to escape CSV values according to RFC 4180
	const escapeCsv = (val: unknown): string => {
		if (val === null || val === undefined) return '';
		const str = String(val);
		if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
			return `"${str.replace(/"/g, '""')}"`;
		}
		return str;
	};

	const headers = [
		'SKU',
		'Nombre',
		'Descripción',
		'Precio de Venta',
		'Stock Actual',
		'Stock Mínimo',
		'Estado'
	];

	const rows = (products ?? []).map((p: any) => [
		escapeCsv(p.sku_code),
		escapeCsv(p.name),
		escapeCsv(p.description ?? ''),
		escapeCsv(Number(p.price).toFixed(2)),
		escapeCsv(Number(p.stock)),
		escapeCsv(Number(p.min_stock)),
		escapeCsv(p.is_active ? 'Activo' : 'Inactivo')
	].join(','));

	// Include UTF-8 BOM so Excel opens accents and special characters properly
	const BOM = '\uFEFF';
	const csvContent = BOM + [headers.join(','), ...rows].join('\r\n');

	const today = new Date().toISOString().slice(0, 10);
	const filename = `inventario_${today}.csv`;

	return new Response(csvContent, {
		status: 200,
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
