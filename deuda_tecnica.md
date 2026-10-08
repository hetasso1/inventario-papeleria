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

- [x] ✅ ~~**ISSUE-010: Hotfix de Semántica de Calendario y Corrección de Filtros de Fechas en Historial**~~
  - **Módulo:** Ventas & Logística / Admin UI (`/admin/historial`)
  - **Descripción:** Corrección de error 500 y de la semántica de límites temporales en el filtrado de salidas de stock por fecha.
    - **Causa Raíz:** `LocalQueryBuilder` no soportaba los métodos `.gte()`/`.lte()`; el servidor de Historial invocaba esos métodos y producía HTTP 500 (`TypeError: query.gte is not a function`). Además, se corrigió la semántica de límites de fecha para trabajar con días calendario completos mediante intervalo semiabierto `[inicio del día, inicio del día siguiente)` (`[startBoundMs, endBoundMs)`), resolviendo el desfase de zona horaria (UTC vs. tiempo local de negocio) que provocaba que ventas nocturnas quedaran fuera de su día o fueran absorbidas por el filtro `Hoy`.
    - **Corrección:** Implementación de intervalo semiabierto `[inicio del día, inicio del día siguiente)`, normalización temporal defensiva con `getOutletLocalTimeMs` agnóstica a tipos `Date` e ISO con o sin zona horaria, y verificación condicional previa antes de invocar métodos no soportados en el query builder.
  - **Archivos Autorizados:**
    - `src/routes/admin/historial/+page.server.ts`
    - `src/routes/admin/historial/+page.svelte`
    - `tests/ui/returns_audit.test.ts`
    - `deuda_tecnica.md`
  - **Evidencia de Resolución:**
    - Commit: `57295357cb4da010e28742fd0a6ecb87938bca5b` (`fix: corregir filtros de fechas en historial`)
    - Pruebas automatizadas: `npm run test` (114 passed, 1 skipped, 0 failed).
    - Validación manual en Chromium real contra PostgreSQL local: HTTP 200 sin filtros (22 ventas, $325.00), Hoy (0 ventas, sin ventas arrastradas del día anterior), 06/09 → 06/09 (15 ventas incluyendo nocturnas folios 21 y 22, $225.00), 06/09 → 07/09 (15 ventas) y 02/09 → 02/09 (7 ventas).

- [x] ✅ ~~**FEATURE-PROD-IMG-PRECISION: Precisión Decimal, Drag & Drop y Almacenamiento Local de Imágenes en Productos**~~
  - **Módulo:** Inventario / Admin UI (`/admin/productos`)
  - **Descripción:** Implementación de mejoras operativas y de experiencia de usuario en el catálogo y modal de productos:
    - **Precisión Decimal y Spinners:** Flechas y valores numéricos con incrementos funcionales exactos: Precio de venta (`step="0.5"`), Costo unitario (`step="0.01"`), Stock actual (`step="1"`), Stock mínimo (`step="1"`). Admisión de valores decimales libres ingresados manualmente (p. ej. stock 5.25 y min_stock 0.008) según la precisión de base de datos `NUMERIC(10,3)` para inventario y `NUMERIC(10,2)` para moneda, validados defensivamente sin bloqueo por `stepMismatch`.
    - **Drag & Drop:** Reemplazo de campo textual de URL por zona Drag & Drop interactiva con selector de archivo, previsualización inmediata, reemplazo y cancelación de selección, y conservación de imagen existente al editar.
    - **Persistencia Local y Endpoint:** Almacenamiento de archivos en `static/uploads/products/` con nombres únicos vía UUID (`/uploads/products/<uuid>.<ext>`), validados en servidor y cliente (MIME, tamaño máx. 5 MB, extensión y nombre seguro). Servido en runtime mediante el endpoint GET `src/routes/uploads/products/[filename]/+server.ts` con protección contra path traversal.
    - **Visualización en Catálogo:** Miniaturas de producto ampliadas en un 75% lineal (de 40x40 px a 70x70 px) con placeholders e iconos proporcionales.
    - **Invariantes Arquitectónicos:** Preservación de seguridad Admin-only, RLS en `product_costs`, RPC `upsert_product_with_cost`, Soft Delete (`is_active = false`) e idempotencia.
  - **Archivos Autorizados:**
    - `src/routes/admin/productos/+page.svelte`
    - `src/routes/admin/productos/+page.server.ts`
    - `src/lib/components/admin/ProductModal.svelte`
    - `src/routes/uploads/products/[filename]/+server.ts`
    - `tests/ui/admin_products.test.ts`
    - `deuda_tecnica.md`
  - **Evidencia de Resolución:**
    - Pruebas focalizadas: `npx vitest run tests/ui/admin_products.test.ts` (36 passed, 0 failed).
    - Compilación de producción: `npm run build` (exit code 0; warnings Svelte 5 limitados a los 2 preexistentes en login y productos; 0 warnings nuevos).
    - Verificación de formato: `git diff --check` (exit code 0).
    - Suite completa: `npm run test` (121 passed, 1 skipped, 7 failed debidos exclusivamente a indisponibilidad DNS/red de Supabase Cloud preexistente, desacoplada de la arquitectura local).
    - Validación funcional E2E en Chromium real: ciclo completo de creación con Drag & Drop, preview, guardado, recarga, reemplazo de imagen, persistencia tras reinicio del servidor y soft delete. Validación funcional real de spinners de producto en Chromium: precio 5.00 → 5.50 (step 0.5), stock 5 → 6 (step 1), stock mínimo 2 → 3 (step 1), costo 5.00 → 5.01 (step 0.01); ingreso manual de stock 5.25 y stock mínimo 0.008 aceptado sin bloqueo.

- [x] ✅ ~~**FEATURE-POS-PAYMENT-CART: Persistencia de Carrito, Formas de Pago (Efectivo/Tarjeta/Mixto) y Cambio en Caja**~~ (~~⏳ Pendiente de revisión~~ / ✅ Aprobado)
  - **Módulo:** POS / Caja UI & Core Backend (`/caja`, RPC `process_stock_outlet`)
  - **Descripción:** Implementación de flujo de cobro robusto y persistencia segura de carrito en punto de venta:
    - **Persistencia Aislada del Carrito:** Carrito persistido en `sessionStorage` indexado por usuario y sesión (`caja_cart_${userId}_${sessionId}`), garantizando que sobreviva a navegación interna entre secciones, desmontaje/recreación de `/caja` y recargas accidentales de página. Mecanismo de derivación de sesión a partir de cookie segura `app_session` con invalidación ante logout, garantizando que un nuevo login o un usuario distinto no recuperen carritos de sesiones anteriores. Sanitización estricta al hidratar contra catálogo activo (eliminación de productos inactivos/inexistentes, cantidades limitadas al stock actual disponible, poda de sesiones obsoletas en almacenamiento). Limpieza automática inmediata tras venta completada con éxito o vaciado explícito. Cero persistencia en base de datos previa a la venta formal.
    - **Formas de Pago y Cálculo de Cambio:** Soporte completo para tres métodos de pago:
      1. *Solo Efectivo:* Admisión de pago exacto o mayor con cálculo reactivo de cambio (ej. Total $347.50, Recibido $500.00 -> Cambio $152.50). Botones de acceso rápido para importes comunes y cambio devuelto visualmente destacado.
      2. *Solo Tarjeta:* Cargo del 100% en terminal con cambio estrictamente $0.00 (sin campo de cambio en tarjeta).
      3. *Pago Mixto:* Desglose entre importe en tarjeta y efectivo, calculando saldo restante en efectivo y cambio si el efectivo entregado supera la fracción requerida.
      - *Validaciones Defensivas:* Bloqueo de ventas con importes negativos, valores NaN o no numéricos, pago insuficiente (`efectivo + tarjeta < total`), cambio negativo o ausencia de método de pago válido.
    - **Persistencia Financiera en DB & RPC Idempotente:** Migración incremental `20261007000000_add_payment_details_to_stock_outlets.sql` incorporando `payment_method`, `cash_amount`, `card_amount`, `cash_received` y `change_amount` a `stock_outlets` con constraints `CHECK`. Redefinición de `process_stock_outlet` con cálculo autoritativo en servidor/DB a partir de precios oficiales en `products`, conservando `SECURITY DEFINER`, `search_path = public`, transacciones atómicas, validación de stock, auditoría en `inventory_logs`, RLS estricto e idempotencia basada en `p_idempotency_key` (reintentos devuelven folio existente sin duplicar deducciones físicas ni financieras). Firma y sobrecarga retrocompatible para llamadas existentes.
  - **Archivos Autorizados:**
    - `src/routes/caja/+page.svelte`
    - `src/routes/caja/+page.server.ts`
    - `src/lib/components/caja/CartTable.svelte`
    - `supabase/migrations/20261007000000_add_payment_details_to_stock_outlets.sql`
    - `tests/ui/scanner_checkout.test.ts`
    - `tests/db/process_outlet.test.ts`
    - `tests/e2e/pos_critical_flow.spec.ts`
    - `deuda_tecnica.md`
  - **Evidencia de Resolución:**
    - 158 tests locales passed; 0 tests locales failed; 1 skipped; 7 fallos Cloud conocidos de ISSUE-007 por DNS ENOTFOUND (`npm run test`).
    - Playwright: 2 passed, 0 failed (`npx playwright test tests/e2e/pos_critical_flow.spec.ts`).
    - Pruebas focalizadas Vitest: 51 passed, 0 failed (`tests/db/process_outlet.test.ts` y `tests/ui/scanner_checkout.test.ts`).
    - Compilación de producción: `npm run build` (exit code 0; warnings Svelte 5 limitados a los 2 preexistentes).
    - Verificación de formato: `git diff --check` (exit code 0).
    - Carrito aislado por usuario + sesión; efectivo/tarjeta/mixto; cálculo de cambio; persistencia financiera; idempotencia/RLS preservados.

- [x] ✅ ~~**FEATURE-ADMIN-USERS: Gestión de Usuarios para Admin, Multi-Cajero y Baja Lógica**~~ (~~⏳ Pendiente de revisión~~ / ✅ Aprobado)
  - **Módulo:** Admin UI & Auth Backend (`/admin/usuarios`, `auth.users`, `src/lib/supabase/server.ts`)
  - **Descripción:** Implementación de administración centralizada de múltiples usuarios Cajero exclusiva para Admin:
    - **Modelo de Identidad Unificado:** La fuente de identidad continúa siendo exclusivamente `auth.users` sin crear una tabla de usuarios paralela. Migración incremental `20261007000000_add_user_management.sql` incorporando `username` (VARCHAR(64) UNIQUE NOT NULL), `display_name` (VARCHAR(255) NOT NULL) e `is_active` (BOOLEAN NOT NULL DEFAULT true). Backfill de usuarios existentes asegurando compatibilidad total sin romper logins previos.
    - **Baja Lógica Estricta:** Implementación de baja lógica mediante `is_active`. Semántica estricta: usuario existente → true, usuario nuevo → true por defecto, usuario desactivado → false; `NULL` no admitido (garantizado con constraint `NOT NULL`). La autenticación en `src/lib/supabase/server.ts` exige exclusivamente `is_active = true`. Un usuario desactivado no puede autenticarse ni iniciar sesión.
    - **Protección de Roles & Prevención de Segundo Admin:** Acceso a `/admin/usuarios` exclusivo para Admin en Server Load y Actions (RBAC con redirección 303 a `/caja` para cajeros). El rol para usuarios creados queda imperativamente fijo en `cajero` en `raw_app_meta_data.role`; no se admite rol enviado desde cliente. Se bloquea la creación de un segundo Admin y la desactivación del único Admin.
    - **Seguridad Criptográfica e Integridad Referencial:** Hasheo con PBKDF2-HMAC-SHA512 (100,000 iteraciones, salt de 16 bytes, clave de 64 bytes) idéntico al estándar del sistema. Nunca se expone `encrypted_password`. Se prohíbe la eliminación física de usuarios para preservar las claves foráneas históricas de ventas (`stock_outlets.user_id`) y auditoría.
  - **Archivos Autorizados:**
    - `src/routes/admin/usuarios/+page.svelte`
    - `src/routes/admin/usuarios/+page.server.ts`
    - `supabase/migrations/20261007000000_add_user_management.sql`
    - `src/lib/supabase/server.ts`
    - `tests/auth/user_management.test.ts`
    - `tests/e2e/pos_critical_flow.spec.ts`
    - `deuda_tecnica.md`
  - **Evidencia de Resolución:**
    - 16 tests específicos de gestión de usuarios passed, 0 failed.
    - 174 tests locales passed, 0 local failed, 1 skipped.
    - 7 fallos Cloud conocidos de ISSUE-007 por ENOTFOUND, separados de los resultados locales.
    - Playwright Gestión de Usuarios: 1 passed, 0 failed.
    - npm run build: exit 0.
    - git diff --check: exit 0.
    - migración 20261007000000_add_user_management.sql.
    - is_active NOT NULL DEFAULT true.
    - login exige is_active = true.
    - múltiples cajeros soportados.
    - segundo Admin bloqueado.
    - usuario desactivado no puede autenticarse.
    - usuarios no se eliminan físicamente.
    - historial conserva stock_outlets.user_id.

- [ ] ⏳ **FEATURE-STOCK-CLEANUP-IDENTITY: Cleanup Visual de Stock e Identidad Humana** (~~⏳ Pendiente de revisión~~)
  - **Módulo:** UI Presentation & Server Identity Resolution (`/caja`, `CartTable`, `/admin/historial`, `/admin/auditoria`)
  - **Descripción:** Optimización de presentación visual y legibilidad en frontend sin alterar contratos de base de datos ni modelos de datos:
    - **Stock sin `.000`:** En todas las vistas donde se presenta stock o cantidades al usuario (`/caja` catálogo rápido, `CartTable` filas de carrito, `/admin/historial` modal de detalle de artículos vendidos, `/admin/auditoria` stock anterior, variación y nuevo stock), los valores se formatean de forma limpia eliminando ceros decimales superfluos (`5.000` → `5`, `10.000` → `10`, `0.000` → `0`) preservando con exactitud decimales significativos (ej. `5.25`, `0.008`) sin redondear ni truncar arbitrariamente. No se altera el tipo `NUMERIC(10,3)`, DB, validaciones ni RPCs.
    - **Identidad Humana:** En Historial de Ventas y Bitácora de Auditoría, se resuelve server-side la identidad humana (`display_name` y `username`) de los usuarios responsables a partir de `auth.users`, presentándola como identificador principal (`Por: Nombre Completo (@username)`). Se conservan íntegros los UUIDs internos para trazabilidad histórica (`stock_outlets.user_id`, `inventory_logs.created_by`).
    - **Preservación de Usuarios Desactivados:** La resolución server-side en `auth.users` no filtra por `is_active = true`, permitiendo que usuarios desactivados con actividad histórica sigan mostrando su identidad humana correctamente.
    - **Aislamiento y Seguridad:** Sin tablas paralelas de usuarios, sin cambios de roles, sin modificar RLS, Soft Delete, RPCs ni idempotencia.
  - **Archivos Autorizados:**
    - `src/routes/caja/+page.svelte`
    - `src/lib/components/caja/CartTable.svelte`
    - `src/routes/admin/historial/+page.server.ts`
    - `src/routes/admin/historial/+page.svelte`
    - `src/routes/admin/auditoria/+page.server.ts`
    - `src/routes/admin/auditoria/+page.svelte`
    - `tests/ui/returns_audit.test.ts`
    - `tests/ui/scanner_checkout.test.ts`
    - `tests/e2e/pos_critical_flow.spec.ts`
    - `deuda_tecnica.md`
  - **Evidencia de Resolución:**
    - 69 tests específicos passed (40 en `tests/ui/scanner_checkout.test.ts`, 29 en `tests/ui/returns_audit.test.ts`), 0 failed.
    - 181 tests locales passed, 0 local failed, 1 skipped (7 fallos Cloud conocidos de ISSUE-007 por DNS ENOTFOUND aislados).
    - Playwright E2E: 3 passed, 0 failed en `tests/e2e/pos_critical_flow.spec.ts`.
    - Build: `npm run build` exit code 0.
    - Formato: `git diff --check` exit code 0.
    - Trazabilidad UUID interna intacta y usuarios desactivados resueltos históricamente.

---

## Sprint History

| Sprint | Issue | Estado | Cambios Clave | Skill Actualizado |
| :--- | :--- | :--- | :--- | :--- |
| 24 | FEATURE-STOCK-CLEANUP-IDENTITY | ~~⏳ Pendiente de revisión~~ | Cleanup visual de stock (eliminación de `.000` superfluo en Caja, Carrito, Historial y Auditoría manteniendo decimales significativos intactos) y resolución de identidad humana server-side desde `auth.users` (`display_name` y `username`) en Historial y Auditoría; preservación estricta de UUIDs para trazabilidad interna (`stock_outlets.user_id`, `inventory_logs.created_by`) y de usuarios desactivados con actividad histórica. Evidencia: 69 tests específicos passed (scanner + audit), 181 tests locales passed, 0 locales failed, 1 skipped, 7 fallos Cloud DNS conocidos de ISSUE-007; Playwright 3 passed, 0 failed; build exit 0; git diff --check exit 0. | N/A |
| 23 | FEATURE-ADMIN-USERS | ~~⏳ Pendiente de revisión~~ / ✅ Aprobado | Administración de múltiples usuarios Cajero en /admin/usuarios exclusiva para Admin: identidad única en auth.users sin tabla paralela, columnas username (único), display_name e is_active NOT NULL DEFAULT true; autenticación estricta con is_active = true en server.ts; prevención de segundo Admin en UI, Server Actions y DB; bloqueo de desactivación del único Admin; contraseñas con PBKDF2-HMAC-SHA512 sin exponer hashes; preservación física de usuarios y trazabilidad histórica de stock_outlets.user_id. Evidencia: 16 tests específicos passed, 0 failed; 174 tests locales passed, 0 failed, 1 skipped; 7 fallos Cloud DNS conocidos de ISSUE-007; Playwright Gestión de Usuarios 1 passed, 0 failed; build exit 0; git diff --check exit 0. | N/A |
| 22 | FEATURE-POS-PAYMENT-CART | ~~⏳ Pendiente de revisión~~ / ✅ Aprobado | Flujo de cobro robusto en /caja: persistencia de carrito en sessionStorage aislado por usuario y sesión (caja_cart_${userId}_${sessionId}) con invalidación ante logout/nuevo login, tres modalidades de pago (Efectivo, Tarjeta, Mixto), cálculo exacto de cambio (ej. $347.50 con $500.00 -> $152.50), rechazo preventivo y en servidor de importes insuficientes/negativos/NaN, migración 20261007000000_add_payment_details_to_stock_outlets.sql con columnas financieras auditables en stock_outlets, RPC process_stock_outlet autoritativa con precios oficiales de DB, compatibilidad retroactiva, RLS e idempotencia ante reintentos. Evidencia: 158 tests locales passed, 0 locales failed, 1 skipped, 7 fallos Cloud DNS conocidos; Playwright 2 passed, 0 failed; build exit 0; diff-check exit 0. | N/A |
| Post-Beta | FEATURE-PROD-IMG | ✅ Aprobado / Resuelto | Precisión numérica y spinners en /admin/productos (precio step 0.5, costo step 0.01, stock step 1, stock mínimo step 1; admisión manual de decimales stock 5.25 y min_stock 0.008), zona Drag & Drop con selector/preview/reemplazo/cancelación, persistencia local en static/uploads/products/ con URL /uploads/products/<uuid>.<ext>, endpoint GET seguro contra path traversal, validación MIME/tamaño/nombre, catálogo ampliado a 70x70 px (+75%), preservación de Admin-only/RLS/RPC/Soft Delete. Validación técnica: tests focalizados 36 passed, 0 failed; build exit code 0 con únicamente los 2 warnings Svelte conocidos; git diff --check exit 0; full suite con 121 passed, 1 skipped y 7 fallos preexistentes/externos de conectividad Supabase Cloud no atribuibles a la feature; validación funcional completa en Chromium (precio 5.00 → 5.50, stock 5 → 6, stock mínimo 2 → 3, costo 5.00 → 5.01). | N/A |
| Post-Beta | ISSUE-010 | ✅ Resuelto | Hotfix de filtros de fechas en Historial (/admin/historial): Causa raíz: LocalQueryBuilder no soportaba .gte()/.lte(); el servidor de Historial invocaba esos métodos y producía HTTP 500; además se corrigió la semántica de límites de fecha para trabajar con días calendario completos mediante intervalo semiabierto [inicio del día, inicio del día siguiente). Evidencia de resolución: commit 57295357cb4da010e28742fd0a6ecb87938bca5b, npm run test: 114 passed, 1 skipped, 0 failed, y validación manual en Chromium contra PostgreSQL local (sin filtros: HTTP 200, 22 ventas; Hoy: 0 ventas sin arrastrar día anterior; 06/09 -> 06/09: 15 ventas incluyendo nocturnas folios 21 y 22; 06/09 -> 07/09: 15 ventas; 02/09 -> 02/09: 7 ventas). | N/A |
| 21 | BETA-PREP-AUDIT | ~~⏳ Pendiente de revisión~~ / ✅ Aprobado | Auditoría integral del sistema contra SRS v8.0 / v8.1 para entrega Beta: resolución de discrepancia de migraciones en documentación de despliegue local (incorporación de migración incremental 20260906000000_enforce_integer_quantities_in_pos.sql en README.md y ARQUITECTURA.md), alineación de métricas de pruebas a 106 passed en toda la documentación, corrección de accesibilidad (aria-label) en modal de detalle de historial, elaboración de la Guía de Prueba Manual para evaluación Beta con credenciales canónicas y preservación estricta de invariantes RLS, RPC, Soft Delete y auditoría. Cierre administrativo: validación técnica aprobada (106 passed, 1 skipped, 0 failed; build exit code 0 con 2 warnings Svelte 5 no bloqueantes documentados en login y productos; git diff --check exit 0; commit 88a84d0). | N/A |
| 20 | MEJORAS-POS-STOCK-FOLIO | ✅ Aprobado | Control preventivo de existencias en mostrador /caja (visualización de stock disponible en catálogo rápido, bloqueo de adición y etiqueta 'Agotado' con stock <= 0, advertencia de bajo stock si stock <= min_stock, cantidad mínima de 1 y tope al stock disponible en carrito CartTable con botón '+' deshabilitado al alcanzar el límite, y validación preventiva en Server Action checkout preservando carrito e idempotency_key ante rechazo) y exposición del folio numérico oficial de salida (stock_outlets.folio) en historial de ventas y modales de detalle y cancelación sin alterar contratos UUID ni la autoridad transaccional de la RPC process_stock_outlet. | N/A |
| 19 | MEJORAS-POS | ✅ Aprobado | Implementación de cuatro mejoras operativas del POS: 1) Enforce de cantidades enteras >= 1 en Caja en UI (botón '-' deshabilitado en 1, step/min=1), Server Action (rechazo 400 de negativos, cero, null y fracciones) y DB (migración incremental 20260906000000_enforce_integer_quantities_in_pos.sql en RPC process_stock_outlet); 2) Filtros temporales en Historial de Ventas (fecha única, rango desde/hasta, preset 'Hoy', cálculo de métricas de ventas válidas e ingresos de ventas válidas excluyendo canceladas, sin exponer costos); 3) Exportación de catálogo de productos activos a CSV compatible con Excel (GET /admin/productos/export con UTF-8 BOM, RBAC solo Admin, sin exponer product_costs); 4) Protección de ProductModal ante pérdida accidental de cambios pendientes con diálogo de confirmación ante Escape o clic en backdrop. Suite de pruebas pasando al 100%. | N/A |
| 18 | DOCS-ALIGNMENT | ✅ Aprobado | Alineación documental integral post-integración de fer_test y estabilización E2E: armonización de Estado_cero.md, README.md, ARQUITECTURA.md, docs/SRS_v8.1_Arquitectura_Local.md y deuda_tecnica.md; formalización del sistema de diseño UI (Badge, Button, Card, Input, cn), iconografía Svelte 5 (lucide-svelte), contratos visuales E2E (/caja <h1>, Último:, ID Salida:) y registro formal de deuda técnica de dependencias (DEBT-DEP-001, DEBT-DEP-002) sin alterar código ni runtime. | N/A |
| 17 | E2E-CONTRATOS | ✅ Aprobado | Restauración de contratos visuales y jerarquía de headings tras merge de fer_test: resolución de colisión de headings (breadcrumb global a <span> y heading semántico único en /caja a <h1>), ajuste de contratos textuales de escáner ('Último:') y modal de venta ('ID Salida:'). Suite 100% verde (Playwright: 1 passed; Vitest: 92 passed, 1 skipped; Build: exit 0). | N/A |
| 16 | ARQUITECTURA | ✅ Aprobado | Actualización integral de docs/ARQUITECTURA.md alineada con el SRS v8.1: formalización de PostgreSQL 15 local en Docker (pg_integration_test), conexión nativa con pg.Pool, autenticación local con PBKDF2 en auth.users, sesiones con cookies HTTP-only firmadas (HMAC-SHA256), RLS activo con SET LOCAL transaccional y clasificación de Supabase Cloud como referencia histórica. | N/A |
| 15 | SRS-v8.1 | ✅ Aprobado | Formalización de la enmienda técnica y arquitectónica en docs/SRS_v8.1_Arquitectura_Local.md, consolidando el funcionamiento 100% local sobre PostgreSQL 15 en Docker, driver pg.Pool, autenticación por cookies HTTP-only y actualización de Estado_cero.md, preservando la trazabilidad histórica del SRS v8.0 original. | N/A |
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

---

## Deuda Técnica de Dependencias y Mantenimiento

- [ ] ⏳ **DEBT-DEP-001: Dependencia Huérfana del Ecosistema React (`lucide-react`)**
  - **Módulo:** Dependencias de Proyecto (`package.json`)
  - **Descripción:** Durante la integración de los componentes visuales de `fer_test`, se instaló la biblioteca `lucide-react` (`^1.41.0`). El proyecto utiliza exclusivamente Svelte 5 / SvelteKit 2 como runtime de frontend y consume los iconos vectoriales nativos de `lucide-svelte` (`^1.0.1`). `lucide-react` no es importado por ningún componente ni forma parte del bundle de producción compilado con `@sveltejs/adapter-node`, pero permanece en `package.json` para no alterar el árbol de dependencias en sprints no dedicados a mantenimiento de paquetes.
  - **Plan de mitigación:** Ejecutar `npm uninstall lucide-react` y regenerar `package-lock.json` en un sprint futuro de depuración de dependencias.

- [ ] ⏳ **DEBT-DEP-002: Alias Redundante de Iconografía (`@lucide/svelte`)**
  - **Módulo:** Dependencias de Proyecto (`package.json`)
  - **Descripción:** Coexistencia de `@lucide/svelte` (`^1.41.0`) y `lucide-svelte` (`^1.0.1`). La aplicación importa sistemáticamente sus componentes de iconos desde `lucide-svelte`.
  - **Plan de mitigación:** Remover `@lucide/svelte` en el próximo sprint de consolidación de dependencias.
