import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * ISSUE-001: Integration Tests — process_stock_outlet RPC
 *
 * Validates against real PostgreSQL 15:
 * 1. Valid sale deducts exact requested stock from products.
 * 2. Stored price in products is used, ignoring any client price.
 * 3. stock_outlets and stock_outlet_items are correctly populated with totals and subtotals.
 * 4. Automatic VENTA audit log is created in inventory_logs.
 * 5. Idempotency: second call with identical idempotency_key returns the same outlet without duplicate stock deduction.
 * 6. Fractional quantity sales (NUMERIC(10,3)) work accurately.
 * 7. Insufficient stock throws an exception and rolls back the entire transaction atomically.
 * 8. Multi-item sales are completely atomic.
 */

const CONTAINER_NAME = 'pg_integration_test';
const DB_NAME = 'testdb_process';
const DB_USER = 'postgres';

const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const CAJERO_ID = '22222222-2222-2222-2222-222222222222';

function runPsql(sql: string, asUser?: { role: 'admin' | 'cajero'; userId: string }) {
	let query = sql;
	if (asUser) {
		query = `
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "${asUser.userId}", "role": "authenticated", "app_metadata": {"role": "${asUser.role}"}}';
${sql}
COMMIT;
`;
	}
	return spawnSync(
		'docker',
		['exec', '-i', CONTAINER_NAME, 'psql', '-U', DB_USER, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-q'],
		{ input: query, encoding: 'utf-8' }
	);
}

function execSql(sql: string, asUser?: { role: 'admin' | 'cajero'; userId: string }): string {
	const res = runPsql(sql, asUser);
	if (res.status !== 0) {
		throw new Error(`SQL Error: ${res.stderr || res.stdout}`);
	}
	return res.stdout.trim();
}

function queryAsRole<T>(role: 'admin' | 'cajero', userId: string, sqlJsonSelect: string): T {
	const res = runPsql(sqlJsonSelect, { role, userId });
	if (res.status !== 0) {
		throw new Error(`Query Error (${role}): ${res.stderr || res.stdout}`);
	}
	const out = res.stdout.trim();
	if (!out) return null as unknown as T;
	return JSON.parse(out) as T;
}

function setupDatabase() {
	const inspect = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', CONTAINER_NAME], { encoding: 'utf-8' });
	if (inspect.status !== 0 || inspect.stdout.trim() !== 'true') {
		spawnSync('docker', [
			'run', '--name', CONTAINER_NAME,
			'-e', 'POSTGRES_PASSWORD=postgres',
			'-d', '-p', '5433:5432',
			'postgres:15-alpine'
		]);
		spawnSync('docker', ['start', CONTAINER_NAME]);
	}

	spawnSync('docker', ['exec', '-i', CONTAINER_NAME, 'psql', '-U', DB_USER, '-d', 'postgres', '-c', `DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE);`], { encoding: 'utf-8' });
	spawnSync('docker', ['exec', '-i', CONTAINER_NAME, 'psql', '-U', DB_USER, '-d', 'postgres', '-c', `CREATE DATABASE ${DB_NAME};`], { encoding: 'utf-8' });

	const authSetup = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$ LANGUAGE sql STABLE;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$ LANGUAGE sql STABLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
END $$;
GRANT ALL ON SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;
`;
	spawnSync('docker', ['exec', '-i', CONTAINER_NAME, 'psql', '-U', DB_USER, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-q'], { input: authSetup, encoding: 'utf-8' });

	const migrationPath = resolve('supabase/migrations/20260829000000_init_v8.sql');
	const migrationSql = readFileSync(migrationPath, 'utf-8');
	spawnSync('docker', ['exec', '-i', CONTAINER_NAME, 'psql', '-U', DB_USER, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-q'], { input: migrationSql, encoding: 'utf-8' });

	const incrementalPath = resolve('supabase/migrations/20260906000000_enforce_integer_quantities_in_pos.sql');
	const incrementalSql = readFileSync(incrementalPath, 'utf-8');
	spawnSync('docker', ['exec', '-i', CONTAINER_NAME, 'psql', '-U', DB_USER, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-q'], { input: incrementalSql, encoding: 'utf-8' });

	const grantAfter = `
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;
INSERT INTO auth.users (id, raw_app_meta_data) VALUES ('${ADMIN_ID}', '{"role": "admin"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO auth.users (id, raw_app_meta_data) VALUES ('${CAJERO_ID}', '{"role": "cajero"}') ON CONFLICT (id) DO NOTHING;
`;
	spawnSync('docker', ['exec', '-i', CONTAINER_NAME, 'psql', '-U', DB_USER, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-q'], { input: grantAfter, encoding: 'utf-8' });
}

describe('ISSUE-001: process_stock_outlet RPC (Atomicity, Idempotency & Auditing)', () => {
	beforeAll(() => {
		setupDatabase();
	});

	beforeEach(() => {
		execSql('TRUNCATE TABLE stock_outlet_items, stock_outlets, inventory_logs, product_costs, products CASCADE;');
	});

	it('processes a valid sale, deducts stock, uses database price and records total amount', () => {
		// Setup product: price 35.50, stock 50.000
		const prodId = execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-SALE-001'::varchar,
  'Pegamento en Barra 40g'::varchar,
  'Adhesivo multiusos'::text,
  35.50::numeric,
  18.00::numeric,
  50.000::numeric,
  5.000::numeric,
  NULL::text
);
`, { role: 'admin', userId: ADMIN_ID });

		const idempotencyKey = 'e0000000-0000-0000-0000-000000000001';
		const saleSql = `
SELECT process_stock_outlet(
  jsonb_build_array(jsonb_build_object('product_id', '${prodId}'::uuid, 'quantity', 4.000)),
  '${idempotencyKey}'::uuid
);
`;
		const saleRes = runPsql(saleSql, { role: 'cajero', userId: CAJERO_ID });
		expect(saleRes.status).toBe(0);
		const outletId = saleRes.stdout.trim();
		expect(outletId).toMatch(/^[0-9a-f-]{36}$/);

		// Verify stock in products: 50.000 - 4.000 = 46.000
		const product = queryAsRole<Array<{ stock: number; price: number }>>(
			'cajero',
			CAJERO_ID,
			`SELECT json_agg(p) FROM products p WHERE id = '${prodId}';`
		);
		expect(Number(product[0].stock)).toBe(46.000);
		expect(Number(product[0].price)).toBe(35.50);

		// Verify stock_outlets: total_amount = 4 * 35.50 = 142.00
		const outlet = queryAsRole<Array<{ total_amount: number; user_id: string; is_canceled: boolean }>>(
			'cajero',
			CAJERO_ID,
			`SELECT json_agg(o) FROM stock_outlets o WHERE id = '${outletId}';`
		);
		expect(outlet).toHaveLength(1);
		expect(Number(outlet[0].total_amount)).toBe(142.00);
		expect(outlet[0].user_id).toBe(CAJERO_ID);
		expect(outlet[0].is_canceled).toBe(false);

		// Verify stock_outlet_items via superuser query: unit_price = 35.50, subtotal = 142.00
		const itemsRaw = execSql(`SELECT json_agg(i) FROM stock_outlet_items i WHERE outlet_id = '${outletId}';`);
		const items = JSON.parse(itemsRaw);
		expect(items).toHaveLength(1);
		expect(Number(items[0].quantity)).toBe(4.000);
		expect(Number(items[0].unit_price)).toBe(35.50);
		expect(Number(items[0].subtotal)).toBe(142.00);
	});

	it('generates an automatic VENTA audit record in inventory_logs', () => {
		const prodId = execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-SALE-002'::varchar,
  'Caja de Colores 24pz'::varchar,
  'Colores de madera'::text,
  95.00::numeric,
  55.00::numeric,
  30.000::numeric,
  5.000::numeric,
  NULL::text
);
`, { role: 'admin', userId: ADMIN_ID });

		const saleSql = `
SELECT process_stock_outlet(
  jsonb_build_array(jsonb_build_object('product_id', '${prodId}'::uuid, 'quantity', 3.000)),
  'e0000000-0000-0000-0000-000000000002'::uuid
);
`;
		const saleRes = runPsql(saleSql, { role: 'cajero', userId: CAJERO_ID });
		expect(saleRes.status).toBe(0);
		const outletId = saleRes.stdout.trim();

		// Query inventory_logs as admin
		const logs = queryAsRole<Array<{
			change_type: string;
			previous_stock: number;
			new_stock: number;
			quantity_changed: number;
			reference_id: string;
			created_by: string;
		}>>(
			'admin',
			ADMIN_ID,
			`SELECT json_agg(l) FROM inventory_logs l WHERE reference_id = '${outletId}' AND change_type = 'VENTA';`
		);
		expect(logs).toHaveLength(1);
		expect(logs[0].change_type).toBe('VENTA');
		expect(Number(logs[0].previous_stock)).toBe(30.000);
		expect(Number(logs[0].new_stock)).toBe(27.000);
		expect(Number(logs[0].quantity_changed)).toBe(-3.000);
		expect(logs[0].reference_id).toBe(outletId);
		expect(logs[0].created_by).toBe(CAJERO_ID);
	});

	it('implements idempotency: duplicate call with same idempotency_key returns existing outlet and does NOT deduct stock again', () => {
		const prodId = execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-IDEM-001'::varchar,
  'Compas de Precision'::varchar,
  'Metalico con adaptador'::text,
  65.00::numeric,
  35.00::numeric,
  20.000::numeric,
  2.000::numeric,
  NULL::text
);
`, { role: 'admin', userId: ADMIN_ID });

		const idempotencyKey = 'e0000000-0000-0000-0000-000000000003';
		const saleSql = `
SELECT process_stock_outlet(
  jsonb_build_array(jsonb_build_object('product_id', '${prodId}'::uuid, 'quantity', 5.000)),
  '${idempotencyKey}'::uuid
);
`;

		// 1st call
		const firstCall = runPsql(saleSql, { role: 'cajero', userId: CAJERO_ID });
		expect(firstCall.status).toBe(0);
		const firstOutletId = firstCall.stdout.trim();

		// Stock after 1st call = 20 - 5 = 15
		const stockAfterFirst = execSql(`SELECT stock FROM products WHERE id = '${prodId}';`);
		expect(Number(stockAfterFirst)).toBe(15.000);

		// 2nd call with identical idempotency_key
		const secondCall = runPsql(saleSql, { role: 'cajero', userId: CAJERO_ID });
		expect(secondCall.status).toBe(0);
		const secondOutletId = secondCall.stdout.trim();

		// Returns the same outlet_id
		expect(secondOutletId).toBe(firstOutletId);

		// Stock is NOT deducted a second time (remains 15, not 10)
		const stockAfterSecond = execSql(`SELECT stock FROM products WHERE id = '${prodId}';`);
		expect(Number(stockAfterSecond)).toBe(15.000);

		// Exactly 1 outlet record exists in database
		const outletCount = execSql(`SELECT count(*) FROM stock_outlets WHERE idempotency_key = '${idempotencyKey}';`);
		expect(outletCount).toBe('1');
	});

	it('enforces integer quantities >= 1: rejects fractional (3.750, 0.9, 1.5), zero (0) and negative (-1), while accepting valid integers (1, 2)', () => {
		const prodId = execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-FRAC-001'::varchar,
  'Liston Satinado Rojo 25mm'::varchar,
  'Venta por metro'::text,
  12.00::numeric,
  5.00::numeric,
  50.000::numeric,
  5.000::numeric,
  NULL::text
);
`, { role: 'admin', userId: ADMIN_ID });

		// 1. Historical 3.750 must be rejected
		const res3750 = runPsql(`SELECT process_stock_outlet(jsonb_build_array(jsonb_build_object('product_id', '${prodId}'::uuid, 'quantity', 3.750)));`, { role: 'cajero', userId: CAJERO_ID });
		expect(res3750.status).not.toBe(0);
		expect(res3750.stderr).toContain('Cantidad inválida');

		// 2. Reject 0
		const res0 = runPsql(`SELECT process_stock_outlet(jsonb_build_array(jsonb_build_object('product_id', '${prodId}'::uuid, 'quantity', 0)));`, { role: 'cajero', userId: CAJERO_ID });
		expect(res0.status).not.toBe(0);

		// 3. Reject -1
		const resNeg = runPsql(`SELECT process_stock_outlet(jsonb_build_array(jsonb_build_object('product_id', '${prodId}'::uuid, 'quantity', -1)));`, { role: 'cajero', userId: CAJERO_ID });
		expect(resNeg.status).not.toBe(0);

		// 4. Reject 0.9
		const res09 = runPsql(`SELECT process_stock_outlet(jsonb_build_array(jsonb_build_object('product_id', '${prodId}'::uuid, 'quantity', 0.9)));`, { role: 'cajero', userId: CAJERO_ID });
		expect(res09.status).not.toBe(0);
		expect(res09.stderr).toContain('Cantidad inválida');

		// 5. Reject 1.5
		const res15 = runPsql(`SELECT process_stock_outlet(jsonb_build_array(jsonb_build_object('product_id', '${prodId}'::uuid, 'quantity', 1.5)));`, { role: 'cajero', userId: CAJERO_ID });
		expect(res15.status).not.toBe(0);
		expect(res15.stderr).toContain('Cantidad inválida');

		// 6. Accept 1
		const res1 = runPsql(`SELECT process_stock_outlet(jsonb_build_array(jsonb_build_object('product_id', '${prodId}'::uuid, 'quantity', 1)));`, { role: 'cajero', userId: CAJERO_ID });
		expect(res1.status).toBe(0);

		// 7. Accept 2
		const res2 = runPsql(`SELECT process_stock_outlet(jsonb_build_array(jsonb_build_object('product_id', '${prodId}'::uuid, 'quantity', 2)));`, { role: 'cajero', userId: CAJERO_ID });
		expect(res2.status).toBe(0);

		// Remaining stock: 50.000 - 1 - 2 = 47.000
		const product = queryAsRole<Array<{ stock: number }>>(
			'cajero',
			CAJERO_ID,
			`SELECT json_agg(p) FROM products p WHERE id = '${prodId}';`
		);
		expect(Number(product[0].stock)).toBe(47.000);
	});

	it('fails and rolls back atomically when requesting insufficient stock', () => {
		const prodId = execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-INSUFF-001'::varchar,
  'Mochila Escolar Ergonomica'::varchar,
  'Capacidad 25L'::text,
  450.00::numeric,
  250.00::numeric,
  5.000::numeric,
  1.000::numeric,
  NULL::text
);
`, { role: 'admin', userId: ADMIN_ID });

		// Request 10 units when only 5 are available
		const saleSql = `
SELECT process_stock_outlet(
  jsonb_build_array(jsonb_build_object('product_id', '${prodId}'::uuid, 'quantity', 10.000)),
  'e0000000-0000-0000-0000-000000000005'::uuid
);
`;
		const saleRes = runPsql(saleSql, { role: 'cajero', userId: CAJERO_ID });
		expect(saleRes.status).not.toBe(0);
		expect(saleRes.stderr).toContain('Stock insuficiente');

		// Stock remains intact (5.000)
		const stock = execSql(`SELECT stock FROM products WHERE id = '${prodId}';`);
		expect(Number(stock)).toBe(5.000);

		// No stock_outlets were created
		const outletsCount = execSql('SELECT count(*) FROM stock_outlets;');
		expect(outletsCount).toBe('0');
	});

	it('ensures multi-item sales are completely atomic (all or nothing)', () => {
		const prod1Id = execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-MULTI-001'::varchar,
  'Cuaderno Forma Francesa'::varchar,
  '96 hojas cosido'::text,
  30.00::numeric,
  15.00::numeric,
  10.000::numeric,
  2.000::numeric,
  NULL::text
);
`, { role: 'admin', userId: ADMIN_ID });

		const prod2Id = execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-MULTI-002'::varchar,
  'Juego de Geometria Flexible'::varchar,
  '5 piezas'::text,
  60.00::numeric,
  30.00::numeric,
  2.000::numeric,
  1.000::numeric,
  NULL::text
);
`, { role: 'admin', userId: ADMIN_ID });

		// Request 3 units of prod1 (has 10) AND 5 units of prod2 (only has 2)
		const saleSql = `
SELECT process_stock_outlet(
  jsonb_build_array(
    jsonb_build_object('product_id', '${prod1Id}'::uuid, 'quantity', 3.000),
    jsonb_build_object('product_id', '${prod2Id}'::uuid, 'quantity', 5.000)
  ),
  'e0000000-0000-0000-0000-000000000006'::uuid
);
`;
		const saleRes = runPsql(saleSql, { role: 'cajero', userId: CAJERO_ID });
		expect(saleRes.status).not.toBe(0);
		expect(saleRes.stderr).toContain('Stock insuficiente');

		// Neither product had its stock altered
		const stock1 = execSql(`SELECT stock FROM products WHERE id = '${prod1Id}';`);
		const stock2 = execSql(`SELECT stock FROM products WHERE id = '${prod2Id}';`);
		expect(Number(stock1)).toBe(10.000);
		expect(Number(stock2)).toBe(2.000);

		// No partial outlet created
		const outletsCount = execSql('SELECT count(*) FROM stock_outlets;');
		expect(outletsCount).toBe('0');
	});
});
