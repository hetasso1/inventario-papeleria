import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * ISSUE-000 — Smoke tests: validate that the Vitest harness is operational
 * and that the v8.0 migration SQL file contains the complete schema contract
 * defined by the SRS.
 *
 * These are deterministic, offline tests — no Supabase connection required.
 * RLS/RPC integration tests belong to ISSUE-001.
 */
describe('ISSUE-000 — Harness & Migration v8.0 Contract', () => {
	const migrationPath = resolve('supabase/migrations/20260829000000_init_v8.sql');
	const sql = readFileSync(migrationPath, 'utf-8');

	// --- Enums ---
	it('defines user_role enum with admin and cajero', () => {
		expect(sql).toContain("CREATE TYPE user_role AS ENUM ('admin', 'cajero')");
	});

	it('defines inventory_change_type enum with all 5 values', () => {
		expect(sql).toContain("CREATE TYPE inventory_change_type AS ENUM ('VENTA', 'DEVOLUCION', 'REABASTECIMIENTO', 'AJUSTE_MANUAL', 'MERMA')");
	});

	// --- Tables ---
	it('creates products table', () => {
		expect(sql).toContain('CREATE TABLE products');
	});

	it('creates product_costs table', () => {
		expect(sql).toContain('CREATE TABLE product_costs');
	});

	it('creates stock_outlets table', () => {
		expect(sql).toContain('CREATE TABLE stock_outlets');
	});

	it('creates stock_outlet_items table', () => {
		expect(sql).toContain('CREATE TABLE stock_outlet_items');
	});

	it('creates inventory_logs table', () => {
		expect(sql).toContain('CREATE TABLE inventory_logs');
	});

	// --- RLS ---
	it('enables Row Level Security on all 5 tables', () => {
		expect(sql).toContain('ALTER TABLE products ENABLE ROW LEVEL SECURITY');
		expect(sql).toContain('ALTER TABLE product_costs ENABLE ROW LEVEL SECURITY');
		expect(sql).toContain('ALTER TABLE stock_outlets ENABLE ROW LEVEL SECURITY');
		expect(sql).toContain('ALTER TABLE stock_outlet_items ENABLE ROW LEVEL SECURITY');
		expect(sql).toContain('ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY');
	});

	it('defines SELECT policy on stock_outlet_items for authenticated users', () => {
		const fixRlsPath = resolve('supabase/migrations/20260902000000_fix_stock_outlet_items_rls.sql');
		const fixRlsSql = readFileSync(fixRlsPath, 'utf-8');
		expect(fixRlsSql).toContain('CREATE POLICY "Renglones salidas propias o Admin" ON stock_outlet_items FOR SELECT');
	});

	// --- Audit trigger ---
	it('defines stock audit trigger on products', () => {
		expect(sql).toContain('log_product_stock_changes');
		expect(sql).toContain('trg_audit_product_stock');
		expect(sql).toContain('AFTER UPDATE ON products');
	});

	// --- RPCs ---
	it('defines upsert_product_with_cost RPC', () => {
		expect(sql).toContain('CREATE OR REPLACE FUNCTION upsert_product_with_cost');
	});

	it('defines process_stock_outlet RPC', () => {
		expect(sql).toContain('CREATE OR REPLACE FUNCTION process_stock_outlet');
	});

	it('defines cancel_stock_outlet RPC', () => {
		expect(sql).toContain('CREATE OR REPLACE FUNCTION cancel_stock_outlet');
	});

	// --- No DELETE on products (Soft Delete) ---
	it('does NOT define a DELETE policy on products (Soft Delete enforced)', () => {
		expect(sql).toContain('is_active BOOLEAN NOT NULL DEFAULT true');
		expect(sql).not.toMatch(/CREATE POLICY.*ON products FOR DELETE/i);
	});

	// --- SECURITY DEFINER ---
	it('uses SECURITY DEFINER SET search_path = public on privileged functions', () => {
		expect(sql).toContain('SECURITY DEFINER SET search_path = public');
	});
});
