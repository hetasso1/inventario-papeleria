# Deuda Técnica — Web App Inventario Papelería

## Backlog de Issues (SRS v8.0)

- [x] ✅ ~~**ISSUE-000: Initial Scaffolding, Migration v8.0 & Test Harness**~~
  - **Módulo:** Infraestructura / Database Setup
  - **Descripción:** Inicializar proyecto SvelteKit (TypeScript), configurar TailwindCSS, cliente Supabase (`server.ts`/`client.ts`), migración SQL v8.0 y configurar Vitest (`npm run test`).
  - **Archivos Autorizados:**
    - `package.json`
    - `vite.config.ts`
    - `src/hooks.server.ts`
    - `src/lib/supabase/client.ts`
    - `src/lib/supabase/server.ts`
    - `supabase/migrations/20260829000000_init_v8.sql`
    - `tests/setup.test.ts`

- [x] ✅ ~~**ISSUE-001: Pruebas de Integración DB (RLS, RPCs, Idempotencia y Soft Delete)**~~
  - **Módulo:** Core Backend / DB Tests
  - **Descripción:** Crear suite de pruebas en Vitest que valide la migración v8.0: verificar que el cajero no lee `product_costs`, probar `process_stock_outlet` con idempotencia, `cancel_stock_outlet` y Soft Delete (`is_active = false`).
  - **Archivos Autorizados:**
    - `tests/db/rls_costs.test.ts`
    - `tests/db/process_outlet.test.ts`
    - `tests/db/cancel_outlet.test.ts`

- [x] ✅ ~~**ISSUE-002: Autenticación, Roles y Guardias de Ruta Server-Side**~~
  - **Módulo:** Auth & Middleware (`hooks.server.ts`)
  - **Descripción:** Implementar el middleware de SvelteKit para interceptar peticiones SSR. Si un usuario con rol `cajero` intenta acceder a `/admin/*`, redirigir inmediatamente con respuesta 303 a `/caja`. Formulario de Login.
  - **Archivos Autorizados:**
    - `src/hooks.server.ts`
    - `src/routes/login/+page.svelte`
    - `src/routes/login/+page.server.ts`
    - `tests/auth/route_guards.test.ts`

- [x] ✅ ~~**ISSUE-003: Módulo Admin: Catálogo de Productos y Gestión de Costos**~~
  - **Módulo:** Inventario / Admin UI
  - **Descripción:** Tabla de productos con filtrado por búsqueda. Formulario para alta/edición de productos invocando la RPC `upsert_product_with_cost` (acceso a costo restringido a Admin). Implementar Soft Delete (`is_active = false`) en lugar de eliminación física.
  - **Archivos Autorizados:**
    - `src/routes/admin/productos/+page.svelte`
    - `src/routes/admin/productos/+page.server.ts`
    - `src/lib/components/admin/ProductModal.svelte`
    - `tests/ui/admin_products.test.ts`

- [x] ✅ ~~**ISSUE-004: Módulo Caja: Escáner USB Resiliente y Cobro Atómico**~~
  - **Módulo:** POS / Caja UI
  - **Descripción:** Pantalla de ventas `/caja`. Implementar listener global `window.addEventListener('keydown')` para capturar ráfagas de escáner de código de barras (<100ms) sin perder el foco. Generación de `idempotency_key` (UUID) en el cliente y llamada a `process_stock_outlet`.
  - **Archivos Autorizados:**
    - `src/routes/caja/+page.svelte`
    - `src/routes/caja/+page.server.ts`
    - `src/lib/components/caja/BarcodeScanner.svelte`
    - `src/lib/components/caja/CartTable.svelte`
    - `tests/ui/scanner_checkout.test.ts`

- [x] ✅ ~~**ISSUE-005: Historial de Ventas, Auditoría y Devoluciones**~~
  - **Módulo:** Ventas & Logística / Admin UI
  - **Descripción:** Vista `/admin/historial` para consultar salidas registradas. Modal para solicitar cancelación/devolución invocando la RPC `cancel_stock_outlet` (restringido a Admin). Vista del registro inmutable de auditoría `inventory_logs`.
  - **Archivos Autorizados:**
    - `src/routes/admin/historial/+page.svelte`
    - `src/routes/admin/historial/+page.server.ts`
    - `src/routes/admin/auditoria/+page.svelte`
    - `src/routes/admin/auditoria/+page.server.ts`
    - `tests/ui/returns_audit.test.ts`

- [x] ✅ ~~**ISSUE-006: Scanner DOM & Lifecycle Validation**~~
  - **Módulo:** POS / UI Testing
  - **Descripción:** Crear tests DOM reales (`jsdom`/`happy-dom`) con `window.dispatchEvent(new KeyboardEvent(...))` para probar captura bajo foco activo en `<input>` y `<button>`, envío por `Enter`, desmontaje del listener y no duplicación en remount.
  - **Archivos Autorizados:**
    - `src/lib/components/caja/BarcodeScanner.svelte`
    - `tests/ui/scanner_dom_lifecycle.test.ts`
    - `Deuda_Tecnica.md`

- [x] ✅ ~~**ISSUE-007: Supabase Cloud Integration / Validación de Seguridad RLS**~~
  - **Módulo:** Cloud Infrastructure & RLS Security
  - **Descripción:** Validación local canónica de seguridad RLS y migración incremental `20260902000000_fix_stock_outlet_items_rls.sql` en PostgreSQL 15 local/Docker (existencia de tabla, RLS habilitado, visibilidad completa Admin y aislamiento estricto Cajeros). Resuelto en cuanto a validación local. La aplicación DDL remota en Supabase Cloud y la rotación de credenciales permanecen documentadas como pendientes por indisponibilidad externa del servicio, preservando el fallback seguro en servidor.
  - **Archivos Autorizados:**
    - `.env.example`
    - `tests/cloud/supabase_cloud.test.ts`
    - `supabase/migrations/20260902000000_fix_stock_outlet_items_rls.sql`
    - `deuda_tecnica.md`

- [x] ✅ ~~**ISSUE-008: Production Adapter & Deployment Setup**~~
  - **Módulo:** Build & Runtime
  - **Descripción:** Reemplazar `@sveltejs/adapter-auto` por un adaptador explícito (Node.js o Vercel/Cloudflare según entorno target). Verificar `npm run build` sin warnings de entorno no detectado y script de arranque `npm run preview` / `node build`.
  - **Archivos Autorizados:**
    - `svelte.config.js`
    - `package.json`
    - `Deuda_Tecnica.md`

- [x] ✅ ~~**ISSUE-009: E2E Browser Validation**~~
  - **Módulo:** End-to-End Testing (Playwright)
  - **Descripción:** Flujo vertical crítico en navegador real: Login Cajero → Venta con Escáner → Cobro RPC → Login Admin → Anulación / Devolución RPC → Verificación en Log de Auditoría.
  - **Archivos Autorizados:**
    - `src/routes/admin/auditoria/+page.svelte`
    - `playwright.config.ts`
    - `tests/e2e/pos_critical_flow.spec.ts`
    - `Deuda_Tecnica.md`

---

## Sprint History

| Sprint | Issue | Estado | Cambios Clave | Skill Actualizado |
| :--- | :--- | :--- | :--- | :--- |
| 14 | LOCAL-OFFLINE | ✅ Aprobado | Migración a funcionamiento 100% local y offline respecto de Supabase Cloud. Integración server-side nativa con driver PostgreSQL real ('pg' y 'pg.Pool') conectando a localhost:5433/inventario_dev. Autenticación local mediante cookies HTTP-only firmadas para roles Admin y Cajero según SRS v8.0. Desactivación de llamadas externas en src/lib/supabase/client.ts. Preservación estricta de RLS mediante transacciones aisladas con SET LOCAL ROLE authenticated y SET LOCAL request.jwt.claims sin privilegios superuser ni BYPASSRLS. Ejecución directa y atómica de RPCs process_stock_outlet, cancel_stock_outlet y upsert_product_with_cost. Flujo vertical validado al 100% en navegador real (Playwright: 1 passed; Vitest: 92 passed, 0 failed, 1 skipped). Corrección documental final en README.md armonizando arquitectura local, login y credenciales canónicas. | N/A |
| 13 | ISSUE-007 | ✅ Validación Local Aprobada / ⚠️ Cloud Pendiente | Validación canónica de seguridad RLS en PostgreSQL 15 local (Docker): aplicación limpia de migración 20260902000000_fix_stock_outlet_items_rls.sql, RLS activo, visibilidad total para Admin y aislamiento estricto entre Cajeros comprobados empíricamente. Cierre local formal de ISSUE-007 sin dependencia de Supabase Cloud. Despliegue DDL en Cloud pendiente por indisponibilidad externa del servicio, preservando fallback seguro en historial/+page.server.ts. Suite completa en verde (Vitest: 92 passed, 0 failed, 1 skipped; Playwright: 1 passed, 0 failed). | N/A |
| 12 | ISSUE-005 | ✅ Aprobado | Corrección arquitectónica de /admin/auditoria: migración de consulta directa en navegador/onMount a Server Load SSR (+page.server.ts) vía locals.supabase con join products(name, sku_code) y orden cronológico descendente. Manejo seguro de errores de DB hacia mensaje genérico sin filtrar secretos internos. Eliminación de $lib/supabase/client en auditoría. 4 tests unitarios nuevos en tests/ui/returns_audit.test.ts (Vitest: 92 passed, 0 failed, 1 skipped; Playwright: 1 passed, 0 failed). | N/A |
| 11 | FER_TEST | ✅ RLS Local Validada / ⚠️ Cloud Pendiente | Saneamiento forense de fer_test en origin/fer_test (force-with-lease). Validación local completa de la política RLS de stock_outlet_items sobre PostgreSQL 15 (Docker): existencia de tabla, RLS habilitado, visibilidad completa para Admin y aislamiento estricto entre Cajeros comprobados empíricamente. RLS local: VALIDADA. RLS Cloud: PENDIENTE POR DISPONIBILIDAD DE SUPABASE. Credenciales Cloud: PENDIENTES DE ROTACIÓN POR DISPONIBILIDAD DE SUPABASE. Suite de regresión pasando al 100% (Vitest: 87/0/1, Playwright: 1/0, git diff --check limpio). | N/A |
| 10 | ISSUE-009 | ✅ Aprobado | Validación E2E en navegador real (Chromium / Google Chrome) contra Supabase Cloud y runtime Node.js: Login Cajero, RBAC /admin/* -> /caja, escáner USB con foco interactivo en input y button (<100ms), cobro atómico process_stock_outlet, Login Admin, devolución cancel_stock_outlet en /admin/historial, verificación inmutable en /admin/auditoria y corrección de columnas quantity_changed y created_by (Playwright: 1 passed, 0 failed, 0 skipped; Vitest: 85 passed, 0 failed, 1 skipped) | N/A |
| 9 | ISSUE-008 | ✅ Aprobado | Configuración de runtime de producción explícito con @sveltejs/adapter-node: build exitoso sin warnings de adapter-auto, artefacto en /build ejecutable y validado con node build / npm run start (Vitest: 85 passed, 0 failed, 1 skipped) | N/A |
| 8 | ISSUE-007 | ✅ Aprobado | Validación de integración real contra Supabase Cloud: 7/7 tests pasando contra Supabase Cloud real, incluyendo Auth Admin (admin@papeleria.com), Auth Cajero (cajero@papeleria.com), RLS en product_costs, ejecución atómica/idempotente de process_stock_outlet y RBAC/restauración en cancel_stock_outlet (Cloud: 7 passed, 0 failed, 0 skipped) | N/A |
| 7 | ISSUE-006 | ✅ Aprobado | Scanner DOM & Lifecycle: 6 tests pasando con eventos nativos KeyboardEvent vía window.dispatchEvent, incluyendo ráfaga <100ms, >=100ms, terminador Enter, foco en input, foco en button, cleanup en unmount y prevención de duplicados en remount | N/A |
| 6 | ISSUE-005 | ✅ Aprobado | Módulos /admin/historial y /admin/auditoria: historial de ventas con detalle de artículos, cancelación/devolución atómica exclusiva para admin vía RPC cancel_stock_outlet y bitácora de auditoría inmutable de solo lectura para inventory_logs (8 tests nuevos, 72/72 tests pasando) | N/A |
| 5 | ISSUE-004 | ✅ Aprobado | Módulo /caja: escáner USB resiliente con listener global keydown (<100ms), carrito con cantidades fraccionadas NUMERIC(10,3), cobro atómico e idempotente con RPC process_stock_outlet y preservación de idempotency_key en reintentos (10 tests nuevos, 64/64 tests pasando) | N/A |
| 4 | ISSUE-003 | ✅ Aprobado | Módulo /admin/productos: catálogo activo, búsqueda/filtrado, alta y edición atómica con RPC upsert_product_with_cost, costo aislado a admin, Soft Delete con UPDATE is_active = false sin DELETE físico (9 tests nuevos, 54/54 tests pasando) | N/A |
| 3 | ISSUE-002 | ✅ Aprobado | Autenticación Supabase SSR, Login con manejo seguro de credenciales, middleware hooks.server.ts con guardias RBAC (redirección 303 de cajero a /caja al intentar /admin/*, protección de rutas y derivación estricta de app_metadata.role) (13 tests nuevos, 45/45 tests pasando) | N/A |
| 2 | ISSUE-001 | ✅ Aprobado | Suite de pruebas de integración DB en PostgreSQL 15: RLS en product_costs, Soft Delete, atomicidad e idempotencia en process_stock_outlet, RBAC y reversión en cancel_stock_outlet (18 tests nuevos, 32/32 tests pasando) | N/A |
| 1 | ISSUE-000 | ✅ Aprobado | Scaffold SvelteKit+TS+TailwindCSS, clientes Supabase (browser/server), hooks.server.ts mínimo, migración v8.0 validada contra PostgreSQL 15 (0 errores SQL), 14 tests Vitest pasando | N/A |
| — | — | — | Registro inicial de backlog completo (SRS v8.0) | N/A |