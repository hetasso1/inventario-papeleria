import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load, actions } from '../../src/routes/admin/productos/+page.server';
import { GET as exportProducts } from '../../src/routes/admin/productos/export/+server';
import { isProductFormDirty } from '../../src/lib/components/admin/ProductModal.svelte';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * ISSUE-003: Admin Products Catalog & Cost Management Tests
 *
 * Validates:
 * 1. Catalog loading of active products and search filtering.
 * 2. Cost isolation: product_costs are fetched and mapped only for admin.
 * 3. Access guard: cajero and unauthenticated users are rejected from load and actions.
 * 4. Product creation and edition atomic calls to upsert_product_with_cost RPC.
 * 5. Input validation (negative prices, missing SKU/name).
 * 6. Soft Delete: UPDATE is_active = false without physical DELETE.
 */

describe('ISSUE-003: Admin Products Module (+page.server.ts)', () => {
	let mockSupabase: any;

	beforeEach(() => {
		mockSupabase = {
			from: vi.fn(),
			rpc: vi.fn()
		};
	});

	function createMockEvent(options: {
		user?: any;
		role?: 'admin' | 'cajero' | null;
		search?: string;
		formData?: FormData;
	}) {
		const url = new URL('http://localhost:5173/admin/productos');
		if (options.search) {
			url.searchParams.set('q', options.search);
		}

		return {
			url,
			locals: {
				user: options.user ?? { id: 'admin-uuid', email: 'admin@papeleria.local' },
				role: options.role ?? 'admin',
				supabase: mockSupabase
			},
			request: {
				formData: vi.fn().mockResolvedValue(options.formData ?? new FormData())
			}
		} as unknown as RequestEvent;
	}

	it('loads active products catalog and maps costs for admin role', async () => {
		const sampleProducts = [
			{
				id: 'prod-1',
				sku_code: 'SKU-001',
				name: 'Cuaderno Profesional',
				description: '100 hojas',
				price: 25.5,
				stock: 50.0,
				min_stock: 5.0,
				image_url: 'http://img.png',
				is_active: true
			},
			{
				id: 'prod-2',
				sku_code: 'SKU-002',
				name: 'Pluma Azul',
				description: 'Punto fino',
				price: 10.0,
				stock: 100.0,
				min_stock: 10.0,
				image_url: null,
				is_active: true
			}
		];

		const sampleCosts = [
			{ product_id: 'prod-1', cost: 15.0 },
			{ product_id: 'prod-2', cost: 4.5 }
		];

		// Mock query chain for products
		const orderMock = vi.fn().mockResolvedValue({ data: sampleProducts, error: null });
		const eqMock = vi.fn().mockReturnValue({ order: orderMock });
		const selectProductsMock = vi.fn().mockReturnValue({ eq: eqMock });

		// Mock query chain for product_costs
		const selectCostsMock = vi.fn().mockResolvedValue({ data: sampleCosts, error: null });

		mockSupabase.from.mockImplementation((table: string) => {
			if (table === 'products') return { select: selectProductsMock };
			if (table === 'product_costs') return { select: selectCostsMock };
			return {};
		});

		const event = createMockEvent({ role: 'admin' });
		const result: any = await load(event as any);

		expect(result.products).toHaveLength(2);
		expect(result.products[0].cost).toBe(15.0);
		expect(result.products[1].cost).toBe(4.5);
		expect(mockSupabase.from).toHaveBeenCalledWith('products');
		expect(mockSupabase.from).toHaveBeenCalledWith('product_costs');
	});

	it('applies search filter when query parameter q is present', async () => {
		const orMock = vi.fn().mockResolvedValue({ data: [], error: null });
		const orderMock = vi.fn().mockReturnValue({ or: orMock });
		const eqMock = vi.fn().mockReturnValue({ order: orderMock });
		const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

		mockSupabase.from.mockImplementation((table: string) => {
			if (table === 'products') return { select: selectMock };
			if (table === 'product_costs') return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
			return {};
		});

		const event = createMockEvent({ role: 'admin', search: 'lapiz' });
		await load(event as any);

		expect(orMock).toHaveBeenCalledWith(expect.stringContaining('lapiz'));
	});

	it('rejects load access with redirect 303 to /caja if user is role cajero', async () => {
		const event = createMockEvent({ role: 'cajero' });

		try {
			await load(event as any);
			expect.unreachable('Should have thrown a redirect');
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toBe('/caja');
		}
	});

	it('action upsert creates a new product invoking upsert_product_with_cost RPC', async () => {
		const formData = new FormData();
		formData.append('sku_code', 'SKU-NEW-01');
		formData.append('name', 'Borrador de Goma');
		formData.append('description', 'Miga de pan');
		formData.append('price', '8.50');
		formData.append('cost', '3.20');
		formData.append('stock', '40');
		formData.append('min_stock', '5');
		formData.append('image_url', 'http://img.com/borrador.png');

		mockSupabase.rpc.mockResolvedValue({ data: 'new-product-uuid', error: null });

		const event = createMockEvent({ role: 'admin', formData });
		const result: any = await (actions as any).upsert(event);

		expect(result.success).toBe(true);
		expect(result.productId).toBe('new-product-uuid');
		expect(mockSupabase.rpc).toHaveBeenCalledWith('upsert_product_with_cost', {
			p_id: null,
			p_sku_code: 'SKU-NEW-01',
			p_name: 'Borrador de Goma',
			p_description: 'Miga de pan',
			p_price: 8.5,
			p_cost: 3.2,
			p_stock: 40,
			p_min_stock: 5,
			p_image_url: 'http://img.com/borrador.png'
		});
	});

	it('action upsert updates an existing product with id invoking upsert_product_with_cost RPC', async () => {
		const formData = new FormData();
		formData.append('id', 'prod-uuid-1234');
		formData.append('sku_code', 'SKU-EDIT-01');
		formData.append('name', 'Tijeras de Oficina');
		formData.append('price', '35.00');
		formData.append('cost', '18.00');
		formData.append('stock', '25');
		formData.append('min_stock', '3');

		mockSupabase.rpc.mockResolvedValue({ data: 'prod-uuid-1234', error: null });

		const event = createMockEvent({ role: 'admin', formData });
		const result: any = await (actions as any).upsert(event);

		expect(result.success).toBe(true);
		expect(result.productId).toBe('prod-uuid-1234');
		expect(mockSupabase.rpc).toHaveBeenCalledWith('upsert_product_with_cost', {
			p_id: 'prod-uuid-1234',
			p_sku_code: 'SKU-EDIT-01',
			p_name: 'Tijeras de Oficina',
			p_description: null,
			p_price: 35.0,
			p_cost: 18.0,
			p_stock: 25,
			p_min_stock: 3,
			p_image_url: null
		});
	});

	it('action upsert fails with 403 if called by role cajero', async () => {
		const formData = new FormData();
		formData.append('sku_code', 'SKU-DENIED');
		formData.append('name', 'Intento No Autorizado');
		formData.append('price', '10.00');
		formData.append('cost', '5.00');
		formData.append('stock', '10');
		formData.append('min_stock', '2');

		const event = createMockEvent({ role: 'cajero', formData });
		const result: any = await (actions as any).upsert(event);

		expect(result.status).toBe(403);
		expect(result.data.error).toContain('No autorizado');
		expect(mockSupabase.rpc).not.toHaveBeenCalled();
	});

	it('action upsert validates inputs: rejects negative prices and empty required fields', async () => {
		const formData = new FormData();
		formData.append('sku_code', '');
		formData.append('name', 'Sin SKU');
		formData.append('price', '-10');

		const event = createMockEvent({ role: 'admin', formData });
		const result: any = await (actions as any).upsert(event);

		expect(result.status).toBe(400);
		expect(mockSupabase.rpc).not.toHaveBeenCalled();
	});

	it('action softDelete updates is_active = false and never executes physical DELETE', async () => {
		const formData = new FormData();
		formData.append('id', 'prod-to-deactivate');

		const eqMock = vi.fn().mockResolvedValue({ error: null });
		const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
		const deleteMock = vi.fn();

		mockSupabase.from.mockImplementation((table: string) => {
			if (table === 'products') {
				return {
					update: updateMock,
					delete: deleteMock
				};
			}
			return {};
		});

		const event = createMockEvent({ role: 'admin', formData });
		const result: any = await (actions as any).softDelete(event);

		expect(result.success).toBe(true);
		expect(result.deletedId).toBe('prod-to-deactivate');

		// Verifies UPDATE is_active = false was executed
		expect(updateMock).toHaveBeenCalledWith(
			expect.objectContaining({ is_active: false })
		);
		expect(eqMock).toHaveBeenCalledWith('id', 'prod-to-deactivate');

		// Strictly verifies NO physical DELETE was invoked
		expect(deleteMock).not.toHaveBeenCalled();
	});

	it('action softDelete fails with 403 if called by role cajero', async () => {
		const formData = new FormData();
		formData.append('id', 'prod-to-deactivate');

		const event = createMockEvent({ role: 'cajero', formData });
		const result: any = await (actions as any).softDelete(event);

		expect(result.status).toBe(403);
		expect(result.data.error).toContain('No autorizado');
		expect(mockSupabase.from).not.toHaveBeenCalled();
	});
});

describe('SPRINT 19: Export Inventory CSV (+server.ts)', () => {
	let mockSupabase: any;

	beforeEach(() => {
		mockSupabase = {
			from: vi.fn()
		};
	});

	function createExportEvent(options: {
		user?: any;
		role?: 'admin' | 'cajero' | null;
	}) {
		return {
			url: new URL('http://localhost:5173/admin/productos/export'),
			locals: {
				user: options.user !== undefined ? options.user : { id: 'admin-uuid', email: 'admin@papeleria.local' },
				role: options.role !== undefined ? options.role : 'admin',
				supabase: mockSupabase
			}
		} as unknown as RequestEvent;
	}

	it('exports active products to Excel-compatible CSV with UTF-8 BOM and correct headers', async () => {
		const sampleProducts = [
			{
				sku_code: 'SKU-001',
				name: 'Cuaderno Profesional, 100 hojas',
				description: 'Cuadriculado "Norma"',
				price: 25.5,
				stock: 40,
				min_stock: 5,
				is_active: true
			},
			{
				sku_code: 'SKU-002',
				name: 'Lápiz HB',
				description: null,
				price: 5.0,
				stock: 120,
				min_stock: 10,
				is_active: true
			}
		];

		const orderMock = vi.fn().mockResolvedValue({ data: sampleProducts, error: null });
		const eqMock = vi.fn().mockReturnValue({ order: orderMock });
		const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
		mockSupabase.from.mockImplementation((table: string) => {
			if (table === 'products') return { select: selectMock };
			return {};
		});

		const event = createExportEvent({ role: 'admin' });
		const response = await exportProducts(event as any);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
		expect(response.headers.get('Content-Disposition')).toContain('attachment; filename="inventario_');

		const buffer = await response.arrayBuffer();
		const bytes = new Uint8Array(buffer);

		// Starts with UTF-8 BOM (0xEF, 0xBB, 0xBF) for Excel compatibility
		expect(bytes[0]).toBe(0xEF);
		expect(bytes[1]).toBe(0xBB);
		expect(bytes[2]).toBe(0xBF);

		const csvText = new TextDecoder('utf-8').decode(buffer);

		// Header validation
		expect(csvText).toContain('SKU,Nombre,Descripción,Precio de Venta,Stock Actual,Stock Mínimo,Estado');

		// Content and CSV RFC 4180 escaping checks
		expect(csvText).toContain('"Cuaderno Profesional, 100 hojas"');
		expect(csvText).toContain('"Cuadriculado ""Norma"""');
		expect(csvText).toContain('25.50');
		expect(csvText).toContain('SKU-002');
		expect(csvText).toContain('Activo');

		// Defense in depth: strictly NEVER queries or exposes costs
		expect(mockSupabase.from).toHaveBeenCalledWith('products');
		expect(mockSupabase.from).not.toHaveBeenCalledWith('product_costs');
		expect(csvText).not.toContain('cost');
	});

	it('rejects unauthenticated user with 303 redirect to /login', async () => {
		const event = createExportEvent({ user: null, role: null });

		try {
			await exportProducts(event as any);
			expect.unreachable('Should redirect');
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toBe('/login');
		}
	});

	it('rejects cajero with 303 redirect to /caja', async () => {
		const event = createExportEvent({ role: 'cajero' });

		try {
			await exportProducts(event as any);
			expect.unreachable('Should redirect');
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toBe('/caja');
		}
	});
});

describe('SPRINT 19: ProductModal Dirty State & Protection (ProductModal.svelte)', () => {
	it('detects dirty state when creating a new product', () => {
		// Clean / pristine new product
		expect(isProductFormDirty(null, {})).toBe(false);
		expect(isProductFormDirty(null, { sku: '', name: '', price: 0, cost: 0, stock: 0, minStock: 5 })).toBe(false);

		// Dirty with field modifications
		expect(isProductFormDirty(null, { sku: 'SKU-TEST' })).toBe(true);
		expect(isProductFormDirty(null, { name: 'Nuevo Artículo' })).toBe(true);
		expect(isProductFormDirty(null, { price: 10.5 })).toBe(true);
		expect(isProductFormDirty(null, { cost: 5.0 })).toBe(true);
		expect(isProductFormDirty(null, { stock: 10 })).toBe(true);
		expect(isProductFormDirty(null, { minStock: 2 })).toBe(true);
		expect(isProductFormDirty(null, { imageUrl: 'http://image.png' })).toBe(true);
	});

	it('detects dirty state when editing an existing product', () => {
		const existingProduct = {
			id: 'prod-123',
			sku_code: 'SKU-001',
			name: 'Cuaderno',
			description: '100 hojas',
			price: 25.0,
			cost: 15.0,
			stock: 50,
			min_stock: 5,
			image_url: 'http://cuaderno.png',
			is_active: true
		};

		// Pristine / identical values
		expect(
			isProductFormDirty(existingProduct, {
				sku: 'SKU-001',
				name: 'Cuaderno',
				description: '100 hojas',
				price: 25.0,
				cost: 15.0,
				stock: 50,
				minStock: 5,
				imageUrl: 'http://cuaderno.png'
			})
		).toBe(false);

		// Dirty upon changing any field
		expect(isProductFormDirty(existingProduct, { sku: 'SKU-MODIFIED' })).toBe(true);
		expect(isProductFormDirty(existingProduct, { name: 'Cuaderno Rayado' })).toBe(true);
		expect(isProductFormDirty(existingProduct, { price: 30.0 })).toBe(true);
		expect(isProductFormDirty(existingProduct, { stock: 45 })).toBe(true);
	});
});
