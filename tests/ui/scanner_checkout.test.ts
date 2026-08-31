import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScannerHandler } from '../../src/lib/components/caja/BarcodeScanner.svelte';
import { calculateSubtotal, calculateTotal, type CartItem } from '../../src/lib/components/caja/CartTable.svelte';
import { load, actions } from '../../src/routes/caja/+page.server';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * ISSUE-004: POS Cashier, Resilient Barcode Scanner & Atomic Checkout Tests
 *
 * Validates:
 * 1. Global Barcode Scanner burst capture (<100ms) and Enter termination.
 * 2. Slow keyboard typing rejection (>=100ms) without false positives.
 * 3. Modifier key filtering.
 * 4. Cart calculations with fractional quantities (NUMERIC(10,3)).
 * 5. Server-side load for authenticated users without cost leakage.
 * 6. Checkout action invokes process_stock_outlet with idempotency_key UUID and no client prices.
 * 7. Checkout error handling and idempotency key preservation.
 */

describe('ISSUE-004: Barcode Scanner Burst Detection (ScannerHandler)', () => {
	it('accumulates characters in fast burst (<100ms) and emits complete code on Enter', () => {
		const onScan = vi.fn();
		const handler = new ScannerHandler(onScan, 100);

		let time = 1000;
		const code = '7501002345678';

		for (const char of code) {
			handler.handleKey(char, time);
			time += 20; // 20ms between keys (< 100ms burst)
		}

		// Press Enter to complete scan
		const emitted = handler.handleKey('Enter', time + 20);

		expect(emitted).toBe('7501002345678');
		expect(onScan).toHaveBeenCalledWith('7501002345678');
		expect(handler.getBuffer()).toBe('');
	});

	it('resets buffer when typing slowly (>=100ms) preventing partial scans', () => {
		const onScan = vi.fn();
		const handler = new ScannerHandler(onScan, 100);

		let time = 1000;
		handler.handleKey('A', time);

		time += 250; // Slow pause (250ms >= 100ms)
		handler.handleKey('B', time);

		// Buffer should have reset to 'B' because of the slow pause
		expect(handler.getBuffer()).toBe('B');

		time += 20;
		handler.handleKey('C', time);
		handler.handleKey('Enter', time + 20);

		expect(onScan).toHaveBeenCalledWith('BC');
	});

	it('ignores modifier keys without corrupting the scanner buffer', () => {
		const onScan = vi.fn();
		const handler = new ScannerHandler(onScan, 100);

		let time = 1000;
		handler.handleKey('S', time);
		time += 15;
		handler.handleKey('Shift', time); // Ignored
		time += 15;
		handler.handleKey('K', time);
		time += 15;
		handler.handleKey('U', time);
		time += 15;
		handler.handleKey('Enter', time);

		expect(onScan).toHaveBeenCalledWith('SKU');
	});
});

describe('ISSUE-004: Cart Table Calculations & Fractional Quantities', () => {
	it('calculates line subtotal with fractional quantities (NUMERIC 10,3)', () => {
		// Example: 1.750 meters of ribbon at $12.40 per meter
		const subtotal = calculateSubtotal(12.4, 1.75);
		expect(subtotal).toBe(21.7);
	});

	it('calculates total correctly across multiple fractional and integer items', () => {
		const items: CartItem[] = [
			{
				id: 'p1',
				sku_code: 'SKU-1',
				name: 'Cartulina Blanca',
				price: 6.5,
				stock: 100,
				quantity: 4
			}, // 4 * 6.5 = 26.00
			{
				id: 'p2',
				sku_code: 'SKU-2',
				name: 'Papel Crepé (metros)',
				price: 15.2,
				stock: 50,
				quantity: 2.5
			} // 2.5 * 15.2 = 38.00
		];

		const grandTotal = calculateTotal(items);
		expect(grandTotal).toBe(64.0);
	});
});

describe('ISSUE-004: Server-Side POS (+page.server.ts)', () => {
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
		formData?: FormData;
	}) {
		return {
			url: new URL('http://localhost:5173/caja'),
			locals: {
				user: options.user !== undefined ? options.user : { id: 'cajero-uuid-1', email: 'cajero@papeleria.local' },
				role: options.role !== undefined ? options.role : 'cajero',
				supabase: mockSupabase
			},
			request: {
				formData: vi.fn().mockResolvedValue(options.formData ?? new FormData())
			}
		} as unknown as RequestEvent;
	}

	it('load redirects unauthenticated user to /login with HTTP 303', async () => {
		const event = createMockEvent({ user: null, role: null });

		try {
			await load(event as any);
			expect.unreachable('Should have thrown a redirect');
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toBe('/login');
		}
	});

	it('load returns active products without exposing product_costs', async () => {
		const sampleProducts = [
			{
				id: 'p-1',
				sku_code: 'SKU-001',
				name: 'Lápiz 2B',
				price: 5.0,
				stock: 200.0,
				min_stock: 10.0,
				is_active: true
			}
		];

		const orderMock = vi.fn().mockResolvedValue({ data: sampleProducts, error: null });
		const eqMock = vi.fn().mockReturnValue({ order: orderMock });
		const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

		mockSupabase.from.mockReturnValue({ select: selectMock });

		const event = createMockEvent({ role: 'cajero' });
		const result: any = await load(event as any);

		expect(result.products).toHaveLength(1);
		expect(result.products[0].name).toBe('Lápiz 2B');
		expect(result.products[0].cost).toBeUndefined(); // Strictly no cost leaked
		expect(mockSupabase.from).not.toHaveBeenCalledWith('product_costs');
	});

	it('action checkout calls process_stock_outlet RPC with idempotency_key and exact items payload', async () => {
		const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
		const cartItems = [
			{ product_id: 'prod-uuid-1', quantity: 2 },
			{ product_id: 'prod-uuid-2', quantity: 1.5 }
		];

		const formData = new FormData();
		formData.append('items', JSON.stringify(cartItems));
		formData.append('idempotency_key', idempotencyKey);

		mockSupabase.rpc.mockResolvedValue({ data: 'outlet-uuid-999', error: null });

		const event = createMockEvent({ role: 'cajero', formData });
		const result: any = await (actions as any).checkout(event);

		expect(result.success).toBe(true);
		expect(result.outletId).toBe('outlet-uuid-999');
		expect(result.idempotencyKey).toBe(idempotencyKey);
		expect(mockSupabase.rpc).toHaveBeenCalledWith('process_stock_outlet', {
			p_items: [
				{ product_id: 'prod-uuid-1', quantity: 2 },
				{ product_id: 'prod-uuid-2', quantity: 1.5 }
			],
			p_idempotency_key: idempotencyKey
		});
	});

	it('action checkout fails with 400 when cart is empty', async () => {
		const formData = new FormData();
		formData.append('items', '[]');

		const event = createMockEvent({ role: 'cajero', formData });
		const result: any = await (actions as any).checkout(event);

		expect(result.status).toBe(400);
		expect(result.data.error).toContain('al menos un producto');
		expect(mockSupabase.rpc).not.toHaveBeenCalled();
	});

	it('action checkout handles RPC error (insufficient stock) preserving idempotencyKey for retry', async () => {
		const idempotencyKey = 'retry-uuid-key-1234';
		const cartItems = [{ product_id: 'prod-no-stock', quantity: 999 }];

		const formData = new FormData();
		formData.append('items', JSON.stringify(cartItems));
		formData.append('idempotency_key', idempotencyKey);

		mockSupabase.rpc.mockResolvedValue({
			data: null,
			error: { message: 'Stock insuficiente para el producto' }
		});

		const event = createMockEvent({ role: 'cajero', formData });
		const result: any = await (actions as any).checkout(event);

		expect(result.status).toBe(400);
		expect(result.data.error).toContain('Stock insuficiente');
		expect(result.data.idempotencyKey).toBe(idempotencyKey); // Key preserved for safe retry
	});
});
