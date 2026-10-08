import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { load, actions } from '../../src/routes/admin/productos/+page.server';
import { GET as exportProducts } from '../../src/routes/admin/productos/export/+server';
import { GET as serveImage } from '../../src/routes/uploads/products/[filename]/+server';
import { isProductFormDirty, stepNumberValue, validateProductFormInput } from '../../src/lib/components/admin/ProductModal.svelte';
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
		formData.append('existing_image_url', '');

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
			p_image_url: null
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
		formData.append('existing_image_url', '');

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

	it('action upsert preserves existing image URL when no new file is uploaded', async () => {
		const formData = new FormData();
		formData.append('sku_code', 'SKU-IMG-KEEP');
		formData.append('name', 'Producto con Imagen');
		formData.append('price', '10.00');
		formData.append('cost', '5.00');
		formData.append('stock', '10');
		formData.append('min_stock', '2');
		formData.append('existing_image_url', '/uploads/products/existing-image.jpg');
		// No image_file appended — simulates editing without changing image

		mockSupabase.rpc.mockResolvedValue({ data: 'prod-keep-img', error: null });

		const event = createMockEvent({ role: 'admin', formData });
		const result: any = await (actions as any).upsert(event);

		expect(result.success).toBe(true);
		expect(mockSupabase.rpc).toHaveBeenCalledWith('upsert_product_with_cost',
			expect.objectContaining({
				p_image_url: '/uploads/products/existing-image.jpg'
			})
		);
	});

	it('action upsert rejects non-image file uploads with clear error', async () => {
		const formData = new FormData();
		formData.append('sku_code', 'SKU-BAD-FILE');
		formData.append('name', 'Producto con Archivo Malo');
		formData.append('price', '10.00');
		formData.append('cost', '5.00');
		formData.append('stock', '10');
		formData.append('min_stock', '2');
		formData.append('existing_image_url', '');

		// Create a fake text file
		const fakeFile = new File(['hello world'], 'malware.exe', { type: 'application/x-msdownload' });
		formData.append('image_file', fakeFile);

		const event = createMockEvent({ role: 'admin', formData });
		const result: any = await (actions as any).upsert(event);

		expect(result.status).toBe(400);
		expect(result.data.error).toContain('Tipo de imagen no soportado');
		expect(mockSupabase.rpc).not.toHaveBeenCalled();
	});

	it('action upsert accepts valid image file and generates /uploads/products/ path', async () => {
		const formData = new FormData();
		formData.append('sku_code', 'SKU-IMG-NEW');
		formData.append('name', 'Producto con Imagen Nueva');
		formData.append('price', '15.00');
		formData.append('cost', '7.50');
		formData.append('stock', '20');
		formData.append('min_stock', '3');
		formData.append('existing_image_url', '');

		// Create a valid PNG file (minimal valid PNG header)
		const pngHeader = new Uint8Array([
			0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
			0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52  // IHDR chunk start
		]);
		const validImage = new File([pngHeader], 'product-photo.png', { type: 'image/png' });
		formData.append('image_file', validImage);

		mockSupabase.rpc.mockResolvedValue({ data: 'prod-new-img', error: null });

		const event = createMockEvent({ role: 'admin', formData });
		const result: any = await (actions as any).upsert(event);

		expect(result.success).toBe(true);
		// Verify the RPC received a path matching the /uploads/products/ pattern
		const rpcCall = mockSupabase.rpc.mock.calls[0];
		expect(rpcCall[0]).toBe('upsert_product_with_cost');
		const imageUrl = rpcCall[1].p_image_url;
		expect(imageUrl).toMatch(/^\/uploads\/products\/[0-9a-f-]+\.png$/);

		// Clean up only the temporary file created by this test
		if (imageUrl) {
			const { unlink } = await import('node:fs/promises');
			const { resolve } = await import('node:path');
			try {
				await unlink(resolve(process.cwd(), 'static', imageUrl.replace(/^\//, '')));
			} catch { /* ignore */ }
		}
	});

	it('action upsert replaces image — new path differs from existing', async () => {
		const formData = new FormData();
		formData.append('sku_code', 'SKU-IMG-REPLACE');
		formData.append('name', 'Producto Reemplazo');
		formData.append('price', '20.00');
		formData.append('cost', '10.00');
		formData.append('stock', '15');
		formData.append('min_stock', '3');
		formData.append('existing_image_url', '/uploads/products/old-image-uuid.jpg');

		const validImage = new File([new Uint8Array(100)], 'new-photo.jpg', { type: 'image/jpeg' });
		formData.append('image_file', validImage);

		mockSupabase.rpc.mockResolvedValue({ data: 'prod-replace-img', error: null });

		const event = createMockEvent({ role: 'admin', formData });
		const result: any = await (actions as any).upsert(event);

		expect(result.success).toBe(true);
		const rpcCall = mockSupabase.rpc.mock.calls[0];
		const newImageUrl = rpcCall[1].p_image_url;
		// The new path should be different from the old one
		expect(newImageUrl).not.toBe('/uploads/products/old-image-uuid.jpg');
		expect(newImageUrl).toMatch(/^\/uploads\/products\/[0-9a-f-]+\.jpg$/);

		// Clean up only the temporary file created by this test
		if (newImageUrl) {
			const { unlink } = await import('node:fs/promises');
			const { resolve } = await import('node:path');
			try {
				await unlink(resolve(process.cwd(), 'static', newImageUrl.replace(/^\//, '')));
			} catch { /* ignore */ }
		}
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
		// Dirty with new image selected
		expect(isProductFormDirty(null, { hasNewImage: true })).toBe(true);
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
		// Dirty when image is being replaced
		expect(isProductFormDirty(existingProduct, {
			sku: 'SKU-001',
			name: 'Cuaderno',
			description: '100 hojas',
			price: 25.0,
			cost: 15.0,
			stock: 50,
			minStock: 5,
			imageUrl: 'http://cuaderno.png',
			hasNewImage: true
		})).toBe(true);
	});
});

describe('Product Numeric Precision & Stepper Features (FEATURE-PROD-IMG-PRECISION)', () => {
	it('verifies step attribute values in ProductModal.svelte template', async () => {
		const { readFile } = await import('node:fs/promises');
		const { resolve } = await import('node:path');
		const modalPath = resolve(process.cwd(), 'src/lib/components/admin/ProductModal.svelte');
		const content = await readFile(modalPath, 'utf-8');

		// Check price step="0.5"
		expect(content).toMatch(/<input[^>]*id="price"[^>]*step="0\.5"/s);
		// Check cost step="0.01" (unchanged, isolated)
		expect(content).toMatch(/<input[^>]*id="cost"[^>]*step="0\.01"/s);
		// Check stock step="1"
		expect(content).toMatch(/<input[^>]*id="stock"[^>]*step="1"/s);
		// Check min_stock step="1"
		expect(content).toMatch(/<input[^>]*id="min_stock"[^>]*step="1"/s);
		// Check form novalidate to allow manual entry of custom decimals without stepMismatch blocking
		expect(content).toMatch(/<form[^>]*novalidate/s);
	});

	it('PRECIO DE VENTA: arrow increment (+0.50) and decrement (-0.50) mandatory cases: 5.00 ↑ => 5.50 → 6.00 → 6.50, and 6.50 ↓ => 6.00 → 5.50 → 5.00', () => {
		const step = 0.5;
		let val = 5.00;

		val = stepNumberValue(val, step, 'up');
		expect(val).toBe(5.50);

		val = stepNumberValue(val, step, 'up');
		expect(val).toBe(6.00);

		val = stepNumberValue(val, step, 'up');
		expect(val).toBe(6.50);

		val = stepNumberValue(val, step, 'down');
		expect(val).toBe(6.00);

		val = stepNumberValue(val, step, 'down');
		expect(val).toBe(5.50);

		val = stepNumberValue(val, step, 'down');
		expect(val).toBe(5.00);
	});

	it('COSTO UNITARIO: arrow increment (+0.01) and decrement (-0.01) (retains step="0.01"): 5.00 ↑ => 5.01, 5.01 ↑ => 5.02, 5.02 ↓ => 5.01', () => {
		const step = 0.01;
		let val = 5.00;

		val = stepNumberValue(val, step, 'up');
		expect(val).toBe(5.01);

		val = stepNumberValue(val, step, 'up');
		expect(val).toBe(5.02);

		val = stepNumberValue(val, step, 'down');
		expect(val).toBe(5.01);
	});

	it('STOCK ACTUAL: arrow increment (+1) and decrement (-1) mandatory cases: 5 ↑ => 6 → 7 → 8, and 8 ↓ => 7 → 6 → 5', () => {
		const step = 1;
		let val = 5;

		val = stepNumberValue(val, step, 'up');
		expect(val).toBe(6);

		val = stepNumberValue(val, step, 'up');
		expect(val).toBe(7);

		val = stepNumberValue(val, step, 'up');
		expect(val).toBe(8);

		val = stepNumberValue(val, step, 'down');
		expect(val).toBe(7);

		val = stepNumberValue(val, step, 'down');
		expect(val).toBe(6);

		val = stepNumberValue(val, step, 'down');
		expect(val).toBe(5);
	});

	it('STOCK MÍNIMO: arrow increment (+1) and decrement (-1) mandatory cases: 2 ↑ => 3 → 4 → 5, and 5 ↓ => 4 → 3 → 2', () => {
		const step = 1;
		let val = 2;

		val = stepNumberValue(val, step, 'up');
		expect(val).toBe(3);

		val = stepNumberValue(val, step, 'up');
		expect(val).toBe(4);

		val = stepNumberValue(val, step, 'up');
		expect(val).toBe(5);

		val = stepNumberValue(val, step, 'down');
		expect(val).toBe(4);

		val = stepNumberValue(val, step, 'down');
		expect(val).toBe(3);

		val = stepNumberValue(val, step, 'down');
		expect(val).toBe(2);
	});

	it('manual decimal typing for stock and min_stock is preserved without truncation or rejection (e.g. 5.25, 0.008, 5.001)', () => {
		const formData = new FormData();
		formData.append('sku_code', 'SKU-MANUAL-DECIMAL');
		formData.append('name', 'Manual Decimal Product');
		formData.append('price', '15.99');
		formData.append('cost', '8.45');
		formData.append('stock', '5.25');
		formData.append('min_stock', '0.008');
		formData.append('existing_image_url', '');

		const mockRpc = vi.fn().mockResolvedValue({ data: 'manual-dec-id', error: null });
		const event = {
			locals: {
				user: { id: 'admin-uuid' },
				role: 'admin',
				supabase: { rpc: mockRpc }
			},
			request: {
				formData: vi.fn().mockResolvedValue(formData)
			}
		} as unknown as RequestEvent;

		return (actions as any).upsert(event).then((result: any) => {
			expect(result.success).toBe(true);
			expect(mockRpc).toHaveBeenCalledWith('upsert_product_with_cost',
				expect.objectContaining({
					p_price: 15.99,
					p_cost: 8.45,
					p_stock: 5.25,
					p_min_stock: 0.008
				})
			);
		});
	});

	it('validateProductFormInput: rejects empty required text fields (sku, name)', () => {
		const validBase = { sku: 'SKU-1', name: 'Prod', price: 10, cost: 5, stock: 10, minStock: 2 };

		expect(validateProductFormInput({ ...validBase, sku: '' }).valid).toBe(false);
		expect(validateProductFormInput({ ...validBase, sku: '   ' }).valid).toBe(false);
		expect(validateProductFormInput({ ...validBase, name: '' }).valid).toBe(false);
		expect(validateProductFormInput({ ...validBase, name: '   ' }).valid).toBe(false);
	});

	it('validateProductFormInput: rejects empty required numeric fields (price, cost, stock, minStock)', () => {
		const validBase = { sku: 'SKU-1', name: 'Prod', price: 10, cost: 5, stock: 10, minStock: 2 };

		expect(validateProductFormInput({ ...validBase, price: '' }).valid).toBe(false);
		expect(validateProductFormInput({ ...validBase, cost: '' }).valid).toBe(false);
		expect(validateProductFormInput({ ...validBase, stock: '' }).valid).toBe(false);
		expect(validateProductFormInput({ ...validBase, minStock: '' }).valid).toBe(false);
	});

	it('validateProductFormInput: rejects invalid/non-numeric values', () => {
		const validBase = { sku: 'SKU-1', name: 'Prod', price: 10, cost: 5, stock: 10, minStock: 2 };

		expect(validateProductFormInput({ ...validBase, price: 'abc' }).valid).toBe(false);
		expect(validateProductFormInput({ ...validBase, cost: 'xyz' }).valid).toBe(false);
		expect(validateProductFormInput({ ...validBase, stock: 'invalid' }).valid).toBe(false);
		expect(validateProductFormInput({ ...validBase, minStock: '---' }).valid).toBe(false);
	});

	it('validateProductFormInput: rejects negative values for all numeric fields', () => {
		const validBase = { sku: 'SKU-1', name: 'Prod', price: 10, cost: 5, stock: 10, minStock: 2 };

		expect(validateProductFormInput({ ...validBase, price: -0.01 }).valid).toBe(false);
		expect(validateProductFormInput({ ...validBase, cost: -5 }).valid).toBe(false);
		expect(validateProductFormInput({ ...validBase, stock: -0.5 }).valid).toBe(false);
		expect(validateProductFormInput({ ...validBase, minStock: -1 }).valid).toBe(false);
	});

	it('validateProductFormInput: rejects values exceeding database capacity limits (NUMERIC(10,2) max 99,999,999.99 and NUMERIC(10,3) max 9,999,999.999)', () => {
		const validBase = { sku: 'SKU-1', name: 'Prod', price: 10, cost: 5, stock: 10, minStock: 2 };

		// Exact maximum values are accepted
		expect(validateProductFormInput({ ...validBase, price: 99999999.99 }).valid).toBe(true);
		expect(validateProductFormInput({ ...validBase, cost: 99999999.99 }).valid).toBe(true);
		expect(validateProductFormInput({ ...validBase, stock: 9999999.999 }).valid).toBe(true);
		expect(validateProductFormInput({ ...validBase, minStock: 9999999.999 }).valid).toBe(true);

		// Exceeding limits are rejected
		expect(validateProductFormInput({ ...validBase, price: 100000000 }).valid).toBe(false);
		expect(validateProductFormInput({ ...validBase, cost: 100000000 }).valid).toBe(false);
		expect(validateProductFormInput({ ...validBase, stock: 10000000 }).valid).toBe(false);
		expect(validateProductFormInput({ ...validBase, minStock: 10000000 }).valid).toBe(false);
	});

	it('validateProductFormInput: accepts valid manual decimals (5.25, 5.001, 0.008)', () => {
		const res1 = validateProductFormInput({
			sku: 'SKU-DEC-1',
			name: 'Decimal 1',
			price: 15.50,
			cost: 8.25,
			stock: 5.25,
			minStock: 2.50
		});
		expect(res1.valid).toBe(true);

		const res2 = validateProductFormInput({
			sku: 'SKU-DEC-2',
			name: 'Decimal 2',
			price: 10.00,
			cost: 5.00,
			stock: 5.001,
			minStock: 0.008
		});
		expect(res2.valid).toBe(true);
	});
});

describe('Product Image Upload Endpoint (+server.ts)', () => {
	it('returns 404 for a non-existent image', async () => {
		const event = {
			params: { filename: 'does-not-exist-abc123.png' }
		} as unknown as RequestEvent;

		try {
			await serveImage(event);
			expect.unreachable('Should have thrown a 404 error');
		} catch (err: any) {
			expect(err.status).toBe(404);
		}
	});

	it('rejects path traversal attempts with dot-dot sequences', async () => {
		const event = {
			params: { filename: '..%2F..%2Fetc%2Fpasswd' }
		} as unknown as RequestEvent;

		try {
			await serveImage(event);
			expect.unreachable('Should have thrown an error');
		} catch (err: any) {
			// Should be rejected — either 400 or 404 is acceptable
			expect([400, 404]).toContain(err.status);
		}
	});

	it('rejects filenames with directory separators', async () => {
		const event = {
			params: { filename: 'subdir/secret.png' }
		} as unknown as RequestEvent;

		try {
			await serveImage(event);
			expect.unreachable('Should have thrown an error');
		} catch (err: any) {
			expect(err.status).toBe(400);
		}
	});

	it('rejects non-image file extensions', async () => {
		const event = {
			params: { filename: 'malicious.exe' }
		} as unknown as RequestEvent;

		try {
			await serveImage(event);
			expect.unreachable('Should have thrown an error');
		} catch (err: any) {
			expect(err.status).toBe(400);
		}
	});

	it('rejects empty filename', async () => {
		const event = {
			params: { filename: '' }
		} as unknown as RequestEvent;

		try {
			await serveImage(event);
			expect.unreachable('Should have thrown an error');
		} catch (err: any) {
			expect(err.status).toBe(400);
		}
	});

	it('serves an existing image file with correct content-type', async () => {
		// Create a test image file temporarily
		const { writeFile, mkdir, unlink } = await import('node:fs/promises');
		const { resolve } = await import('node:path');
		const uploadsDir = resolve(process.cwd(), 'static', 'uploads', 'products');
		const testFilename = '__vitest_test_image__.png';
		const testFilePath = resolve(uploadsDir, testFilename);

		try {
			await mkdir(uploadsDir, { recursive: true });
			// Write a minimal valid-ish PNG (just enough for the test)
			const pngBytes = new Uint8Array([
				0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
			]);
			await writeFile(testFilePath, pngBytes);

			const event = {
				params: { filename: testFilename }
			} as unknown as RequestEvent;

			const response = await serveImage(event);
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('image/png');
			expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');

			const body = await response.arrayBuffer();
			expect(body.byteLength).toBe(8);
		} finally {
			// Cleanup test file
			try { await unlink(testFilePath); } catch { /* ignore */ }
		}
	});

	afterAll(async () => {
		const { unlink } = await import('node:fs/promises');
		const { resolve } = await import('node:path');
		const testFilePath = resolve(process.cwd(), 'static', 'uploads', 'products', '__vitest_test_image__.png');
		try {
			await unlink(testFilePath);
		} catch {
			/* ignore */
		}
	});
});
