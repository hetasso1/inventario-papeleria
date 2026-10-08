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

			// Sprint 24 Tarea 1: Verificar que el stock mostrado en catálogo no contiene .000
			const catalogStock = await firstProductButton.locator('text=• Stock:').textContent();
			expect(catalogStock, 'El stock en catálogo no debe tener .000').not.toMatch(/\.000\b/);

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

			// Sprint 24 Tarea 1: Verificar que el stock mostrado en la tabla del carrito no contiene .000
			const cartStock = await page.locator('table tbody tr').first().locator('text=Stock:').textContent();
			expect(cartStock, 'El stock en carrito no debe tener .000').not.toMatch(/\.000\b/);

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

			// Sprint 24 Tarea 2: Historial muestra identidad humana en vez de UUID como identificador principal
			await expect(targetRow.locator('text=Por: cajero')).toBeVisible();
			// Sprint 24 Tarea 3: Trazabilidad interna continúa utilizando UUID
			await expect(targetRow.locator('text=ID:')).toBeVisible();

			// Abrir detalle y verificar cajero responsable y cantidades sin .000
			const btnVerArticulos = targetRow.locator('button:has-text("Ver Artículos")');
			await btnVerArticulos.click();
			const detailModal = page.locator('div[role="dialog"]');
			await expect(detailModal).toBeVisible();
			await expect(detailModal.locator('text=Cajero Responsable:')).toBeVisible();
			await expect(detailModal.getByText('cajero', { exact: true })).toBeVisible();
			await expect(detailModal.locator('text=UUID:')).toBeVisible();
			const detailQtyCell = detailModal.locator('table tbody tr td').nth(2);
			const detailQtyText = await detailQtyCell.textContent();
			expect(detailQtyText, 'Cantidad en detalle no debe tener .000').not.toMatch(/\.000\b/);
			await detailModal.locator('button:has-text("Cerrar")').click();

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

			// Sprint 24 Tarea 2: Auditoría muestra identidad humana en vez de solo UUID
			await expect(auditTable.locator('text=Por:').first()).toBeVisible();
			// Sprint 24 Tarea 1: Auditoría muestra variación y stocks sin .000
			const firstRowContent = await auditTable.locator('tr').first().textContent();
			expect(firstRowContent, 'Stock en auditoría no debe contener .000').not.toMatch(/\b\d+\.000\b/);

			// -------------------------------------------------------------
			// 11. Verificar ausencia de errores críticos en navegador
			// -------------------------------------------------------------
			expect(pageErrors, 'No deben ocurrir errores críticos en el navegador').toHaveLength(0);
		});

		test('Persistencia del Carrito y Aislamiento de Sesión: navegación, reload, venta y nuevo login', async ({
			page
		}) => {
			const pageErrors: Error[] = [];
			page.on('pageerror', (err) => {
				console.error('[Browser PageError]', err.message);
				pageErrors.push(err);
			});

			// -------------------------------------------------------------
			// 1. Iniciar sesión como Admin y entrar a /caja
			// -------------------------------------------------------------
			await page.goto('/login');
			await expect(page).toHaveTitle(/Iniciar Sesión/);
			await page.fill('input#email', ADMIN_EMAIL);
			await page.fill('input#password', ADMIN_PASSWORD);
			await page.click('button#login-submit-button');

			await expect(page).toHaveURL(/.*\/caja/);
			await expect(page.locator('h1')).toContainText('Punto de Venta (Caja)');

			// -------------------------------------------------------------
			// 2. Agregar producto al carrito desde el catálogo rápido
			// -------------------------------------------------------------
			const firstProductButton = page.locator('div.grid button.group').first();
			await expect(firstProductButton).toBeVisible();
			const skuText = await firstProductButton.locator('span.font-mono').first().textContent();
			expect(skuText, 'Se requiere un producto en el catálogo').toBeTruthy();
			const targetSku = skuText!.trim();

			await firstProductButton.click();

			// Verificar producto agregado en el carrito
			const cartRow = page.locator('table tbody tr').first();
			await expect(cartRow).toBeVisible();
			await expect(cartRow).toContainText(targetSku);
			await expect(cartRow.locator('input[type="number"]')).toHaveValue('1');

			// -------------------------------------------------------------
			// 3. Navegar fuera de /caja a otra sección (/admin/productos) y regresar
			// -------------------------------------------------------------
			await page.goto('/admin/productos');
			await expect(page).toHaveURL(/.*\/admin\/productos/);
			await expect(page.locator('h1')).toContainText('Catálogo de Productos');

			// Regresar a /caja y verificar que el carrito sigue intacto
			await page.goto('/caja');
			await expect(page).toHaveURL(/.*\/caja/);
			await expect(page.locator('table tbody tr').first()).toBeVisible();
			await expect(page.locator('table tbody tr').first()).toContainText(targetSku);
			await expect(page.locator('table tbody tr input[type="number"]').first()).toHaveValue('1');

			// -------------------------------------------------------------
			// 4. Recargar accidentalmente la página (reload) y verificar carrito intacto
			// -------------------------------------------------------------
			await page.reload();
			await expect(page).toHaveURL(/.*\/caja/);
			await expect(page.locator('table tbody tr').first()).toBeVisible();
			await expect(page.locator('table tbody tr').first()).toContainText(targetSku);
			await expect(page.locator('table tbody tr input[type="number"]').first()).toHaveValue('1');

			// -------------------------------------------------------------
			// 5. Completar la venta y verificar carrito vacío
			// -------------------------------------------------------------
			const btnCheckout = page.locator('button#btn-checkout');
			await expect(btnCheckout).toBeEnabled();
			await btnCheckout.click();

			// Modal/alerta de venta exitosa visible
			await expect(page.locator('h3:has-text("¡Venta Registrada Exitosamente!")')).toBeVisible({ timeout: 15000 });

			// El carrito debe estar completamente vacío
			await expect(page.locator('text=El carrito está vacío')).toBeVisible();
			await expect(page.locator('table tbody tr')).toHaveCount(0);

			// -------------------------------------------------------------
			// 6. Agregar un nuevo producto para dejar carrito pendiente en Sesión 1
			// -------------------------------------------------------------
			await firstProductButton.click();
			await expect(page.locator('table tbody tr').first()).toBeVisible();
			await expect(page.locator('table tbody tr').first()).toContainText(targetSku);

			// -------------------------------------------------------------
			// 7. Cerrar sesión e iniciar nueva sesión
			// -------------------------------------------------------------
			await page.locator('button[aria-label="Cerrar sesión"]').first().click();
			await expect(page).toHaveURL(/.*\/login/);

			// Iniciar nueva sesión como Cajero
			await page.fill('input#email', CAJERO_EMAIL);
			await page.fill('input#password', CAJERO_PASSWORD);
			await page.click('button#login-submit-button');

			await expect(page).toHaveURL(/.*\/caja/);

			// -------------------------------------------------------------
			// 8. Verificar que NO reaparece el carrito de la sesión anterior
			// -------------------------------------------------------------
			await expect(page.locator('text=El carrito está vacío')).toBeVisible();
			await expect(page.locator('table tbody tr')).toHaveCount(0);

			// Sin errores críticos en navegador
			expect(pageErrors, 'No deben ocurrir errores en navegador durante el ciclo de vida del carrito').toHaveLength(0);
		});

		test('Gestión de Usuarios: Admin crea Cajero Daniel → Daniel accede /caja → Daniel rechazado en /admin/usuarios → Admin desactiva Daniel → Daniel no puede iniciar sesión', async ({
			page
		}) => {
			const pageErrors: Error[] = [];
			page.on('pageerror', (err) => {
				console.error('[Browser PageError]', err.message);
				pageErrors.push(err);
			});

			const DANIEL_USERNAME = `daniel_e2e_${Date.now()}`;
			const DANIEL_DISPLAY = 'Daniel E2E Test';
			const DANIEL_PASSWORD = 'daniel_e2e_123';
			const DANIEL_EMAIL = `${DANIEL_USERNAME.toLowerCase()}@papeleria.local`;

			// -------------------------------------------------------------
			// 1. Login como Admin
			// -------------------------------------------------------------
			await page.goto('/login');
			await page.fill('input#email', ADMIN_EMAIL);
			await page.fill('input#password', ADMIN_PASSWORD);
			await page.click('button#login-submit-button');

			await expect(page).toHaveURL(/.*\/caja/);
			await expect(page.locator('text=Rol: admin')).toBeVisible();

			// -------------------------------------------------------------
			// 2. Navegar a /admin/usuarios
			// -------------------------------------------------------------
			await page.goto('/admin/usuarios');
			await expect(page).toHaveURL(/.*\/admin\/usuarios/);
			await expect(page.locator('h1')).toContainText('Gestión de Usuarios');

			// -------------------------------------------------------------
			// 3. Crear Cajero Daniel
			// -------------------------------------------------------------
			await page.click('button#btn-create-user');
			await expect(page.locator('h3:has-text("Crear Nuevo Cajero")')).toBeVisible();

			await page.fill('input#create-username', DANIEL_USERNAME);
			await page.fill('input#create-display-name', DANIEL_DISPLAY);
			await page.fill('input#create-password', DANIEL_PASSWORD);
			await page.fill('input#create-confirm-password', DANIEL_PASSWORD);
			await page.click('button#btn-submit-create');

			// Verificar feedback de éxito
			await expect(page.locator('#feedback-banner')).toContainText('exitosamente');

			// Verificar que Daniel aparece en la tabla
			const danielRowInTable = page.locator(`table tbody tr:has-text("${DANIEL_USERNAME}")`);
			await expect(danielRowInTable).toBeVisible();
			await expect(danielRowInTable).toContainText(DANIEL_DISPLAY);

			// -------------------------------------------------------------
			// 4. Cerrar sesión Admin
			// -------------------------------------------------------------
			await page.context().clearCookies();
			await page.goto('/login');
			await expect(page).toHaveURL(/.*\/login/);

			// -------------------------------------------------------------
			// 5. Login como Daniel (nuevo Cajero)
			// -------------------------------------------------------------
			await page.fill('input#email', DANIEL_EMAIL);
			await page.fill('input#password', DANIEL_PASSWORD);
			await page.click('button#login-submit-button');

			await expect(page).toHaveURL(/.*\/caja/);
			await expect(page.locator('h1')).toContainText('Punto de Venta (Caja)');

			// 5b. Daniel realiza una venta antes de ser desactivado (para probar trazabilidad histórica de usuario desactivado)
			const danielProductBtn = page.locator('div.grid button.group').first();
			await expect(danielProductBtn).toBeVisible();
			await danielProductBtn.click();
			const danielCheckoutBtn = page.locator('button#btn-checkout');
			await expect(danielCheckoutBtn).toBeEnabled();
			await danielCheckoutBtn.click();
			await expect(page.locator('h3:has-text("¡Venta Registrada Exitosamente!")')).toBeVisible({ timeout: 15000 });

			// -------------------------------------------------------------
			// 6. Daniel intenta acceder a /admin/usuarios → RBAC lo redirige
			// -------------------------------------------------------------
			await page.goto('/admin/usuarios');
			await expect(page).toHaveURL(/.*\/caja/);

			// -------------------------------------------------------------
			// 7. Cerrar sesión Daniel, Login Admin
			// -------------------------------------------------------------
			await page.context().clearCookies();
			await page.goto('/login');
			await page.fill('input#email', ADMIN_EMAIL);
			await page.fill('input#password', ADMIN_PASSWORD);
			await page.click('button#login-submit-button');

			await expect(page).toHaveURL(/.*\/caja/);

			// -------------------------------------------------------------
			// 8. Admin desactiva Daniel
			// -------------------------------------------------------------
			await page.goto('/admin/usuarios');
			await expect(page).toHaveURL(/.*\/admin\/usuarios/);

			// Locate Daniel's row and click deactivate
			const danielRow = page.locator(`tr:has-text("${DANIEL_USERNAME}")`);
			await expect(danielRow).toBeVisible();

			const deactivateBtn = danielRow.locator('button[aria-label*="Desactivar"]');
			await deactivateBtn.click();

			// Verify Daniel is now shown as Inactivo
			await expect(danielRow.locator('text=Inactivo')).toBeVisible({ timeout: 10000 });

			// -------------------------------------------------------------
			// 9. Daniel ya no puede iniciar sesión
			// -------------------------------------------------------------
			await page.context().clearCookies();
			await page.goto('/login');
			await page.fill('input#email', DANIEL_EMAIL);
			await page.fill('input#password', DANIEL_PASSWORD);
			await page.click('button#login-submit-button');

			// Should remain on /login with error (inactive user rejected)
			await expect(page).toHaveURL(/.*\/login/);
			await expect(page.locator('text=Credenciales inválidas')).toBeVisible({ timeout: 5000 });

			// -------------------------------------------------------------
			// 10. Sprint 24: Usuario desactivado con registros históricos sigue apareciendo correctamente
			// -------------------------------------------------------------
			await page.fill('input#email', ADMIN_EMAIL);
			await page.fill('input#password', ADMIN_PASSWORD);
			await page.click('button#login-submit-button');
			await expect(page).toHaveURL(/.*\/caja/);

			// Verificar en Historial que la venta de Daniel sigue mostrando su display_name a pesar de estar desactivado
			await page.goto('/admin/historial');
			await expect(page).toHaveURL(/.*\/admin\/historial/);
			const danielSaleRow = page.locator(`table tbody tr:has-text("${DANIEL_DISPLAY}")`).first();
			await expect(danielSaleRow).toBeVisible();
			await expect(danielSaleRow).toContainText(`Por: ${DANIEL_DISPLAY}`);

			// Verificar en Auditoría que el log de Daniel sigue mostrando su display_name
			await page.goto('/admin/auditoria');
			await expect(page).toHaveURL(/.*\/admin\/auditoria/);
			const danielAuditRow = page.locator(`table tbody tr:has-text("${DANIEL_DISPLAY}")`).first();
			await expect(danielAuditRow).toBeVisible();
			await expect(danielAuditRow).toContainText(`Por: ${DANIEL_DISPLAY}`);

			// Sin errores críticos en navegador
			expect(pageErrors, 'No deben ocurrir errores durante gestión de usuarios E2E').toHaveLength(0);
		});
	});
}
