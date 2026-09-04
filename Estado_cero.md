# Estado Cero — Web App Inventario Papelería

## Stack Arquitectónico Vigente (SRS v8.1)
- **Frontend / Server:** SvelteKit + TailwindCSS
- **Base de datos:** PostgreSQL 15 local
- **Runtime DB:** Docker (`pg_integration_test` en puerto `5433`, base `inventario_dev`)
- **Driver:** `pg` (`pg.Pool`)
- **Auth:** Autenticación local con hash PBKDF2 en `auth.users`
- **Sesiones:** Cookies HTTP-only firmadas con HMAC-SHA256 (`app_session`)
- **Seguridad:** PostgreSQL RLS (políticas sobre rol no-superuser `authenticated`)
- **Lógica transaccional:** RPCs PostgreSQL (`upsert_product_with_cost`, `process_stock_outlet`, `cancel_stock_outlet`)
- **Auditoría:** Triggers inmutables (`trg_audit_product_stock`) + bitácora de almacén `inventory_logs`
- **Tests:** Vitest (`npm run test`: 92 passed, 1 skipped, 0 failed)
- **E2E:** Playwright (`npx playwright test`: 1 passed en Chromium)

## Trazabilidad Histórica de la Transición (v8.0 → v8.1)
* **Línea Base Original (SRS v8.0):** El proyecto inició con una especificación de backend serverless basada en Supabase Cloud (`*.supabase.co`, GoTrue Cloud, PostgREST y Storage Cloud). Dicha especificación se encuentra preservada íntegramente en `Documento de Requerimientos de Software (SRS) — Versión 8.0 (Especificación de Arquitectura Final).pdf`.
* **Evolución Arquitectónica Vigente (SRS v8.1):** Debido a requerimientos de soberanía técnica, resiliencia operativa y funcionamiento 100% offline, el sistema evolucionó formalmente a una arquitectura autónoma con PostgreSQL 15 local en Docker y driver nativo `pg`, documentada y aprobada en `docs/SRS_v8.1_Arquitectura_Local.md`.

## Estructura de Rutas Autorizadas
- `supabase/migrations/`
- `src/hooks.server.ts`
- `src/lib/supabase/`
- `src/routes/`
- `src/lib/components/`
- `tests/`
- `docs/`