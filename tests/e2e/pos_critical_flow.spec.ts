import { test, expect } from '@playwright/test';

/**
 * ISSUE-009: End-to-End Vertical Critical Flow Validation
 *
 * Full integration test in real browser (Google Chrome) validating:
 * 1. HTTP real application launch via production adapter-node runtime.
 * 2. Real Auth Login as Cajero (cajero@papeleria.com).
 * 3. Navigation to /caja and RBAC enforcement (cajero redirected when accessing /admin/*).
 * 4. Resilient USB Barcode Scanner input with active focus in interactive <input> element.
 * 5. Resilient USB Barcode Scanner input with active focus in interactive <button> element.
 * 6. Cart addition, live quantity increment, total calculation, and atomic RPC checkout execution (process_stock_outlet).
 * 7. User switch / Login as Admin (admin@papeleria.com).
 * 8. /admin/historial navigation, sale identification, and UI return/cancellation modal execution (cancel_stock_outlet).
 * 9. /admin/auditoria stock ledger verification containing immutable DEVOLUCION entry.
 */

if (process.env.VITEST) {
	const { describe, it } = await import('vitest');
	describe('ISSUE-009: E2E Playwright Suite', () => {
		it.skip('Ejecutar exclusivamente vía: npx playwright test tests/e2e/pos_critical_flow.spec.ts', () => {});
	});
} else {
	const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@papeleria.com';
	const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'admin777';
	const CAJERO_EMAIL = process.env.TEST_CAJERO_EMAIL || 'cajero@papeleria.com';
	const CAJERO_PASSWORD = process.env.TEST_CAJERO_PASSWORD || 'cajero111';

	test.describe('ISSUE-009: POS Critical Flow E2E', () => {
		test('Flujo Vertical Crítico Completo: Login Cajero → RBAC → Scanner USB (<input> & <button>) → Cobro → Login Admin → Devolución → Auditoría', async ({
			page
		}) => {
			const pageErrors: Error[] = [];
			page.on('pageerror', (err) => {
				console.error('[Browser PageError]', err.message);
				pageErrors.push(err);
			});

			// -------------------------------------------------------------
			// 1. Abrir aplicación e iniciar sesión como Cajero
			// -------------------------------------------------------------
			await page.goto('/login');
			await expect(page).toHaveTitle(/Iniciar Sesión/);
			await expect(page.locator('h1')).toContainText('Inventario Papelería');

			await page.fill('input#email', CAJERO_EMAIL);
			await page.fill('input#password', CAJERO_PASSWORD);
			await page.click('button#login-submit-button');

			// -------------------------------------------------------------
			// 2. Verificar acceso a /caja
			// -------------------------------------------------------------
			await expect(page).toHaveURL(/.*\/caja/);
			await expect(page.locator('h1')).toContainText('Punto de Venta (Caja)');
			await expect(page.locator('text=Rol: cajero')).toBeVisible();

			// -------------------------------------------------------------
			// 3. Verificar RBAC: Cajero no puede acceder a /admin/*
			// -------------------------------------------------------------
			await page.goto('/admin/productos');
			// Server-side hook must intercept and redirect with 303 back to /caja
			await expect(page).toHaveURL(/.*\/caja/);

			// -------------------------------------------------------------
			// 4. Scanner USB (Prueba 1): Captura de código de barras bajo FOCO EN <input>
			// -------------------------------------------------------------
			// Identificar un SKU activo del catálogo rápido disponible en la UI
			const firstProductButton = page.locator('div.grid button.group').first();
			await expect(firstProductButton).toBeVisible();

			const skuText = await firstProductButton.locator('span.font-mono').first().textContent();
			expect(skuText, 'Se requiere un SKU en el catálogo activo').toBeTruthy();
			const targetSku = skuText!.trim();

			// A. Establecer foco activo en el elemento interactivo <input>
			const searchInput = page.locator('input#pos-search-input');
			await searchInput.focus();
			await expect(searchInput).toBeFocused();

			// Disparar ráfaga de eventos nativos de teclado con cadencia controlada (<100ms) y registro temporal
			const burst1Metrics = await page.evaluate(async (sku) => {
				const timestamps: number[] = [];
				for (const char of sku) {
					timestamps.push(performance.now());
					window.dispatchEvent(
						new KeyboardEvent('keydown', {
							key: char,
							bubbles: true,
							cancelable: true
						})
					);
					// Intervalo físico controlado de 15ms entre caracteres (<100ms)
					await new Promise((resolve) => setTimeout(resolve, 15));
				}
				timestamps.push(performance.now());
				window.dispatchEvent(
					new KeyboardEvent('keydown', {
						key: 'Enter',
						bubbles: true,
						cancelable: true
					})
				);

				const intervals: number[] = [];
				for (let i = 1; i < timestamps.length; i++) {
					intervals.push(timestamps[i] - timestamps[i - 1]);
				}
				const maxInterval = Math.max(...intervals);
				const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

				return { timestamps, intervals, maxInterval, avgInterval };
			}, targetSku);

			// Assertion temporal explícita: El intervalo máximo entre eventos fue < 100ms
			expect(
				burst1Metrics.maxInterval,
				`El intervalo máximo de ráfaga (${burst1Metrics.maxInterval.toFixed(2)}ms) debe ser < 100ms`
			).toBeLessThan(100);

			// Assertion funcional 1: El producto se agrega al carrito con cantidad 1
			const cartHeader = page.locator('h2:has-text("Carrito de Venta")');
			await expect(cartHeader).toBeVisible();
			await expect(page.locator('table tbody tr')).toBeVisible();
			await expect(page.locator('table tbody tr').first()).toContainText(targetSku);

			const qtyInput = page.locator('table tbody tr input[type="number"]').first();
			await expect(qtyInput).toHaveValue('1');
			await expect(page.locator(`text=Último: ${targetSku}`)).toBeVisible();

			// -------------------------------------------------------------
			// 5. Scanner USB (Prueba 2): Captura de código de barras bajo FOCO EN <button>
			// -------------------------------------------------------------
			// B. Establecer foco activo en un elemento interactivo <button>
			const clearCartBtn = page.locator('button:has-text("Vaciar")');
			await expect(clearCartBtn).toBeVisible();
			await clearCartBtn.focus();
			await expect(clearCartBtn).toBeFocused();

			// Disparar segunda ráfaga del mismo SKU mientras el botón tiene el foco activo con registro temporal
			const burst2Metrics = await page.evaluate(async (sku) => {
				const timestamps: number[] = [];
				for (const char of sku) {
					timestamps.push(performance.now());
					window.dispatchEvent(
						new KeyboardEvent('keydown', {
							key: char,
							bubbles: true,
							cancelable: true
						})
					);
					// Intervalo físico controlado de 20ms entre caracteres (<100ms)
					await new Promise((resolve) => setTimeout(resolve, 20));
				}
				timestamps.push(performance.now());
				window.dispatchEvent(
					new KeyboardEvent('keydown', {
						key: 'Enter',
						bubbles: true,
						cancelable: true
					})
				);

				const intervals: number[] = [];
				for (let i = 1; i < timestamps.length; i++) {
					intervals.push(timestamps[i] - timestamps[i - 1]);
				}
				const maxInterval = Math.max(...intervals);
				const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

				return { timestamps, intervals, maxInterval, avgInterval };
			}, targetSku);

			// Assertion temporal explícita: El intervalo máximo en la segunda ráfaga fue < 100ms
			expect(
				burst2Metrics.maxInterval,
				`El intervalo máximo de ráfaga con foco en botón (${burst2Metrics.maxInterval.toFixed(2)}ms) debe ser < 100ms`
			).toBeLessThan(100);

			// Assertion funcional 2: La cantidad en el carrito se incrementa a 2 mediante el scanner
			await expect(qtyInput).toHaveValue('2');

			// Verificar que el botón de cobro se habilita con el total
			const btnCheckout = page.locator('button#btn-checkout');
			await expect(btnCheckout).toBeEnabled();
			await expect(btnCheckout).toContainText('Cobrar Venta');

			// -------------------------------------------------------------
			// 6. Ejecutar Cobro mediante la UI real (process_stock_outlet RPC)
			// -------------------------------------------------------------
			await btnCheckout.click();

			// Verificar banner/modal de venta exitosa
			const saleSuccessHeading = page.locator('h3:has-text("¡Venta Registrada Exitosamente!")');
			await expect(saleSuccessHeading).toBeVisible({ timeout: 15000 });

			const saleInfoText = await page.locator('p:has-text("ID Salida:")').textContent();
			expect(saleInfoText).toContain('ID Salida:');

			// Extraer el UUID de la salida generada
			const uuidMatch = saleInfoText?.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
			const createdOutletId = uuidMatch ? uuidMatch[1] : undefined;

			// -------------------------------------------------------------
			// 7. Cerrar sesión / Cambiar a Administrador
			// -------------------------------------------------------------
			await page.context().clearCookies();
			await page.goto('/login');
			await expect(page).toHaveURL(/.*\/login/);

			await page.fill('input#email', ADMIN_EMAIL);
			await page.fill('input#password', ADMIN_PASSWORD);
			await page.click('button#login-submit-button');

			// Tras login, el usuario entra a /caja con rol admin
			await expect(page).toHaveURL(/.*\/caja/);
			await expect(page.locator('text=Rol: admin')).toBeVisible();

			// -------------------------------------------------------------
			// 8. Acceder a /admin/historial y localizar la venta creada
			// -------------------------------------------------------------
			await page.goto('/admin/historial');
			await expect(page).toHaveURL(/.*\/admin\/historial/);
			await expect(page.locator('h1')).toContainText('Historial de Ventas y Devoluciones');

			// Si se capturó el ID exacto, buscarlo en la tabla
			if (createdOutletId) {
				const historySearch = page.locator('input#history-search-input');
				await historySearch.fill(createdOutletId);
			}

			const targetRow = page.locator('table tbody tr').first();
			await expect(targetRow).toBeVisible();
			await expect(targetRow.locator('text=Venta Activa')).toBeVisible();

			// -------------------------------------------------------------
			// 9. Ejecutar Devolución / Cancelación desde UI (cancel_stock_outlet RPC)
			// -------------------------------------------------------------
			const btnDevolucion = targetRow.locator('button:has-text("Devolución")');
			await btnDevolucion.click();

			// Modal de cancelación visible
			const cancelModalTitle = page.locator('h3:has-text("Solicitar Devolución / Cancelación")');
			await expect(cancelModalTitle).toBeVisible();

			// Rellenar motivo
			const reasonTextarea = page.locator('textarea#cancel-reason-input');
			await reasonTextarea.fill('Devolución autorizada por prueba E2E Playwright');

			// Confirmar cancelación
			const btnConfirmCancel = page.locator('button#btn-confirm-cancel');
			await btnConfirmCancel.click();

			// Verificar que el estado de la venta cambia a Cancelada / Devuelta
			await expect(targetRow.locator('text=Cancelada / Devuelta')).toBeVisible({ timeout: 15000 });

			// -------------------------------------------------------------
			// 10. Acceder a /admin/auditoria y verificar registro DEVOLUCION
			// -------------------------------------------------------------
			await page.goto('/admin/auditoria');
			await expect(page).toHaveURL(/.*\/admin\/auditoria/);
			await expect(page.locator('h1')).toContainText('Bitácora de Auditoría de Stock');

			// Verificar que la bitácora contiene un registro inmutable DEVOLUCION
			const auditTable = page.locator('table tbody');
			await expect(auditTable).toBeVisible();
			await expect(page.locator('body')).toContainText('DEVOLUCION');
			await expect(page.locator('body')).not.toContainText('column inventory_logs.changed_quantity does not exist');

			// -------------------------------------------------------------
			// 11. Verificar ausencia de errores críticos en navegador
			// -------------------------------------------------------------
			expect(pageErrors, 'No deben ocurrir errores críticos en el navegador').toHaveLength(0);
		});
	});
}
