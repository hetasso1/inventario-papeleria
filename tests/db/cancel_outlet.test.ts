import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * ISSUE-001: Integration Tests — cancel_stock_outlet RPC (Returns & Reversals)
 *
 * Validates against real PostgreSQL 15:
 * 1. Admin can cancel an existing stock outlet.
 * 2. Cancellation accurately restores products.stock for all items in the outlet.
 * 3. An automatic DEVOLUCION audit log is created in inventory_logs for each item.
 * 4. The stock_outlets record is updated with is_canceled = true, canceled_at, canceled_by, cancel_reason.
 * 5. A second cancellation attempt on an already canceled outlet fails with an exception.
 * 6. Role 'cajero' is strictly forbidden from canceling outlets.
 * 7. Canceling a non-existent outlet fails with an exception.
 */

const CONTAINER_NAME = 'pg_integration_test';
const DB_NAME = 'testdb_cancel';
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

describe('ISSUE-001: cancel_stock_outlet RPC (Returns, RBAC & Stock Restoration)', () => {
	beforeAll(() => {
		setupDatabase();
	});

	beforeEach(() => {
		execSql('TRUNCATE TABLE stock_outlet_items, stock_outlets, inventory_logs, product_costs, products CASCADE;');
	});

	it('allows admin to cancel a sale and restores stock for all items in the outlet', () => {
		// Setup 2 products
		const prodA = execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-CANCEL-001'::varchar,
  'Paquete Hojas Blancas 500pz'::varchar,
  'Carta 75g'::text,
  110.00::numeric,
  70.00::numeric,
  30.000::numeric,
  5.000::numeric,
  NULL::text
);
`, { role: 'admin', userId: ADMIN_ID });

		const prodB = execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-CANCEL-002'::varchar,
  'Goma de Borrar Miga de Pan'::varchar,
  'No mancha'::text,
  8.50::numeric,
  3.00::numeric,
  50.000::numeric,
  10.000::numeric,
  NULL::text
);
`, { role: 'admin', userId: ADMIN_ID });

		// Process sale: 5 units of prodA, 10 units of prodB
		const outletId = execSql(`
SELECT process_stock_outlet(
  jsonb_build_array(
    jsonb_build_object('product_id', '${prodA}'::uuid, 'quantity', 5.000),
    jsonb_build_object('product_id', '${prodB}'::uuid, 'quantity', 10.000)
  ),
  'f0000000-0000-0000-0000-000000000001'::uuid
);
`, { role: 'cajero', userId: CAJERO_ID });

		// Verify stock was deducted: prodA -> 25.000, prodB -> 40.000
		expect(Number(execSql(`SELECT stock FROM products WHERE id = '${prodA}';`))).toBe(25.000);
		expect(Number(execSql(`SELECT stock FROM products WHERE id = '${prodB}';`))).toBe(40.000);

		// Admin cancels the outlet
		const cancelReason = 'Cliente se equivoco de tamano de papel';
		const cancelRes = runPsql(
			`SELECT cancel_stock_outlet('${outletId}'::uuid, '${cancelReason}');`,
			{ role: 'admin', userId: ADMIN_ID }
		);
		expect(cancelRes.status).toBe(0);

		// Verify stock is restored to original values: prodA -> 30.000, prodB -> 50.000
		expect(Number(execSql(`SELECT stock FROM products WHERE id = '${prodA}';`))).toBe(30.000);
		expect(Number(execSql(`SELECT stock FROM products WHERE id = '${prodB}';`))).toBe(50.000);
	});

	it('creates automatic DEVOLUCION audit logs for each restored product', () => {
		const prodId = execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-CANCEL-003'::varchar,
  'Sacapuntas Metalico Doble'::varchar,
  'Cuerpo de aluminio'::text,
  25.00::numeric,
  12.00::numeric,
  40.000::numeric,
  5.000::numeric,
  NULL::text
);
`, { role: 'admin', userId: ADMIN_ID });

		const outletId = execSql(`
SELECT process_stock_outlet(
  jsonb_build_array(jsonb_build_object('product_id', '${prodId}'::uuid, 'quantity', 6.000)),
  'f0000000-0000-0000-0000-000000000002'::uuid
);
`, { role: 'cajero', userId: CAJERO_ID });

		const cancelReason = 'Producto defectuoso reportado por cliente';
		const cancelRes = runPsql(
			`SELECT cancel_stock_outlet('${outletId}'::uuid, '${cancelReason}');`,
			{ role: 'admin', userId: ADMIN_ID }
		);
		expect(cancelRes.status).toBe(0);

		// Query DEVOLUCION logs as admin
		const returnLogs = queryAsRole<Array<{
			change_type: string;
			previous_stock: number;
			new_stock: number;
			quantity_changed: number;
			reference_id: string;
			created_by: string;
			notes: string;
		}>>(
			'admin',
			ADMIN_ID,
			`SELECT json_agg(l) FROM inventory_logs l WHERE reference_id = '${outletId}' AND change_type = 'DEVOLUCION';`
		);

		expect(returnLogs).toHaveLength(1);
		expect(returnLogs[0].change_type).toBe('DEVOLUCION');
		expect(Number(returnLogs[0].previous_stock)).toBe(34.000);
		expect(Number(returnLogs[0].new_stock)).toBe(40.000);
		expect(Number(returnLogs[0].quantity_changed)).toBe(6.000);
		expect(returnLogs[0].reference_id).toBe(outletId);
		expect(returnLogs[0].created_by).toBe(ADMIN_ID);
		expect(returnLogs[0].notes).toBe(cancelReason);
	});

	it('marks the stock_outlets record with is_canceled = true, timestamp, admin id and reason', () => {
		const prodId = execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-CANCEL-004'::varchar,
  'Cinta Canela 48mm x 50m'::varchar,
  'Adhesivo acrilico'::text,
  32.00::numeric,
  16.00::numeric,
  20.000::numeric,
  3.000::numeric,
  NULL::text
);
`, { role: 'admin', userId: ADMIN_ID });

		const outletId = execSql(`
SELECT process_stock_outlet(
  jsonb_build_array(jsonb_build_object('product_id', '${prodId}'::uuid, 'quantity', 2.000)),
  'f0000000-0000-0000-0000-000000000003'::uuid
);
`, { role: 'cajero', userId: CAJERO_ID });

		const cancelReason = 'Cancelacion autorizada por gerencia';
		const cancelRes = runPsql(
			`SELECT cancel_stock_outlet('${outletId}'::uuid, '${cancelReason}');`,
			{ role: 'admin', userId: ADMIN_ID }
		);
		expect(cancelRes.status).toBe(0);

		const outlet = queryAsRole<Array<{
			is_canceled: boolean;
			canceled_at: string;
			canceled_by: string;
			cancel_reason: string;
		}>>(
			'admin',
			ADMIN_ID,
			`SELECT json_agg(o) FROM stock_outlets o WHERE id = '${outletId}';`
		);

		expect(outlet).toHaveLength(1);
		expect(outlet[0].is_canceled).toBe(true);
		expect(outlet[0].canceled_at).toBeTruthy();
		expect(outlet[0].canceled_by).toBe(ADMIN_ID);
		expect(outlet[0].cancel_reason).toBe(cancelReason);
	});

	it('denies a second cancellation attempt on an already canceled outlet', () => {
		const prodId = execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-CANCEL-005'::varchar,
  'Plumon para Pizarron Blanco'::varchar,
  'Borrable'::text,
  28.00::numeric,
  14.00::numeric,
  15.000::numeric,
  2.000::numeric,
  NULL::text
);
`, { role: 'admin', userId: ADMIN_ID });

		const outletId = execSql(`
SELECT process_stock_outlet(
  jsonb_build_array(jsonb_build_object('product_id', '${prodId}'::uuid, 'quantity', 1.000)),
  'f0000000-0000-0000-0000-000000000004'::uuid
);
`, { role: 'cajero', userId: CAJERO_ID });

		// 1st cancellation: succeeds
		const res1 = runPsql(
			`SELECT cancel_stock_outlet('${outletId}'::uuid, 'Primera cancelacion');`,
			{ role: 'admin', userId: ADMIN_ID }
		);
		expect(res1.status).toBe(0);

		// 2nd cancellation: must fail
		const res2 = runPsql(
			`SELECT cancel_stock_outlet('${outletId}'::uuid, 'Segunda cancelacion');`,
			{ role: 'admin', userId: ADMIN_ID }
		);
		expect(res2.status).not.toBe(0);
		expect(res2.stderr).toContain('La salida no existe o ya fue cancelada previamente');
	});

	it('denies role cajero from canceling an outlet', () => {
		const prodId = execSql(`
SELECT upsert_product_with_cost(
  NULL::uuid,
  'SKU-CANCEL-006'::varchar,
  'Engrapadora Estandar'::varchar,
  'Tira completa 26/6'::text,
  120.00::numeric,
  65.00::numeric,
  10.000::numeric,
  2.000::numeric,
  NULL::text
);
`, { role: 'admin', userId: ADMIN_ID });

		const outletId = execSql(`
SELECT process_stock_outlet(
  jsonb_build_array(jsonb_build_object('product_id', '${prodId}'::uuid, 'quantity', 2.000)),
  'f0000000-0000-0000-0000-000000000005'::uuid
);
`, { role: 'cajero', userId: CAJERO_ID });

		// Cajero attempts to cancel
		const cajeroCancel = runPsql(
			`SELECT cancel_stock_outlet('${outletId}'::uuid, 'Intento de cancelacion por cajero');`,
			{ role: 'cajero', userId: CAJERO_ID }
		);
		expect(cajeroCancel.status).not.toBe(0);
		expect(cajeroCancel.stderr).toContain('Solo un Administrador puede cancelar salidas');

		// Stock remains deducted (10 - 2 = 8)
		const stock = execSql(`SELECT stock FROM products WHERE id = '${prodId}';`);
		expect(Number(stock)).toBe(8.000);

		// Outlet is not canceled
		const isCanceled = execSql(`SELECT is_canceled FROM stock_outlets WHERE id = '${outletId}';`);
		expect(isCanceled).toBe('f');
	});

	it('fails when attempting to cancel a non-existent outlet ID', () => {
		const fakeId = '00000000-0000-0000-0000-999999999999';
		const res = runPsql(
			`SELECT cancel_stock_outlet('${fakeId}'::uuid, 'No existe');`,
			{ role: 'admin', userId: ADMIN_ID }
		);
		expect(res.status).not.toBe(0);
		expect(res.stderr).toContain('La salida no existe o ya fue cancelada previamente');
	});
});
