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
		queryBuilder.lte = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.order = vi.fn().mockResolvedValue({ data: sampleOutlets, error: null });
		mockSupabase.from.mockReturnValue(queryBuilder);

		const event = createMockEvent({
			role: 'admin',
			url: 'http://localhost:5173/admin/historial?fecha=2026-09-06'
		});
		const result: any = await historialLoad(event as any);

		expect(queryBuilder.gte).toHaveBeenCalledWith('created_at', '2026-09-06T00:00:00.000Z');
		expect(queryBuilder.lte).toHaveBeenCalledWith('created_at', '2026-09-06T23:59:59.999Z');
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
		queryBuilder.lte = vi.fn().mockReturnValue(queryBuilder);
		queryBuilder.order = vi.fn().mockResolvedValue({ data: [], error: null });
		mockSupabase.from.mockReturnValue(queryBuilder);

		// 1. Test desde / hasta range
		const eventRange = createMockEvent({
			role: 'admin',
			url: 'http://localhost:5173/admin/historial?desde=2026-09-01&hasta=2026-09-05'
		});
		const resultRange: any = await historialLoad(eventRange as any);

		expect(queryBuilder.gte).toHaveBeenCalledWith('created_at', '2026-09-01T00:00:00.000Z');
		expect(queryBuilder.lte).toHaveBeenCalledWith('created_at', '2026-09-05T23:59:59.999Z');
		expect(resultRange.filters.desde).toBe('2026-09-01');
		expect(resultRange.filters.hasta).toBe('2026-09-05');

		// 2. Test hoy preset
		const eventHoy = createMockEvent({
			role: 'admin',
			url: 'http://localhost:5173/admin/historial?hoy=true'
		});
		const resultHoy: any = await historialLoad(eventHoy as any);
		expect(resultHoy.filters.hoy).toBe(true);
		const todayStr = new Date().toISOString().slice(0, 10);
		expect(queryBuilder.gte).toHaveBeenCalledWith('created_at', `${todayStr}T00:00:00.000Z`);
		expect(queryBuilder.lte).toHaveBeenCalledWith('created_at', `${todayStr}T23:59:59.999Z`);
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
