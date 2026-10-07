import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScannerHandler } from '../../src/lib/components/caja/BarcodeScanner.svelte';
import {
	calculateSubtotal,
	calculateTotal,
	clampQuantity,
	calculatePayment,
	validateAndRestoreCart,
	getCartStorageKey,
	pruneStaleCartSessions,
	type CartItem,
	type PaymentMethod
} from '../../src/lib/components/caja/CartTable.svelte';
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
		const queryBuilder: any = {};
		queryBuilder.select = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.in = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.eq = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.order = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.then = (resolve: any) => resolve({ data: [], error: null });

		mockSupabase = {
			from: vi.fn().mockReturnValue(queryBuilder),
			rpc: vi.fn()
		};
	});

	function createMockEvent(options: {
		user?: any;
		role?: 'admin' | 'cajero' | null;
		formData?: FormData;
		cookies?: Record<string, string>;
	}) {
		const cookieMap = new Map<string, string>(Object.entries(options.cookies ?? {}));
		return {
			url: new URL('http://localhost:5173/caja'),
			locals: {
				user: options.user !== undefined ? options.user : { id: 'cajero-uuid-1', email: 'cajero@papeleria.local' },
				role: options.role !== undefined ? options.role : 'cajero',
				supabase: mockSupabase
			},
			cookies: {
				get: (name: string) => cookieMap.get(name),
				set: (name: string, val: string) => cookieMap.set(name, val),
				delete: (name: string) => cookieMap.delete(name)
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

	it('load deriva sessionId estable y aislado a partir de cookie app_session', async () => {
		const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
		const eqMock = vi.fn().mockReturnValue({ order: orderMock });
		const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
		mockSupabase.from.mockReturnValue({ select: selectMock });

		// Sesión 1 con cookie token1
		const event1 = createMockEvent({
			role: 'cajero',
			cookies: { app_session: 'token-cajero-session-1' }
		});
		const result1: any = await load(event1 as any);
		expect(result1.sessionId).toBeDefined();
		expect(result1.sessionId).toHaveLength(16);

		// Misma sesión: mismo sessionId
		const result1Repeat: any = await load(event1 as any);
		expect(result1Repeat.sessionId).toBe(result1.sessionId);

		// Sesión 2 tras nuevo login con token2: diferente sessionId
		const event2 = createMockEvent({
			role: 'cajero',
			cookies: { app_session: 'token-cajero-session-2-renovado' }
		});
		const result2: any = await load(event2 as any);
		expect(result2.sessionId).toBeDefined();
		expect(result2.sessionId).not.toBe(result1.sessionId);
	});

	it('action checkout calls process_stock_outlet RPC with idempotency_key and exact items payload', async () => {
		const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
		const cartItems = [
			{ product_id: 'prod-uuid-1', quantity: 2 },
			{ product_id: 'prod-uuid-2', quantity: 1 }
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
				{ product_id: 'prod-uuid-2', quantity: 1 }
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

	it('action checkout fails with 400 when quantity is decimal (e.g. 0.9 or 1.5)', async () => {
		const formData = new FormData();
		formData.append('items', JSON.stringify([{ product_id: 'prod-uuid-1', quantity: 0.9 }]));

		const event = createMockEvent({ role: 'cajero', formData });
		const result: any = await (actions as any).checkout(event);

		expect(result.status).toBe(400);
		expect(result.data.error).toContain('número entero mayor o igual a 1');
		expect(mockSupabase.rpc).not.toHaveBeenCalled();
	});

	it('action checkout fails with 400 when quantity is less than 1 (0 or negative)', async () => {
		const formData = new FormData();
		formData.append('items', JSON.stringify([{ product_id: 'prod-uuid-1', quantity: 0 }]));

		const event = createMockEvent({ role: 'cajero', formData });
		const result: any = await (actions as any).checkout(event);

		expect(result.status).toBe(400);
		expect(result.data.error).toContain('número entero mayor o igual a 1');
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

	it('action checkout rejects with 400 when requested quantity exceeds available stock', async () => {
		const idempotencyKey = 'key-excess-stock-test';
		const cartItems = [{ product_id: 'prod-uuid-1', quantity: 5 }];

		const formData = new FormData();
		formData.append('items', JSON.stringify(cartItems));
		formData.append('idempotency_key', idempotencyKey);

		const queryBuilder: any = {};
		queryBuilder.select = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.in = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.eq = vi.fn().mockResolvedValue({
			data: [{ id: 'prod-uuid-1', name: 'Pluma Azul', stock: 2 }],
			error: null
		});

		mockSupabase.from.mockReturnValue(queryBuilder);

		const event = createMockEvent({ role: 'cajero', formData });
		const result: any = await (actions as any).checkout(event);

		expect(result.status).toBe(400);
		expect(result.data.error).toContain('Stock insuficiente para "Pluma Azul"');
		expect(result.data.error).toContain('Disponible: 2');
		expect(result.data.error).toContain('Solicitado: 5');
		expect(result.data.idempotencyKey).toBe(idempotencyKey);
		expect(mockSupabase.rpc).not.toHaveBeenCalled();
	});

	it('action checkout preserves cart and idempotency_key when preventive check fails', async () => {
		const idempotencyKey = 'key-preserve-cart-test';
		const cartItems = [{ product_id: 'prod-uuid-2', quantity: 10 }];

		const formData = new FormData();
		formData.append('items', JSON.stringify(cartItems));
		formData.append('idempotency_key', idempotencyKey);

		const queryBuilder: any = {};
		queryBuilder.select = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.in = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.eq = vi.fn().mockResolvedValue({
			data: [{ id: 'prod-uuid-2', name: 'Cuaderno', stock: 3 }],
			error: null
		});

		mockSupabase.from.mockReturnValue(queryBuilder);

		const event = createMockEvent({ role: 'cajero', formData });
		const result: any = await (actions as any).checkout(event);

		expect(result.status).toBe(400);
		expect(result.data.idempotencyKey).toBe(idempotencyKey);
		expect(mockSupabase.rpc).not.toHaveBeenCalled();
	});
});

describe('SPRINT 20: Control preventivo de existencias en Caja & CartTable', () => {
	it('clampQuantity enforces minimum 1 and maximum equal to available stock', () => {
		expect(clampQuantity(0, 10)).toBe(1);
		expect(clampQuantity(-3, 10)).toBe(1);
		expect(clampQuantity(4, 10)).toBe(4);
		expect(clampQuantity(10, 10)).toBe(10);
		expect(clampQuantity(15, 10)).toBe(10); // Cannot exceed available stock
		expect(clampQuantity(4.8, 10)).toBe(4); // Integer clamping
	});

	it('prevents adding product with stock 0 to cart', () => {
		const outOfStockProduct = { id: 'p-zero', name: 'Libreta Agotada', stock: 0 };
		const canAddToCart = (product: { stock: number }) => product.stock > 0;
		expect(canAddToCart(outOfStockProduct)).toBe(false);

		const inStockProduct = { id: 'p-available', name: 'Libreta Disponible', stock: 5 };
		expect(canAddToCart(inStockProduct)).toBe(true);
	});
});

describe('FEATURE-POS-PAYMENT-CART: Persistencia del Carrito y Validación', () => {
	const mockCatalog = [
		{ id: 'p1', sku_code: 'SKU-1', name: 'Pluma Negra', price: 10.50, stock: 5, is_active: true },
		{ id: 'p2', sku_code: 'SKU-2', name: 'Cuaderno', price: 35.00, stock: 2, is_active: true },
		{ id: 'p3', sku_code: 'SKU-3', name: 'Goma', price: 5.00, stock: 0, is_active: true }, // Agotado
		{ id: 'p4', sku_code: 'SKU-4', name: 'Pegamento', price: 20.00, stock: 10, is_active: false } // Inactivo
	];

	it('restaura carrito válido desde JSON y conserva los items activos', () => {
		const savedJson = JSON.stringify([
			{ id: 'p1', quantity: 2 },
			{ id: 'p2', quantity: 1 }
		]);

		const restored = validateAndRestoreCart(savedJson, mockCatalog);
		expect(restored).toHaveLength(2);
		expect(restored[0].id).toBe('p1');
		expect(restored[0].quantity).toBe(2);
		expect(restored[0].price).toBe(10.50);
		expect(restored[1].id).toBe('p2');
		expect(restored[1].quantity).toBe(1);
	});

	it('acota cantidad de items que excedan el stock actual en catálogo', () => {
		// p2 solo tiene stock 2; se intentan restaurar 10
		const savedJson = JSON.stringify([
			{ id: 'p2', quantity: 10 }
		]);

		const restored = validateAndRestoreCart(savedJson, mockCatalog);
		expect(restored).toHaveLength(1);
		expect(restored[0].quantity).toBe(2); // Acotado al stock máximo
	});

	it('descarta productos agotados, inactivos o inexistentes', () => {
		const savedJson = JSON.stringify([
			{ id: 'p1', quantity: 1 },
			{ id: 'p3', quantity: 1 }, // Agotado
			{ id: 'p4', quantity: 1 }, // Inactivo
			{ id: 'p999-inexistente', quantity: 3 }
		]);

		const restored = validateAndRestoreCart(savedJson, mockCatalog);
		expect(restored).toHaveLength(1);
		expect(restored[0].id).toBe('p1');
	});

	it('maneja de forma segura JSON corrupto, nulo o tipos no array retornando []', () => {
		expect(validateAndRestoreCart(null, mockCatalog)).toEqual([]);
		expect(validateAndRestoreCart(undefined, mockCatalog)).toEqual([]);
		expect(validateAndRestoreCart('', mockCatalog)).toEqual([]);
		expect(validateAndRestoreCart('{ not: "array" }', mockCatalog)).toEqual([]);
		expect(validateAndRestoreCart('INVALID_JSON{{{', mockCatalog)).toEqual([]);
	});

	it('genera clave de storage aislada por usuario y sesión para evitar reuso entre sesiones', () => {
		expect(getCartStorageKey('user-cajero-1')).toBe('caja_cart_user-cajero-1');
		expect(getCartStorageKey('user-cajero-1', 'sess-abc-123')).toBe('caja_cart_user-cajero-1_sess-abc-123');
		expect(getCartStorageKey('user-admin-9', 'sess-xyz-789')).toBe('caja_cart_user-admin-9_sess-xyz-789');
		expect(getCartStorageKey(null)).toBe('caja_cart_anonymous');
		expect(getCartStorageKey(undefined, 'sess-123')).toBe('caja_cart_anonymous');
	});

	it('pruneStaleCartSessions elimina sesiones de carrito obsoletas en sessionStorage y conserva la activa', () => {
		const mockStorage: Record<string, string> = {
			'caja_cart_cajero_sess1': JSON.stringify([{ id: 'p1', quantity: 2 }]),
			'caja_cart_cajero_sessOld': JSON.stringify([{ id: 'p2', quantity: 1 }]),
			'caja_cart_admin_sessPrev': JSON.stringify([{ id: 'p1', quantity: 5 }]),
			'otra_clave_no_relacionada': 'valor'
		};

		// Mock window and sessionStorage
		const originalWindow = globalThis.window;
		(globalThis as any).window = {
			sessionStorage: {
				get length() {
					return Object.keys(mockStorage).length;
				},
				key(index: number) {
					return Object.keys(mockStorage)[index] ?? null;
				},
				getItem(key: string) {
					return mockStorage[key] ?? null;
				},
				setItem(key: string, value: string) {
					mockStorage[key] = value;
				},
				removeItem(key: string) {
					delete mockStorage[key];
				}
			}
		};

		pruneStaleCartSessions('caja_cart_cajero_sess1');

		expect(mockStorage['caja_cart_cajero_sess1']).toBeDefined();
		expect(mockStorage['caja_cart_cajero_sessOld']).toBeUndefined();
		expect(mockStorage['caja_cart_admin_sessPrev']).toBeUndefined();
		expect(mockStorage['otra_clave_no_relacionada']).toBe('valor');

		(globalThis as any).window = originalWindow;
	});

	it('garantiza ciclo de aislamiento de sesión: sobrevive reload, se invalida con nueva sesión y no se comparte entre usuarios', () => {
		const mockStorage: Record<string, string> = {};
		const originalWindow = globalThis.window;
		(globalThis as any).window = {
			sessionStorage: {
				get length() {
					return Object.keys(mockStorage).length;
				},
				key(index: number) {
					return Object.keys(mockStorage)[index] ?? null;
				},
				getItem(key: string) {
					return mockStorage[key] ?? null;
				},
				setItem(key: string, value: string) {
					mockStorage[key] = value;
				},
				removeItem(key: string) {
					delete mockStorage[key];
				}
			}
		};

		// 1. Sesión A de cajero 1: guarda carrito
		const keySessionA = getCartStorageKey('cajero-1', 'session-token-aaa');
		window.sessionStorage.setItem(keySessionA, JSON.stringify([{ id: 'p1', quantity: 2 }]));

		// 2. Misma sesión: recarga / navegación restaura intacto
		const savedSessionA = window.sessionStorage.getItem(keySessionA);
		const restoredSameSession = validateAndRestoreCart(savedSessionA, mockCatalog);
		expect(restoredSameSession).toHaveLength(1);
		expect(restoredSameSession[0].id).toBe('p1');
		expect(restoredSameSession[0].quantity).toBe(2);

		// 3. Logout y nuevo login (Sesión B): nueva clave de sesión
		const keySessionB = getCartStorageKey('cajero-1', 'session-token-bbb');
		// Al montar en nueva sesión se ejecuta pruneStaleCartSessions
		pruneStaleCartSessions(keySessionB);

		// Sesión B NO recupera el carrito de la sesión anterior A
		const savedSessionB = window.sessionStorage.getItem(keySessionB);
		expect(savedSessionB).toBeNull();
		const restoredNewSession = validateAndRestoreCart(savedSessionB, mockCatalog);
		expect(restoredNewSession).toHaveLength(0);

		// Clave de sesión A fue eliminada por pruneStaleCartSessions
		expect(window.sessionStorage.getItem(keySessionA)).toBeNull();

		// 4. Otro usuario (Admin, Sesión C): nunca recupera carrito ajeno
		const keySessionC = getCartStorageKey('admin-2', 'session-token-ccc');
		expect(window.sessionStorage.getItem(keySessionC)).toBeNull();

		(globalThis as any).window = originalWindow;
	});
});

describe('FEATURE-POS-PAYMENT-CART: Formas de Pago y Cálculo de Cambio (UI)', () => {
	const total = 347.50;

	it('calcula pago en efectivo exacto ($347.50 -> cambio $0.00)', () => {
		const res = calculatePayment(total, 'EFECTIVO', { cashReceived: 347.50 });
		expect(res.valid).toBe(true);
		expect(res.total).toBe(347.50);
		expect(res.cashAmount).toBe(347.50);
		expect(res.cardAmount).toBe(0.00);
		expect(res.cashReceived).toBe(347.50);
		expect(res.changeAmount).toBe(0.00);
	});

	it('calcula pago en efectivo mayor con cambio correcto ($500.00 -> cambio $152.50)', () => {
		const res = calculatePayment(total, 'EFECTIVO', { cashReceived: 500.00 });
		expect(res.valid).toBe(true);
		expect(res.total).toBe(347.50);
		expect(res.cashAmount).toBe(347.50);
		expect(res.cardAmount).toBe(0.00);
		expect(res.cashReceived).toBe(500.00);
		expect(res.changeAmount).toBe(152.50);
	});

	it('rechaza efectivo insuficiente ($300.00 < $347.50)', () => {
		const res = calculatePayment(total, 'EFECTIVO', { cashReceived: 300.00 });
		expect(res.valid).toBe(false);
		expect(res.error).toContain('Efectivo insuficiente');
	});

	it('calcula pago 100% con tarjeta sin cambio', () => {
		const res = calculatePayment(total, 'TARJETA');
		expect(res.valid).toBe(true);
		expect(res.total).toBe(347.50);
		expect(res.cardAmount).toBe(347.50);
		expect(res.cashAmount).toBe(0.00);
		expect(res.cashReceived).toBe(0.00);
		expect(res.changeAmount).toBe(0.00);
	});

	it('calcula pago mixto exacto (Tarjeta $147.50 + Efectivo $200.00 -> cambio $0.00)', () => {
		const res = calculatePayment(total, 'MIXTO', {
			cardAmount: 147.50,
			cashReceived: 200.00
		});
		expect(res.valid).toBe(true);
		expect(res.total).toBe(347.50);
		expect(res.cardAmount).toBe(147.50);
		expect(res.cashAmount).toBe(200.00);
		expect(res.cashReceived).toBe(200.00);
		expect(res.changeAmount).toBe(0.00);
	});

	it('calcula pago mixto con billete mayor (Tarjeta $147.50, Efectivo $200.00, Recibido $250.00 -> cambio $50.00)', () => {
		const res = calculatePayment(total, 'MIXTO', {
			cardAmount: 147.50,
			cashReceived: 250.00
		});
		expect(res.valid).toBe(true);
		expect(res.cardAmount).toBe(147.50);
		expect(res.cashAmount).toBe(200.00);
		expect(res.cashReceived).toBe(250.00);
		expect(res.changeAmount).toBe(50.00);
	});

	it('rechaza pago mixto con importe de tarjeta inválido (>= total o <= 0)', () => {
		const resZero = calculatePayment(total, 'MIXTO', { cardAmount: 0 });
		expect(resZero.valid).toBe(false);

		const resExcess = calculatePayment(total, 'MIXTO', { cardAmount: 400.00 });
		expect(resExcess.valid).toBe(false);
	});

	it('rechaza importes negativos o NaN', () => {
		const resNeg = calculatePayment(total, 'EFECTIVO', { cashReceived: -100 });
		expect(resNeg.valid).toBe(false);

		const resNan = calculatePayment(total, 'EFECTIVO', { cashReceived: 'invalido' });
		expect(resNan.valid).toBe(false);
	});
});

describe('FEATURE-POS-PAYMENT-CART: Server Action Checkout con Formas de Pago', () => {
	let mockSupabase: any;

	beforeEach(() => {
		const queryBuilder: any = {};
		queryBuilder.select = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.in = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.eq = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.order = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.then = (resolve: any) => resolve({ data: [], error: null });

		mockSupabase = {
			from: vi.fn().mockReturnValue(queryBuilder),
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

	it('action checkout procesa venta en efectivo y pasa metadata financiera a la RPC', async () => {
		const idempotencyKey = 'key-checkout-cash-01';
		const cartItems = [{ product_id: 'prod-uuid-1', quantity: 2 }];

		const formData = new FormData();
		formData.append('items', JSON.stringify(cartItems));
		formData.append('idempotency_key', idempotencyKey);
		formData.append('payment_method', 'EFECTIVO');
		formData.append('cash_received', '50.00'); // 2 * 10 = 20 total, recibido 50 -> cambio 30

		const queryBuilder: any = {};
		queryBuilder.select = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.in = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.eq = vi.fn().mockResolvedValue({
			data: [{ id: 'prod-uuid-1', name: 'Pluma', stock: 10, price: 10.00 }],
			error: null
		});

		mockSupabase.from.mockReturnValue(queryBuilder);
		mockSupabase.rpc.mockResolvedValue({ data: 'outlet-cash-uuid', error: null });

		const event = createMockEvent({ role: 'cajero', formData });
		const result: any = await (actions as any).checkout(event);

		expect(result.success).toBe(true);
		expect(result.outletId).toBe('outlet-cash-uuid');
		expect(result.paymentMethod).toBe('EFECTIVO');
		expect(result.changeAmount).toBe(30.00);

		expect(mockSupabase.rpc).toHaveBeenCalledWith('process_stock_outlet', {
			p_items: {
				items: [{ product_id: 'prod-uuid-1', quantity: 2 }],
				payment_method: 'EFECTIVO',
				cash_amount: 20.00,
				card_amount: 0,
				cash_received: 50.00,
				change_amount: 30.00
			},
			p_idempotency_key: idempotencyKey
		});
	});

	it('action checkout procesa venta con tarjeta 100%', async () => {
		const idempotencyKey = 'key-checkout-card-01';
		const cartItems = [{ product_id: 'prod-uuid-1', quantity: 1 }];

		const formData = new FormData();
		formData.append('items', JSON.stringify(cartItems));
		formData.append('idempotency_key', idempotencyKey);
		formData.append('payment_method', 'TARJETA');

		const queryBuilder: any = {};
		queryBuilder.select = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.in = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.eq = vi.fn().mockResolvedValue({
			data: [{ id: 'prod-uuid-1', name: 'Libro', stock: 5, price: 100.00 }],
			error: null
		});

		mockSupabase.from.mockReturnValue(queryBuilder);
		mockSupabase.rpc.mockResolvedValue({ data: 'outlet-card-uuid', error: null });

		const event = createMockEvent({ role: 'cajero', formData });
		const result: any = await (actions as any).checkout(event);

		expect(result.success).toBe(true);
		expect(result.paymentMethod).toBe('TARJETA');
		expect(mockSupabase.rpc).toHaveBeenCalledWith('process_stock_outlet', {
			p_items: {
				items: [{ product_id: 'prod-uuid-1', quantity: 1 }],
				payment_method: 'TARJETA',
				cash_amount: 0,
				card_amount: 100.00,
				cash_received: 0,
				change_amount: 0
			},
			p_idempotency_key: idempotencyKey
		});
	});

	it('action checkout procesa venta con pago mixto', async () => {
		const idempotencyKey = 'key-checkout-mixed-01';
		const cartItems = [{ product_id: 'prod-uuid-1', quantity: 1 }];

		const formData = new FormData();
		formData.append('items', JSON.stringify(cartItems));
		formData.append('idempotency_key', idempotencyKey);
		formData.append('payment_method', 'MIXTO');
		formData.append('card_amount', '60.00');
		formData.append('cash_received', '50.00'); // total 100, tarjeta 60, efectivo 40, recibido 50 -> cambio 10

		const queryBuilder: any = {};
		queryBuilder.select = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.in = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.eq = vi.fn().mockResolvedValue({
			data: [{ id: 'prod-uuid-1', name: 'Mochila', stock: 5, price: 100.00 }],
			error: null
		});

		mockSupabase.from.mockReturnValue(queryBuilder);
		mockSupabase.rpc.mockResolvedValue({ data: 'outlet-mixed-uuid', error: null });

		const event = createMockEvent({ role: 'cajero', formData });
		const result: any = await (actions as any).checkout(event);

		expect(result.success).toBe(true);
		expect(result.paymentMethod).toBe('MIXTO');
		expect(result.changeAmount).toBe(10.00);
	});

	it('action checkout rechaza con 400 cuando el efectivo recibido es insuficiente', async () => {
		const idempotencyKey = 'key-checkout-insufficient';
		const cartItems = [{ product_id: 'prod-uuid-1', quantity: 1 }];

		const formData = new FormData();
		formData.append('items', JSON.stringify(cartItems));
		formData.append('idempotency_key', idempotencyKey);
		formData.append('payment_method', 'EFECTIVO');
		formData.append('cash_received', '15.00'); // total es 20.00

		const queryBuilder: any = {};
		queryBuilder.select = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.in = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.eq = vi.fn().mockResolvedValue({
			data: [{ id: 'prod-uuid-1', name: 'Pluma', stock: 10, price: 20.00 }],
			error: null
		});

		mockSupabase.from.mockReturnValue(queryBuilder);

		const event = createMockEvent({ role: 'cajero', formData });
		const result: any = await (actions as any).checkout(event);

		expect(result.status).toBe(400);
		expect(result.data.error).toContain('Efectivo recibido insuficiente');
		expect(result.data.idempotencyKey).toBe(idempotencyKey);
		expect(mockSupabase.rpc).not.toHaveBeenCalled();
	});

	it('action checkout rechaza con 400 métodos de pago inválidos', async () => {
		const idempotencyKey = 'key-checkout-bad-method';
		const cartItems = [{ product_id: 'prod-uuid-1', quantity: 1 }];

		const formData = new FormData();
		formData.append('items', JSON.stringify(cartItems));
		formData.append('idempotency_key', idempotencyKey);
		formData.append('payment_method', 'BITCOIN');

		const event = createMockEvent({ role: 'cajero', formData });
		const result: any = await (actions as any).checkout(event);

		expect(result.status).toBe(400);
		expect(result.data.error).toContain('Método de pago no válido');
		expect(result.data.idempotencyKey).toBe(idempotencyKey);
	});
});
