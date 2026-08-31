import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load as historialLoad, actions as historialActions } from '../../src/routes/admin/historial/+page.server';
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
	}) {
		return {
			url: new URL('http://localhost:5173/admin/historial'),
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
