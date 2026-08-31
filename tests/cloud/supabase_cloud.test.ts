import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Safely load .env.local without exposing or logging secrets
if (existsSync(resolve('.env.local'))) {
	try {
		const envContent = readFileSync(resolve('.env.local'), 'utf-8');
		for (const line of envContent.split('\n')) {
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith('#')) {
				const idx = trimmed.indexOf('=');
				if (idx !== -1) {
					const key = trimmed.slice(0, idx).trim();
					const val = trimmed.slice(idx + 1).trim();
					if (key && val && !process.env[key]) {
						process.env[key] = val;
					}
				}
			}
		}
	} catch {
		// Ignore read error
	}
}

/**
 * ISSUE-007: Supabase Cloud Integration Test Suite
 *
 * Validates the full SRS v8.0 contract against a REAL Supabase Cloud instance:
 * 1. Cloud Project Connectivity & Client Initialization via ANON_KEY.
 * 2. Supabase Auth authentication and role claims derivation in Cloud (admin@papeleria.com / cajero@papeleria.com).
 * 3. RLS enforcement on product_costs (cajero blocked, admin allowed).
 * 4. Atomic RPC execution: upsert_product_with_cost, process_stock_outlet, cancel_stock_outlet.
 * 5. Idempotency preservation in Cloud RPCs.
 */

const rawUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
// Normalize base URL (strip /rest/v1 or trailing slashes if present)
const SUPABASE_URL = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '') : undefined;
const SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@papeleria.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const CAJERO_EMAIL = process.env.TEST_CAJERO_EMAIL || 'cajero@papeleria.com';
const CAJERO_PASSWORD = process.env.TEST_CAJERO_PASSWORD;

const isCloudConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

describe('ISSUE-007: Supabase Cloud Integration', () => {
	let adminClient: SupabaseClient;
	let cajeroClient: SupabaseClient;

	beforeAll(() => {
		if (!isCloudConfigured) {
			console.warn(
				'\n[AVISO ISSUE-007] Variables de entorno de Supabase Cloud no detectadas (PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY).\n' +
				'Para ejecutar las pruebas en Cloud, configura las variables en tu entorno de ejecución según .env.example.\n'
			);
		}
	});

	it('1. Conexión Supabase Cloud: verifica configuración y conectividad a proyecto remoto válido', async () => {
		expect(
			isCloudConfigured,
			'ISSUE-007 BLOQUEADO — Variables PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY requeridas en el entorno de ejecución para validar Supabase Cloud real.'
		).toBe(true);

		expect(SUPABASE_URL).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co/);

		const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
		const { data, error } = await client.from('products').select('id, name, is_active').limit(1);

		expect(error, `Error de conexión con Supabase Cloud: ${error?.message}`).toBeNull();
		expect(Array.isArray(data)).toBe(true);
	});

	it('2. Auth Real: autentica usuario Admin (admin@papeleria.com) y verifica derivación de rol app_metadata.role', async () => {
		expect(isCloudConfigured).toBe(true);
		expect(Boolean(ADMIN_EMAIL && ADMIN_PASSWORD), 'TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD requeridos').toBe(true);

		adminClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
		const { data, error } = await adminClient.auth.signInWithPassword({
			email: ADMIN_EMAIL,
			password: ADMIN_PASSWORD!
		});

		expect(error, `Error de autenticación Admin en Cloud: ${error?.message}`).toBeNull();
		expect(data.session).toBeDefined();
		expect(data.user?.app_metadata?.role).toBe('admin');
	});

	it('3. Auth Real: autentica usuario Cajero (cajero@papeleria.com) y verifica derivación de rol app_metadata.role', async () => {
		expect(isCloudConfigured).toBe(true);
		expect(Boolean(CAJERO_EMAIL && CAJERO_PASSWORD), 'TEST_CAJERO_EMAIL y TEST_CAJERO_PASSWORD requeridos').toBe(true);

		cajeroClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
		const { data, error } = await cajeroClient.auth.signInWithPassword({
			email: CAJERO_EMAIL,
			password: CAJERO_PASSWORD!
		});

		expect(error, `Error de autenticación Cajero (${CAJERO_EMAIL}) en Cloud: ${error?.message}`).toBeNull();
		expect(data.session).toBeDefined();
		expect(data.user?.app_metadata?.role).toBe('cajero');
	});

	it('4. RLS product_costs: cajero autenticado recibe 0 registros debido a Row Level Security en Cloud', async () => {
		expect(isCloudConfigured).toBe(true);
		expect(cajeroClient).toBeDefined();

		const { data, error } = await cajeroClient.from('product_costs').select('product_id, cost');

		// RLS policy: Cajero gets 0 rows
		expect(error).toBeNull();
		expect(data).toEqual([]);
	});

	it('5. RPC upsert_product_with_cost: Admin crea producto con costo de forma atómica en Cloud', async () => {
		expect(isCloudConfigured).toBe(true);
		expect(adminClient).toBeDefined();

		const testSku = `CLOUD-TEST-${Date.now()}`;
		const { data: productId, error } = await adminClient.rpc('upsert_product_with_cost', {
			p_id: null,
			p_sku_code: testSku,
			p_name: 'Producto de Prueba Cloud',
			p_description: 'Creado por suite de integración Cloud',
			p_price: 49.50,
			p_cost: 25.00,
			p_stock: 100.000,
			p_min_stock: 10.000,
			p_image_url: null
		});

		expect(error, `Error al ejecutar upsert_product_with_cost en Cloud: ${error?.message}`).toBeNull();
		expect(productId).toMatch(/^[0-9a-f-]{36}$/);

		// Admin can read cost
		const { data: costData } = await adminClient
			.from('product_costs')
			.select('product_id, cost')
			.eq('product_id', productId);

		expect(costData).toHaveLength(1);
		expect(Number(costData![0].cost)).toBe(25.00);
	});

	it('6. RPC process_stock_outlet: Cajero procesa venta idempotente y descuenta stock en Cloud', async () => {
		expect(isCloudConfigured).toBe(true);
		expect(adminClient).toBeDefined();
		expect(cajeroClient).toBeDefined();

		// 1. Admin creates temporary product
		const testSku = `CLOUD-SALE-${Date.now()}`;
		const { data: productId, error: upsertErr } = await adminClient.rpc('upsert_product_with_cost', {
			p_id: null,
			p_sku_code: testSku,
			p_name: 'Producto Venta Cloud',
			p_description: 'Prueba de venta en Cloud',
			p_price: 30.00,
			p_cost: 15.00,
			p_stock: 50.000,
			p_min_stock: 5.000,
			p_image_url: null
		});

		expect(upsertErr).toBeNull();
		expect(productId).toMatch(/^[0-9a-f-]{36}$/);

		const idempotencyKey = crypto.randomUUID();

		// 2. Cajero calls process_stock_outlet (1st call)
		const { data: outletId1, error: err1 } = await cajeroClient.rpc('process_stock_outlet', {
			p_items: [{ product_id: productId, quantity: 2.5 }],
			p_idempotency_key: idempotencyKey
		});

		expect(err1).toBeNull();
		expect(outletId1).toMatch(/^[0-9a-f-]{36}$/);

		// 3. Idempotency test (2nd call with same key)
		const { data: outletId2, error: err2 } = await cajeroClient.rpc('process_stock_outlet', {
			p_items: [{ product_id: productId, quantity: 2.5 }],
			p_idempotency_key: idempotencyKey
		});

		expect(err2).toBeNull();
		expect(outletId2).toBe(outletId1); // Returns identical outlet ID without duplicate deduction

		// 4. Verify stock: 50 - 2.5 = 47.5
		const { data: prodData } = await cajeroClient.from('products').select('stock').eq('id', productId).single();
		expect(Number(prodData?.stock)).toBe(47.500);
	});

	it('7. RPC cancel_stock_outlet: Admin cancela venta, restaura stock y bloquea a Cajero en Cloud', async () => {
		expect(isCloudConfigured).toBe(true);
		expect(adminClient).toBeDefined();
		expect(cajeroClient).toBeDefined();

		// 1. Admin creates product and cajero performs sale
		const testSku = `CLOUD-CANCEL-${Date.now()}`;
		const { data: productId, error: upsertErr } = await adminClient.rpc('upsert_product_with_cost', {
			p_id: null,
			p_sku_code: testSku,
			p_name: 'Producto Cancelacion Cloud',
			p_description: 'Prueba cancelacion en Cloud',
			p_price: 20.00,
			p_cost: 10.00,
			p_stock: 20.000,
			p_min_stock: 2.000,
			p_image_url: null
		});

		expect(upsertErr).toBeNull();

		const { data: outletId, error: saleErr } = await cajeroClient.rpc('process_stock_outlet', {
			p_items: [{ product_id: productId, quantity: 5.0 }],
			p_idempotency_key: crypto.randomUUID()
		});

		expect(saleErr).toBeNull();
		expect(outletId).toMatch(/^[0-9a-f-]{36}$/);

		// 2. Cajero attempts cancellation (Must fail with error)
		const { error: cajeroErr } = await cajeroClient.rpc('cancel_stock_outlet', {
			p_outlet_id: outletId,
			p_reason: 'Intento de cancelacion no autorizado por cajero'
		});

		expect(cajeroErr).not.toBeNull();
		expect(cajeroErr?.message).toContain('Solo un Administrador');

		// 3. Admin cancels sale (Must succeed and restore stock to 20.000)
		const { error: adminErr } = await adminClient.rpc('cancel_stock_outlet', {
			p_outlet_id: outletId,
			p_reason: 'Devolucion por cliente en prueba Cloud'
		});

		expect(adminErr).toBeNull();

		const { data: restoredProd } = await adminClient.from('products').select('stock').eq('id', productId).single();
		expect(Number(restoredProd?.stock)).toBe(20.000);
	});
});
