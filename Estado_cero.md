# Estado Cero — Web App Inventario Papelería

## Stack Arquitectónico Vigente (SRS v8.1)
- **Frontend / Server:** SvelteKit 2 (`^2.63.0`) + Svelte 5 (`^5.56.1`) + TailwindCSS 4 (`^4.3.0`)
- **Sistema de Diseño UI:** Componentes atómicos base en `src/lib/components/ui/` (`Badge`, `Button`, `Card`, `Input`), utilidad de fusión de clases `cn` (`clsx` + `tailwind-merge`), tokens semánticos en `src/routes/layout.css` e iconografía vectorial nativa para Svelte 5 (`lucide-svelte`)
- **Shell de Navegación:** `src/routes/+layout.svelte` con barra lateral responsiva para escritorio, cajón colapsable (*drawer*) para móviles y barra superior de migas de pan (*breadcrumbs*) renderizadas como `<span>`
- **Contratos Visuales E2E:** Contratos textuales estables para automatización crítica: heading semántico principal `<h1>` exclusivo por vista (`/caja` posee su propio `<h1>Punto de Venta (Caja)</h1>`), indicador de escáner `Último: {lastScannedCode}` y banner de confirmación `ID Salida: {completedSale.id}`
- **Base de Datos:** PostgreSQL 15 local
- **Runtime DB:** Docker (`pg_integration_test` en puerto `5433`, base `inventario_dev`)
- **Driver:** Driver nativo `pg` (`pg.Pool`) con gestión transaccional segura
- **Auth:** Autenticación local con hash PBKDF2-HMAC-SHA512 en `auth.users`
- **Sesiones:** Cookies HTTP-only firmadas con HMAC-SHA256 (`app_session`)
- **Seguridad:** PostgreSQL RLS activo en las 5 tablas sobre rol no-superuser `authenticated` con contexto de claims inyectado vía `SET LOCAL`
- **Lógica Transaccional:** RPCs PostgreSQL (`upsert_product_with_cost`, `process_stock_outlet`, `cancel_stock_outlet`) con control de concurrencia e idempotencia
- **Auditoría:** Triggers automáticos inmutables (`trg_audit_product_stock`) + bitácora forense de almacén `inventory_logs`
- **Operación POS (Sprints 19-20):** Cantidades enteras obligatorias $\ge 1$, control preventivo de existencias en mostrador (bloqueo de agotados y tope máximo disponible en carrito), folio oficial numérico de salida (`stock_outlets.folio`), filtros temporales con métricas en historial, exportación de catálogo a CSV compatible con Excel y protección de formularios ante pérdida de datos.
- **Tests Unitarios e Integración:** Vitest (`npm run test`: 106 passed, 1 skipped, 0 failed)
- **E2E:** Playwright (`npx playwright test`: 1 passed, 0 failed en Chromium contra servidor compilado con `@sveltejs/adapter-node`)

## Trazabilidad Histórica de la Transición (v8.0 → v8.1)
* **Línea Base Original (SRS v8.0):** El proyecto inició con una especificación de backend serverless basada en Supabase Cloud (`*.supabase.co`, GoTrue Cloud, PostgREST y Storage Cloud). Dicha especificación se encuentra preservada íntegramente en `Documento de Requerimientos de Software (SRS) — Versión 8.0 (Especificación de Arquitectura Final).pdf`.
* **Evolución Arquitectónica Vigente (SRS v8.1):** Debido a requerimientos de soberanía técnica, resiliencia operativa y funcionamiento 100% offline, el sistema evolucionó formalmente a una arquitectura autónoma con PostgreSQL 15 local en Docker y driver nativo `pg`, documentada y aprobada en `docs/SRS_v8.1_Arquitectura_Local.md`.
* **Integración Visual y Estabilización E2E:** El trabajo visual integrado desde `fer_test` introdujo un sistema de diseño desacoplado e iconografía Svelte 5. Se estabilizaron los contratos semánticos visuales preservando la unicidad de headings (`<h1>` exclusivo por vista, breadcrumb global como `<span>`) y contratos textuales requeridos por la suite de pruebas E2E en navegador real.

## Aclaración sobre Dependencias del Ecosistema React
* El runtime funcional de la aplicación es **estrictamente SvelteKit / Svelte 5**. En ningún caso se utiliza runtime de React ni se ha reemplazado Svelte.
* La dependencia `lucide-react` presente en `package.json` es una reliquia inactiva introducida durante la importación inicial de recursos visuales y no interviene en el empaquetado ni ejecución del cliente. Su retiro está catalogado formalmente como deuda técnica de dependencias (`DEBT-DEP-001`).

## Estructura de Rutas Autorizadas
- `supabase/migrations/`
- `src/hooks.server.ts`
- `src/lib/supabase/`
- `src/routes/`
- `src/lib/components/`
- `src/lib/utils.ts`
- `tests/`
- `docs/`
