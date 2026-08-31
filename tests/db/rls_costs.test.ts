import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * ISSUE-001: Integration Tests — RLS on product_costs & Soft Delete
 *
 * Validates against real PostgreSQL 15:
 * 1. Role 'cajero' cannot query or modify product_costs (blocked by RLS).
 * 2. Role 'admin' can query and manage product_costs.
 * 3. Role 'cajero' can read active products.
 * 4. Soft Delete: products remain physically in the database with is_active = false.
 * 5. Inactive products cannot be sold through process_stock_outlet.
 */

const CONTAINER_NAME = 'pg_integration_test';
const DB_NAME = 'testdb_rls';
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

	const grantAfter = `
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;
INSERT INTO auth.users (id, raw_app_meta_data) VALUES ('${ADMIN_ID}', '{"role": "admin"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO auth.users (id, raw_app_meta_data) VALUES ('${CAJERO_ID}', '{"role": "cajero"}') ON CONFLICT (id) DO NOTHING;
`;
	spawnSync('docker', ['exec', '-i', CONTAINER_NAME, 'psql', '-U', DB_USER, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-q'], { input: grantAfter, encoding: 'utf-8' });
}

describe('ISSUE-001: RLS on product_costs & Soft Delete', () => {
	beforeAll(() => {
		setupDatabase();
	});

	beforeEach(() => {
		execSql('TRUNCATE TABLE stock_outlet_items, stock_outlets, inventory_logs, product_costs, products CASCADE;');
	});

	it('allows admin to create a product with cost via upsert_product_with_cost', () => {
		const sql = `
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-RLS-001'::varchar,
  'Libreta Profesional Doble Raya'::varchar,
  'Libreta 100 hojas'::text,
  38.50::numeric,
  22.00::numeric,
  60.000::numeric,
  5.000::numeric,
  'https://images.example.com/libreta.jpg'::text
);
`;
		const res = runPsql(sql, { role: 'admin', userId: ADMIN_ID });
		expect(res.status).toBe(0);
		const productId = res.stdout.trim();
		expect(productId).toMatch(/^[0-9a-f-]{36}$/);

		// Admin can read the product and its cost
		const costData = queryAsRole<Array<{ product_id: string; cost: number }>>(
			'admin',
			ADMIN_ID,
			'SELECT json_agg(c) FROM product_costs c;'
		);
		expect(costData).toHaveLength(1);
		expect(costData[0].product_id).toBe(productId);
		expect(Number(costData[0].cost)).toBe(22.00);
	});

	it('enforces RLS: cajero CANNOT read product_costs (returns 0 rows)', () => {
		// Setup product with cost as admin
		execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-RLS-002'::varchar,
  'Pluma Fuente Azul'::varchar,
  'Tinta azul punto fino'::text,
  45.00::numeric,
  20.00::numeric,
  100.000::numeric,
  10.000::numeric,
  NULL::text
);
`, { role: 'admin', userId: ADMIN_ID });

		// Query as cajero: should return empty list / null
		const cajeroCosts = queryAsRole<Array<unknown> | null>(
			'cajero',
			CAJERO_ID,
			"SELECT COALESCE(json_agg(c), '[]'::json) FROM product_costs c;"
		);
		expect(cajeroCosts).toEqual([]);

		// Query as admin: should return the actual cost record
		const adminCosts = queryAsRole<Array<{ cost: number }>>(
			'admin',
			ADMIN_ID,
			"SELECT COALESCE(json_agg(c), '[]'::json) FROM product_costs c;"
		);
		expect(adminCosts).toHaveLength(1);
		expect(Number(adminCosts[0].cost)).toBe(20.00);
	});

	it('allows cajero to read active products but not their costs', () => {
		execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-RLS-003'::varchar,
  'Calculadora Cientifica'::varchar,
  '240 funciones'::text,
  280.00::numeric,
  150.00::numeric,
  25.000::numeric,
  3.000::numeric,
  NULL::text
);
`, { role: 'admin', userId: ADMIN_ID });

		// Cajero can query products
		const cajeroProducts = queryAsRole<Array<{ sku_code: string; price: number; stock: number }>>(
			'cajero',
			CAJERO_ID,
			"SELECT COALESCE(json_agg(p), '[]'::json) FROM products p WHERE sku_code = 'SKU-RLS-003';"
		);
		expect(cajeroProducts).toHaveLength(1);
		expect(cajeroProducts[0].sku_code).toBe('SKU-RLS-003');
		expect(Number(cajeroProducts[0].price)).toBe(280.00);
		expect(Number(cajeroProducts[0].stock)).toBe(25.000);

		// Cajero cannot query product_costs
		const cajeroCosts = queryAsRole<Array<unknown>>(
			'cajero',
			CAJERO_ID,
			"SELECT COALESCE(json_agg(c), '[]'::json) FROM product_costs c WHERE product_id = (SELECT id FROM products WHERE sku_code = 'SKU-RLS-003');"
		);
		expect(cajeroCosts).toEqual([]);
	});

	it('denies cajero from creating or modifying products with cost', () => {
		const sql = `
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-RLS-DENIED'::varchar,
  'Intento No Autorizado'::varchar,
  'Desc'::text,
  10.00::numeric,
  5.00::numeric,
  10.000::numeric,
  2.000::numeric,
  NULL::text
);
`;
		const res = runPsql(sql, { role: 'cajero', userId: CAJERO_ID });
		expect(res.status).not.toBe(0);
		expect(res.stderr).toContain('Solo un Administrador puede modificar el catálogo');
	});

	it('validates Soft Delete: product is deactivated (is_active = false) without physical deletion', () => {
		// Admin creates a product
		execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-SOFT-001'::varchar,
  'Marcador Permanente Negro'::varchar,
  'Punta redonda'::text,
  18.00::numeric,
  8.50::numeric,
  40.000::numeric,
  5.000::numeric,
  NULL::text
);
`, { role: 'admin', userId: ADMIN_ID });

		// Soft delete: UPDATE is_active = false
		const softDeleteSql = `
UPDATE products SET is_active = false, updated_at = NOW() WHERE sku_code = 'SKU-SOFT-001';
`;
		const updateRes = runPsql(softDeleteSql, { role: 'admin', userId: ADMIN_ID });
		expect(updateRes.status).toBe(0);

		// Verify product still physically exists in the database
		const count = execSql("SELECT count(*) FROM products WHERE sku_code = 'SKU-SOFT-001';");
		expect(count).toBe('1');

		const productRow = queryAsRole<Array<{ is_active: boolean }>>(
			'admin',
			ADMIN_ID,
			"SELECT json_agg(p) FROM products p WHERE sku_code = 'SKU-SOFT-001';"
		);
		expect(productRow[0].is_active).toBe(false);

		// Cost record also remains preserved for history/accounting
		const costCount = execSql("SELECT count(*) FROM product_costs WHERE product_id = (SELECT id FROM products WHERE sku_code = 'SKU-SOFT-001');");
		expect(costCount).toBe('1');
	});

	it('prevents process_stock_outlet from selling a soft-deleted product', () => {
		// Create product and soft-delete it
		execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-SOFT-002'::varchar,
  'Tijeras Escolares'::varchar,
  'Punta roma'::text,
  15.00::numeric,
  6.00::numeric,
  30.000::numeric,
  5.000::numeric,
  NULL::text
);
UPDATE products SET is_active = false WHERE sku_code = 'SKU-SOFT-002';
`, { role: 'admin', userId: ADMIN_ID });

		const saleSql = `
SELECT process_stock_outlet(
  jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM products WHERE sku_code = 'SKU-SOFT-002'), 'quantity', 2.000)),
  'd0000000-0000-0000-0000-000000000001'::uuid
);
`;
		const saleRes = runPsql(saleSql, { role: 'cajero', userId: CAJERO_ID });
		expect(saleRes.status).not.toBe(0);
		expect(saleRes.stderr).toContain('inactivo o inexistente');
	});
});
