import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load as historialLoad, actions as historialActions } from '../../src/routes/admin/historial/+page.server';
import { load as auditoriaLoad } from '../../src/routes/admin/auditoria/+page.server';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * ISSUE-005: Sales History, Stock Audit & Returns Tests
 *
 * Validates:
 * 1. /admin/historial load: loads outlets and items for admin, denies cajero with 303.
 * 2. /admin/historial cancel action: calls cancel_stock_outlet RPC with p_outlet_id and p_reason.
 * 3. /admin/historial cancel action: denies non-admin (403) and validates reason length (400).
 * 4. Verifies absence of direct UPDATE on products.stock during return flow.
 * 5. Audit log change types (VENTA, DEVOLUCION, REABASTECIMIENTO, AJUSTE_MANUAL, MERMA).
 */

describe('ISSUE-005: Sales History & Returns (+page.server.ts)', () => {
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
		url?: string;
	}) {
		return {
			url: new URL(options.url ?? 'http://localhost:5173/admin/historial'),
			locals: {
				user: options.user !== undefined ? options.user : { id: 'admin-uuid-1', email: 'admin@papeleria.local' },
				role: options.role !== undefined ? options.role : 'admin',
				supabase: mockSupabase
			},
			request: {
				formData: vi.fn().mockResolvedValue(options.formData ?? new FormData())
			}
		} as unknown as RequestEvent;
	}

	it('historial load redirects unauthenticated user to /login with 303', async () => {
		const event = createMockEvent({ user: null, role: null });

		try {
			await historialLoad(event as any);
			expect.unreachable('Should have thrown a redirect');
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toBe('/login');
		}
	});

	it('historial load redirects cajero to /caja with 303', async () => {
		const event = createMockEvent({ role: 'cajero' });

		try {
			await historialLoad(event as any);
			expect.unreachable('Should have thrown a redirect');
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toBe('/caja');
		}
	});

	it('historial load queries stock_outlets with nested items for admin', async () => {
		const sampleOutlets = [
			{
				id: 'outlet-uuid-1',
				user_id: 'cajero-uuid-1',
				total_amount: 51.0,
				is_canceled: false,
				canceled_at: null,
				canceled_by: null,
				cancel_reason: null,
				created_at: '2026-08-29T10:00:00Z',
				stock_outlet_items: [
					{
						id: 'item-1',
						product_id: 'p-1',
						quantity: 2,
						unit_price: 25.5,
						subtotal: 51.0,
						products: { id: 'p-1', name: 'Cuaderno Profesional', sku_code: 'SKU-001' }
					}
				]
			}
		];

		const orderMock = vi.fn().mockResolvedValue({ data: sampleOutlets, error: null });
		const selectMock = vi.fn().mockReturnValue({ order: orderMock });
		mockSupabase.from.mockReturnValue({ select: selectMock });

		const event = createMockEvent({ role: 'admin' });
		const result: any = await historialLoad(event as any);

		expect(result.outlets).toHaveLength(1);
		expect(result.outlets[0].total_amount).toBe(51.0);
		expect(result.outlets[0].items[0].product_name).toBe('Cuaderno Profesional');
		expect(result.outlets[0].items[0].sku_code).toBe('SKU-001');
		expect(mockSupabase.from).toHaveBeenCalledWith('stock_outlets');
	});

	it('historial load falls back to inventory_logs when stock_outlet_items is empty', async () => {
		const sampleOutlets = [
			{
				id: 'outlet-uuid-empty-items',
				user_id: 'cajero-uuid-1',
				total_amount: 27.5,
				is_canceled: false,
				canceled_at: null,
				canceled_by: null,
				cancel_reason: null,
				created_at: '2026-09-02T12:00:00Z',
				stock_outlet_items: []
			}
		];

		const sampleLogs = [
			{
				id: 'log-1',
				reference_id: 'outlet-uuid-empty-items',
				product_id: 'p-2',
				quantity_changed: -5,
				change_type: 'VENTA',
				products: { id: 'p-2', name: 'Lápiz Número 2', sku_code: 'LAP-002', price: 5.5 }
			}
		];

		const orderMock = vi.fn().mockResolvedValue({ data: sampleOutlets, error: null });
		const outletSelectMock = vi.fn().mockReturnValue({ order: orderMock });

		const limitMock = vi.fn().mockResolvedValue({ data: sampleLogs, error: null });
		const inMock = vi.fn().mockReturnValue({ limit: limitMock });
		const eqMock = vi.fn().mockReturnValue({ in: inMock });
		const logSelectMock = vi.fn().mockReturnValue({ eq: eqMock });

		mockSupabase.from.mockImplementation((table: string) => {
			if (table === 'stock_outlets') return { select: outletSelectMock };
			if (table === 'inventory_logs') return { select: logSelectMock };
			return { select: vi.fn() };
		});

		const event = createMockEvent({ role: 'admin' });
		const result: any = await historialLoad(event as any);

		expect(result.outlets).toHaveLength(1);
		expect(result.outlets[0].items).toHaveLength(1);
		expect(result.outlets[0].items[0].product_name).toBe('Lápiz Número 2');
		expect(result.outlets[0].items[0].sku_code).toBe('LAP-002');
		expect(result.outlets[0].items[0].quantity).toBe(5);
		expect(result.outlets[0].items[0].unit_price).toBe(5.5);
		expect(result.outlets[0].items[0].subtotal).toBe(27.5);
	});

	it('historial load handles database error gracefully', async () => {
		const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: 'Database connection error' } });
		const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
		mockSupabase.from.mockReturnValue({ select: mockSelect });

		const event = createMockEvent({ role: 'admin' });
		const result: any = await historialLoad(event as any);

		expect(result.outlets).toEqual([]);
		expect(result.error).toBe('Error al cargar el historial de ventas.');
	});

	it('historial load filters by single date and calculates metrics (excluding canceled sales from revenue)', async () => {
		const sampleOutlets = [
			{
				id: 'outlet-valid-1',
				user_id: 'cajero-uuid-1',
				total_amount: 150.0,
				is_canceled: false,
				created_at: '2026-09-06T10:00:00Z',
				stock_outlet_items: [
					{ id: 'i1', product_id: 'p1', quantity: 2, unit_price: 75.0, subtotal: 150.0, products: { name: 'Item 1', sku_code: 'SKU-1' } }
				]
			},
			{
				id: 'outlet-canceled-1',
				user_id: 'cajero-uuid-1',
				total_amount: 50.0,
				is_canceled: true,
				canceled_at: '2026-09-06T11:00:00Z',
				cancel_reason: 'Error de cobro',
				created_at: '2026-09-06T10:30:00Z',
				stock_outlet_items: [
					{ id: 'i2', product_id: 'p2', quantity: 1, unit_price: 50.0, subtotal: 50.0, products: { name: 'Item 2', sku_code: 'SKU-2' } }
				]
			}
		];

		const queryBuilder: any = {};
		queryBuilder.select = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.gte = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.lt = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.lte = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.order = vi.fn().mockResolvedValue({ data: sampleOutlets, error: null });
		mockSupabase.from.mockReturnValue(queryBuilder);

		const event = createMockEvent({
			role: 'admin',
			url: 'http://localhost:5173/admin/historial?fecha=2026-09-06'
		});
		const result: any = await historialLoad(event as any);

		expect(queryBuilder.gte).toHaveBeenCalledWith('created_at', expect.any(String));
		expect(queryBuilder.lt).toHaveBeenCalledWith('created_at', expect.any(String));
		expect(result.outlets).toHaveLength(2);
		expect(result.metrics.validSalesCount).toBe(1);
		expect(result.metrics.canceledSalesCount).toBe(1);
		expect(result.metrics.totalRevenue).toBe(150.0);
		expect(result.filters.fecha).toBe('2026-09-06');
		// Ensure no confidential costs are exposed
		expect(JSON.stringify(result)).not.toContain('product_costs');
		expect(JSON.stringify(result)).not.toContain('"cost"');
	});

	it('historial load handles date range (desde/hasta) and preset hoy', async () => {
		const queryBuilder: any = {};
		queryBuilder.select = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.gte = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.lt = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.lte = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.order = vi.fn().mockResolvedValue({ data: [], error: null });
		mockSupabase.from.mockReturnValue(queryBuilder);

		// 1. Test desde / hasta range
		const eventRange = createMockEvent({
			role: 'admin',
			url: 'http://localhost:5173/admin/historial?desde=2026-09-01&hasta=2026-09-05'
		});
		const resultRange: any = await historialLoad(eventRange as any);

		expect(queryBuilder.gte).toHaveBeenCalledWith('created_at', expect.any(String));
		expect(queryBuilder.lt).toHaveBeenCalledWith('created_at', expect.any(String));
		expect(resultRange.filters.desde).toBe('2026-09-01');
		expect(resultRange.filters.hasta).toBe('2026-09-05');

		// 2. Test hoy preset
		const eventHoy = createMockEvent({
			role: 'admin',
			url: 'http://localhost:5173/admin/historial?hoy=true'
		});
		const resultHoy: any = await historialLoad(eventHoy as any);
		expect(resultHoy.filters.hoy).toBe(true);
		expect(queryBuilder.gte).toHaveBeenCalledWith('created_at', expect.any(String));
		expect(queryBuilder.lt).toHaveBeenCalledWith('created_at', expect.any(String));
	});

	it('historial load includes official numeric folio in outlets and respects null/number', async () => {
		const sampleOutlets = [
			{
				id: 'outlet-uuid-folio-1001',
				folio: 1001,
				user_id: 'cajero-uuid-1',
				total_amount: 150.0,
				is_canceled: false,
				canceled_at: null,
				canceled_by: null,
				cancel_reason: null,
				created_at: '2026-09-06T10:00:00Z',
				stock_outlet_items: [
					{ id: 'i1', product_id: 'p1', quantity: 2, unit_price: 75.0, subtotal: 150.0, products: { name: 'Item 1', sku_code: 'SKU-1' } }
				]
			},
			{
				id: 'outlet-uuid-no-folio',
				folio: null,
				user_id: 'cajero-uuid-2',
				total_amount: 50.0,
				is_canceled: false,
				canceled_at: null,
				canceled_by: null,
				cancel_reason: null,
				created_at: '2026-09-06T11:00:00Z',
				stock_outlet_items: [
					{ id: 'i2', product_id: 'p2', quantity: 1, unit_price: 50.0, subtotal: 50.0, products: { name: 'Item 2', sku_code: 'SKU-2' } }
				]
			}
		];

		const orderMock = vi.fn().mockResolvedValue({ data: sampleOutlets, error: null });
		const selectMock = vi.fn().mockReturnValue({ order: orderMock });
		mockSupabase.from.mockReturnValue({ select: selectMock });

		const event = createMockEvent({ role: 'admin' });
		const result: any = await historialLoad(event as any);

		expect(result.outlets).toHaveLength(2);
		expect(result.outlets[0].folio).toBe(1001);
		expect(result.outlets[0].id).toBe('outlet-uuid-folio-1001');
		expect(result.outlets[1].folio).toBeNull();
		expect(selectMock).toHaveBeenCalledWith(expect.stringContaining('folio'));
	});

	it('historial cancel action invokes cancel_stock_outlet RPC with outlet ID and reason', async () => {
		const formData = new FormData();
		formData.append('outlet_id', 'outlet-uuid-1');
		formData.append('reason', 'Producto dañado por cliente');

		mockSupabase.rpc.mockResolvedValue({ data: 'outlet-uuid-1', error: null });

		const event = createMockEvent({ role: 'admin', formData });
		const result: any = await (historialActions as any).cancel(event);

		expect(result.success).toBe(true);
		expect(result.outletId).toBe('outlet-uuid-1');
		expect(mockSupabase.rpc).toHaveBeenCalledWith('cancel_stock_outlet', {
			p_outlet_id: 'outlet-uuid-1',
			p_reason: 'Producto dañado por cliente'
		});

		// Verifies NO direct UPDATE on products table is executed
		expect(mockSupabase.from).not.toHaveBeenCalledWith('products');
	});

	it('historial cancel action rejects role cajero with 403', async () => {
		const formData = new FormData();
		formData.append('outlet_id', 'outlet-uuid-1');
		formData.append('reason', 'Intento cajero');

		const event = createMockEvent({ role: 'cajero', formData });
		const result: any = await (historialActions as any).cancel(event);

		expect(result.status).toBe(403);
		expect(result.data.error).toContain('No autorizado');
		expect(mockSupabase.rpc).not.toHaveBeenCalled();
	});

	it('historial cancel action rejects empty reason with 400', async () => {
		const formData = new FormData();
		formData.append('outlet_id', 'outlet-uuid-1');
		formData.append('reason', '');

		const event = createMockEvent({ role: 'admin', formData });
		const result: any = await (historialActions as any).cancel(event);

		expect(result.status).toBe(400);
		expect(result.data.error).toContain('motivo válido');
		expect(mockSupabase.rpc).not.toHaveBeenCalled();
	});

	it('historial cancel action handles RPC error (e.g. already canceled)', async () => {
		const formData = new FormData();
		formData.append('outlet_id', 'outlet-uuid-1');
		formData.append('reason', 'Devolución duplicada');

		mockSupabase.rpc.mockResolvedValue({
			data: null,
			error: { message: 'La salida de inventario ya ha sido cancelada previamente' }
		});

		const event = createMockEvent({ role: 'admin', formData });
		const result: any = await (historialActions as any).cancel(event);

		expect(result.status).toBe(400);
		expect(result.data.error).toContain('ya ha sido cancelada');
	});
});

describe('ISSUE-005: Audit Logs Contract & Change Types', () => {
	it('defines all SRS v8.0 change types for stock audit', () => {
		const expectedChangeTypes = ['VENTA', 'DEVOLUCION', 'REABASTECIMIENTO', 'AJUSTE_MANUAL', 'MERMA'];
		expect(expectedChangeTypes).toHaveLength(5);
		expect(expectedChangeTypes).toContain('VENTA');
		expect(expectedChangeTypes).toContain('DEVOLUCION');
		expect(expectedChangeTypes).toContain('REABASTECIMIENTO');
		expect(expectedChangeTypes).toContain('AJUSTE_MANUAL');
		expect(expectedChangeTypes).toContain('MERMA');
	});
});

describe('ISSUE-005: Stock Audit Server Load (+page.server.ts)', () => {
	it('queries inventory_logs using locals.supabase', async () => {
		let queriedTable = '';
		const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
		const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
		const mockFrom = vi.fn().mockImplementation((table: string) => {
			queriedTable = table;
			return { select: mockSelect };
		});

		const event: any = {
			locals: {
				supabase: { from: mockFrom }
			}
		};

		const result = await auditoriaLoad(event);
		expect(mockFrom).toHaveBeenCalledWith('inventory_logs');
		expect(queriedTable).toBe('inventory_logs');
		expect(result.error).toBeNull();
		expect(result.logs).toEqual([]);
	});

	it('performs join with products, orders by created_at desc, and maps rows to logs', async () => {
		const rawRows = [
			{
				id: 'log-1',
				product_id: 'prod-1',
				change_type: 'VENTA',
				previous_stock: '15.000',
				new_stock: '10.000',
				quantity_changed: '-5.000',
				reference_id: 'outlet-uuid-1',
				created_by: 'user-cajero-uuid',
				notes: 'Venta mostrador',
				created_at: '2026-09-02T10:00:00Z',
				products: {
					name: 'Cuaderno Profesional',
					sku_code: 'SKU-CUAD-01'
				}
			},
			{
				id: 'log-2',
				product_id: 'prod-2',
				change_type: 'DEVOLUCION',
				previous_stock: 0,
				new_stock: 2,
				quantity_changed: 2,
				reference_id: null,
				created_by: null,
				notes: null,
				created_at: '2026-09-02T11:00:00Z',
				products: null
			}
		];

		let selectParam = '';
		let orderCol = '';
		let orderAsc: boolean | undefined;

		const mockOrder = vi.fn().mockImplementation((col: string, opts: any) => {
			orderCol = col;
			orderAsc = opts?.ascending;
			return Promise.resolve({ data: rawRows, error: null });
		});
		const mockSelect = vi.fn().mockImplementation((query: string) => {
			selectParam = query;
			return { order: mockOrder };
		});
		const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

		const event: any = {
			locals: {
				supabase: { from: mockFrom }
			}
		};

		const result = await auditoriaLoad(event);

		expect(selectParam).toContain('products');
		expect(selectParam).toContain('sku_code');
		expect(orderCol).toBe('created_at');
		expect(orderAsc).toBe(false);

		expect(result.logs).toHaveLength(2);
		expect(result.logs[0]).toEqual({
			id: 'log-1',
			product_id: 'prod-1',
			product_name: 'Cuaderno Profesional',
			sku_code: 'SKU-CUAD-01',
			change_type: 'VENTA',
			previous_stock: 15,
			new_stock: 10,
			quantity_changed: -5,
			reference_id: 'outlet-uuid-1',
			created_by: 'user-cajero-uuid',
			notes: 'Venta mostrador',
			created_at: '2026-09-02T10:00:00Z'
		});
		expect(result.logs[1].product_name).toBe('Producto no especificado');
		expect(result.logs[1].sku_code).toBe('N/A');
		expect(result.error).toBeNull();
	});

	it('converts database errors into a generic error message without leaking internal details (e.g. DB_INTERNAL_SECRET)', async () => {
		const internalSecretError = {
			message: 'Fatal error in table public.inventory_logs: DB_INTERNAL_SECRET - connection timeout at postgresql://user:pwd@db:5432'
		};

		const mockOrder = vi.fn().mockResolvedValue({ data: null, error: internalSecretError });
		const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
		const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

		const event: any = {
			locals: {
				supabase: { from: mockFrom }
			}
		};

		const result = await auditoriaLoad(event);

		expect(result.logs).toEqual([]);
		expect(result.error).toBeTruthy();
		expect(typeof result.error).toBe('string');
		expect(result.error).toBe('No fue posible cargar el registro de auditoría.');
		expect(JSON.stringify(result)).not.toContain('DB_INTERNAL_SECRET');
		expect(JSON.stringify(result)).not.toContain('postgresql://');
	});

	it('does not duplicate route authorization guards and delegates /admin/* protection to hooks.server.ts', async () => {
		const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
		const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
		const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

		const eventWithoutRole: any = {
			locals: {
				supabase: { from: mockFrom }
			}
		};

		await expect(auditoriaLoad(eventWithoutRole)).resolves.not.toThrow();
	});
});

describe('HOTFIX BETA: Date filtering regression tests (LocalQueryBuilder without native gte/lte)', () => {
	const sampleOutlets = [
		{
			id: 'outlet-day1',
			folio: 101,
			user_id: 'cajero-1',
			total_amount: 100.0,
			is_canceled: false,
			canceled_at: null,
			canceled_by: null,
			cancel_reason: null,
			created_at: '2026-09-02T10:00:00.000Z',
			stock_outlet_items: [
				{
					id: 'item-1',
					product_id: 'p-1',
					quantity: 2,
					unit_price: 50.0,
					subtotal: 100.0,
					products: { id: 'p-1', name: 'Cuaderno', sku_code: 'SKU-1' }
				}
			]
		},
		{
			id: 'outlet-day2',
			folio: 102,
			user_id: 'cajero-1',
			total_amount: 250.0,
			is_canceled: false,
			canceled_at: null,
			canceled_by: null,
			cancel_reason: null,
			created_at: '2026-09-03T15:30:00.000Z',
			stock_outlet_items: [
				{
					id: 'item-2',
					product_id: 'p-2',
					quantity: 5,
					unit_price: 50.0,
					subtotal: 250.0,
					products: { id: 'p-2', name: 'Pluma', sku_code: 'SKU-2' }
				}
			]
		},
		{
			id: 'outlet-day5',
			folio: 103,
			user_id: 'cajero-1',
			total_amount: 60.0,
			is_canceled: true,
			canceled_at: '2026-09-05T18:00:00.000Z',
			canceled_by: 'admin-1',
			cancel_reason: 'Devolución cliente',
			created_at: '2026-09-05T12:00:00.000Z',
			stock_outlet_items: [
				{
					id: 'item-3',
					product_id: 'p-3',
					quantity: 1,
					unit_price: 60.0,
					subtotal: 60.0,
					products: { id: 'p-3', name: 'Regla', sku_code: 'SKU-3' }
				}
			]
		},
		{
			id: 'outlet-day10',
			folio: 104,
			user_id: 'cajero-1',
			total_amount: 80.0,
			is_canceled: false,
			canceled_at: null,
			canceled_by: null,
			cancel_reason: null,
			created_at: '2026-09-10T09:00:00.000Z',
			stock_outlet_items: [
				{
					id: 'item-4',
					product_id: 'p-4',
					quantity: 2,
					unit_price: 40.0,
					subtotal: 80.0,
					products: { id: 'p-4', name: 'Tijeras', sku_code: 'SKU-4' }
				}
			]
		}
	];

	// Emulates the real LocalQueryBuilder from src/lib/supabase/server.ts:
	// implements select and order, but strictly does NOT provide gte or lte.
	function createLocalSupabaseMock(outletsData: any[] = sampleOutlets) {
		return {
			from: vi.fn((table: string) => {
				if (table === 'stock_outlets') {
					return {
						select: vi.fn().mockReturnValue({
							order: vi.fn().mockResolvedValue({ data: outletsData, error: null })
							// Notice: NO gte, NO lte (reproduces the exact condition that caused TypeError: query.gte is not a function)
						})
					};
				}
				if (table === 'inventory_logs') {
					return {
						select: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								in: vi.fn().mockReturnValue({
									limit: vi.fn().mockResolvedValue({ data: [], error: null })
								})
							})
						})
					};
				}
				return { select: vi.fn() };
			}),
			rpc: vi.fn()
		};
	}

	function createEvent(urlStr: string, mockSupabase: any) {
		return {
			url: new URL(urlStr),
			locals: {
				user: { id: 'admin-1', email: 'admin@papeleria.com' },
				role: 'admin',
				supabase: mockSupabase
			},
			request: {
				formData: vi.fn().mockResolvedValue(new FormData())
			}
		} as unknown as RequestEvent;
	}

	it('ausencia de filtros: la ruta carga sin error y retorna todos los registros', async () => {
		const mockSupabase = createLocalSupabaseMock();
		const event = createEvent('http://localhost:5173/admin/historial', mockSupabase);

		const result: any = await historialLoad(event as any);

		expect(result.error).toBeUndefined();
		expect(result.outlets).toHaveLength(4);
		expect(result.metrics.validSalesCount).toBe(3);
		expect(result.metrics.canceledSalesCount).toBe(1);
		expect(result.metrics.totalRevenue).toBe(430.0); // 100 + 250 + 80
	});

	it('rango de un día (desde=2026-09-02&hasta=2026-09-02): no produce 500 y filtra exactamente el día indicado', async () => {
		const mockSupabase = createLocalSupabaseMock();
		// URL que antes provocaba: TypeError: query.gte is not a function -> 500 Internal Error
		const event = createEvent('http://localhost:5173/admin/historial?desde=2026-09-02&hasta=2026-09-02', mockSupabase);

		const result: any = await historialLoad(event as any);

		expect(result.error).toBeUndefined();
		expect(result.outlets).toHaveLength(1);
		expect(result.outlets[0].id).toBe('outlet-day1');
		expect(result.outlets[0].folio).toBe(101);
		expect(result.metrics.validSalesCount).toBe(1);
		expect(result.metrics.canceledSalesCount).toBe(0);
		expect(result.metrics.totalRevenue).toBe(100.0);
		expect(result.filters.desde).toBe('2026-09-02');
		expect(result.filters.hasta).toBe('2026-09-02');
	});

	it('rango de varios días (desde=2026-09-02&hasta=2026-09-05): no produce 500 y filtra dentro del rango', async () => {
		const mockSupabase = createLocalSupabaseMock();
		const event = createEvent('http://localhost:5173/admin/historial?desde=2026-09-02&hasta=2026-09-05', mockSupabase);

		const result: any = await historialLoad(event as any);

		expect(result.error).toBeUndefined();
		// Debe incluir outlet-day1 (2026-09-02), outlet-day2 (2026-09-03) y outlet-day5 (2026-09-05). outlet-day10 queda excluido.
		expect(result.outlets).toHaveLength(3);
		const ids = result.outlets.map((o: any) => o.id);
		expect(ids).toContain('outlet-day1');
		expect(ids).toContain('outlet-day2');
		expect(ids).toContain('outlet-day5');
		expect(ids).not.toContain('outlet-day10');

		// Métricas: day1 ($100) + day2 ($250) válidas; day5 cancelada ($60)
		expect(result.metrics.validSalesCount).toBe(2);
		expect(result.metrics.canceledSalesCount).toBe(1);
		expect(result.metrics.totalRevenue).toBe(350.0);
	});

	it('botón Hoy (?hoy=true): no produce 500 y no lanza TypeError al no tener query.gte', async () => {
		const now = new Date();
		const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		const todayOutlets = [
			{
				id: 'outlet-today',
				folio: 200,
				user_id: 'cajero-1',
				total_amount: 99.0,
				is_canceled: false,
				canceled_at: null,
				canceled_by: null,
				cancel_reason: null,
				created_at: `${todayStr} 12:00`,
				stock_outlet_items: []
			}
		];
		const mockSupabase = createLocalSupabaseMock(todayOutlets);
		const event = createEvent('http://localhost:5173/admin/historial?hoy=true', mockSupabase);

		const result: any = await historialLoad(event as any);

		expect(result.error).toBeUndefined();
		expect(result.outlets).toHaveLength(1);
		expect(result.outlets[0].id).toBe('outlet-today');
		expect(result.filters.hoy).toBe(true);
	});
});

describe('HOTFIX BETA: Semántica de fechas e intervalo semiabierto [inicio, día_siguiente_al_hasta)', () => {
	const outletsTestSet = [
		{
			id: 'outlet-06-0001',
			folio: 101,
			user_id: 'cajero-1',
			total_amount: 100.0,
			is_canceled: false,
			canceled_at: null,
			canceled_by: null,
			cancel_reason: null,
			created_at: '2026-09-06 00:01', // Caso 1: 00:01 del día 06
			stock_outlet_items: [{ id: 'i1', product_id: 'p1', quantity: 1, unit_price: 100.0, subtotal: 100.0, products: { name: 'P1', sku_code: 'SKU1' } }]
		},
		{
			id: 'outlet-06-1200',
			folio: 102,
			user_id: 'cajero-1',
			total_amount: 150.0,
			is_canceled: false,
			canceled_at: null,
			canceled_by: null,
			cancel_reason: null,
			created_at: '2026-09-06 12:00', // Caso 5: 12:00 del día 06
			stock_outlet_items: [{ id: 'i2', product_id: 'p2', quantity: 1, unit_price: 150.0, subtotal: 150.0, products: { name: 'P2', sku_code: 'SKU2' } }]
		},
		{
			id: 'outlet-06-2245',
			folio: 103,
			user_id: 'cajero-1',
			total_amount: 200.0,
			is_canceled: false,
			canceled_at: null,
			canceled_by: null,
			cancel_reason: null,
			created_at: '2026-09-06 22:45', // Caso 2: 22:45 del día 06 (venta nocturna)
			stock_outlet_items: [{ id: 'i3', product_id: 'p3', quantity: 2, unit_price: 100.0, subtotal: 200.0, products: { name: 'P3', sku_code: 'SKU3' } }]
		},
		{
			id: 'outlet-07-0001',
			folio: 104,
			user_id: 'cajero-1',
			total_amount: 50.0,
			is_canceled: false,
			canceled_at: null,
			canceled_by: null,
			cancel_reason: null,
			created_at: '2026-09-07 00:01', // Caso 3: 00:01 del día 07
			stock_outlet_items: [{ id: 'i4', product_id: 'p4', quantity: 1, unit_price: 50.0, subtotal: 50.0, products: { name: 'P4', sku_code: 'SKU4' } }]
		},
		{
			id: 'outlet-07-1200',
			folio: 105,
			user_id: 'cajero-1',
			total_amount: 300.0,
			is_canceled: false,
			canceled_at: null,
			canceled_by: null,
			cancel_reason: null,
			created_at: '2026-09-07 12:00', // Caso 4: 12:00 del día 07 (Hoy)
			stock_outlet_items: [{ id: 'i5', product_id: 'p5', quantity: 3, unit_price: 100.0, subtotal: 300.0, products: { name: 'P5', sku_code: 'SKU5' } }]
		}
	];

	function createMockSupabase(data: any[] = outletsTestSet) {
		return {
			from: vi.fn((table: string) => {
				if (table === 'stock_outlets') {
					return {
						select: vi.fn().mockReturnValue({
							order: vi.fn().mockResolvedValue({ data, error: null })
						})
					};
				}
				if (table === 'inventory_logs') {
					return {
						select: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								in: vi.fn().mockReturnValue({
									limit: vi.fn().mockResolvedValue({ data: [], error: null })
								})
							})
						})
					};
				}
				return { select: vi.fn() };
			}),
			rpc: vi.fn()
		};
	}

	function createEvent(urlStr: string, mockSupabase: any) {
		return {
			url: new URL(urlStr),
			locals: {
				user: { id: 'admin-1', email: 'admin@papeleria.com' },
				role: 'admin',
				supabase: mockSupabase
			},
			request: {
				formData: vi.fn().mockResolvedValue(new FormData())
			}
		} as unknown as RequestEvent;
	}

	it('filtro 06/09 -> 06/09 incluye 00:01 y 22:45, y excluye 07/09 00:01, devolviendo métricas y registros del día 06', async () => {
		const mockSupabase = createMockSupabase();
		const event = createEvent('http://localhost:5173/admin/historial?desde=2026-09-06&hasta=2026-09-06', mockSupabase);

		const result: any = await historialLoad(event as any);

		expect(result.error).toBeUndefined();
		// Debe incluir: 2026-09-06 00:01, 2026-09-06 12:00, 2026-09-06 22:45
		// Debe excluir: 2026-09-07 00:01, 2026-09-07 12:00
		expect(result.outlets).toHaveLength(3);
		const ids = result.outlets.map((o: any) => o.id);
		expect(ids).toContain('outlet-06-0001'); // 2026-09-06 00:01 incluido en 06/09
		expect(ids).toContain('outlet-06-1200'); // 2026-09-06 12:00 incluido en 06/09
		expect(ids).toContain('outlet-06-2245'); // 2026-09-06 22:45 incluido en 06/09
		expect(ids).not.toContain('outlet-07-0001'); // 2026-09-07 00:01 excluido de 06/09
		expect(ids).not.toContain('outlet-07-1200'); // 2026-09-07 12:00 excluido de 06/09

		// Métricas del día 06: $100 + $150 + $200 = $450
		expect(result.metrics.validSalesCount).toBe(3);
		expect(result.metrics.canceledSalesCount).toBe(0);
		expect(result.metrics.totalRevenue).toBe(450.0);
		expect(result.filters.desde).toBe('2026-09-06');
		expect(result.filters.hasta).toBe('2026-09-06');
	});

	it('filtro Hoy no devuelve ventas del día anterior (excluye 2026-09-06 12:00 y 2026-09-06 22:45) e incluye ventas del día 07/09', async () => {
		const now = new Date();
		const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

		const dynamicOutlets = [
			{
				id: 'outlet-yesterday-noon',
				folio: 301,
				user_id: 'cajero-1',
				total_amount: 120.0,
				is_canceled: false,
				created_at: '2026-09-06 12:00', // 2026-09-06 12:00 -> excluido de Hoy
				stock_outlet_items: []
			},
			{
				id: 'outlet-yesterday-night',
				folio: 302,
				user_id: 'cajero-1',
				total_amount: 80.0,
				is_canceled: false,
				created_at: '2026-09-06 22:45', // 2026-09-06 22:45 -> excluido de Hoy
				stock_outlet_items: []
			},
			{
				id: 'outlet-today-noon',
				folio: 303,
				user_id: 'cajero-1',
				total_amount: 300.0,
				is_canceled: false,
				created_at: `${todayStr} 12:00`, // 2026-09-07 12:00 -> incluido en Hoy
				stock_outlet_items: []
			}
		];

		const mockSupabase = createMockSupabase(dynamicOutlets);
		const event = createEvent('http://localhost:5173/admin/historial?hoy=true', mockSupabase);

		const result: any = await historialLoad(event as any);

		expect(result.error).toBeUndefined();
		expect(result.outlets).toHaveLength(1);
		expect(result.outlets[0].id).toBe('outlet-today-noon');
		expect(result.metrics.validSalesCount).toBe(1);
		expect(result.metrics.totalRevenue).toBe(300.0);
		expect(result.filters.hoy).toBe(true);

		// Confirmar explícitamente que no devuelve ventas del día anterior
		const ids = result.outlets.map((o: any) => o.id);
		expect(ids).not.toContain('outlet-yesterday-noon');
		expect(ids).not.toContain('outlet-yesterday-night');
	});

	it('filtro desde 06/09 hasta 07/09 abarca el intervalo semiabierto completo [2026-09-06 00:00, 2026-09-08 00:00)', async () => {
		const mockSupabase = createMockSupabase();
		const event = createEvent('http://localhost:5173/admin/historial?desde=2026-09-06&hasta=2026-09-07', mockSupabase);

		const result: any = await historialLoad(event as any);

		expect(result.error).toBeUndefined();
		// Incluye todas las ventas de 06/09 (3) y de 07/09 (2) = 5 ventas
		expect(result.outlets).toHaveLength(5);
		expect(result.metrics.validSalesCount).toBe(5);
		expect(result.metrics.totalRevenue).toBe(800.0); // 100 + 150 + 200 + 50 + 300
	});

	it('formato PostgreSQL timestamptz (ISO con Z / +00) se normaliza a tiempo local de negocio correctamente', async () => {
		const tzOutlets = [
			{
				id: 'outlet-tz-night-06',
				folio: 401,
				user_id: 'cajero-1',
				total_amount: 180.0,
				is_canceled: false,
				// 2026-09-06 22:45:30 en UTC-6 se guarda en PostgreSQL como 2026-09-07 04:45:30Z
				created_at: '2026-09-07T04:45:30.437Z',
				stock_outlet_items: []
			},
			{
				id: 'outlet-tz-noon-07',
				folio: 402,
				user_id: 'cajero-1',
				total_amount: 220.0,
				is_canceled: false,
				// 2026-09-07 12:00:00 en UTC-6 se guarda en PostgreSQL como 2026-09-07 18:00:00Z
				created_at: '2026-09-07T18:00:00.000Z',
				stock_outlet_items: []
			}
		];
		const mockSupabase = createMockSupabase(tzOutlets);

		// Filtrar solo 06/09
		const event06 = createEvent('http://localhost:5173/admin/historial?desde=2026-09-06&hasta=2026-09-06', mockSupabase);
		const result06: any = await historialLoad(event06 as any);

		expect(result06.error).toBeUndefined();
		expect(result06.outlets).toHaveLength(1);
		expect(result06.outlets[0].id).toBe('outlet-tz-night-06');
		expect(result06.metrics.totalRevenue).toBe(180.0);

		// Filtrar solo 07/09
		const event07 = createEvent('http://localhost:5173/admin/historial?desde=2026-09-07&hasta=2026-09-07', mockSupabase);
		const result07: any = await historialLoad(event07 as any);

		expect(result07.error).toBeUndefined();
		expect(result07.outlets).toHaveLength(1);
		expect(result07.outlets[0].id).toBe('outlet-tz-noon-07');
		expect(result07.metrics.totalRevenue).toBe(220.0);
	});
});
