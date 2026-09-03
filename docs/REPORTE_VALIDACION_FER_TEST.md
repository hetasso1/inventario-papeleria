# Reporte de Validación y Saneamiento — fer_test

## 1. Baseline
- **Commit baseline:** `bbca07c9d96bbab219d85b732099b2cffc42076e`
- **Mensaje:** `docs: add core functional specification and update README`
- **Fecha / Contexto:** Sprint 10 completado y aprobado. Último estado funcional de referencia con especificación técnica, arquitectura, manuales y 85 tests unitarios / 1 test E2E Playwright en verde.

---

## 2. Commit actual de fer_test
- **Commit HEAD:** `4da5d51b1e4ee0111c9e4f0fe2b9d605d6dff856`
- **Mensaje:** `eliminar credenciales`
- **Historial de commits en la rama (3 commits ahead):**
  1. `a866551` — *Entrar a ver* (Fernando-Angulo) — ⚠️ *Contiene exposición histórica de credenciales*
  2. `e0a32bb` — *Visualizacion de productos en tabla* (Fernando-Angulo)
  3. `4da5d51` — *eliminar credenciales* (Fernando-Angulo)

---

## 3. Estado Actual de la Rama

### A. Pruebas Automáticas
- **Vitest (`npm run test`):**
  - **10 passed | 1 skipped (11 test files)**
  - **87 passed / 0 failed / 1 skipped (88 tests totales)**
  - El test skipped corresponde a `tests/e2e/pos_critical_flow.spec.ts` (reservado para Playwright).
- **Playwright E2E (`npx playwright test`):**
  - **1 passed / 0 failed** (Flujo vertical crítico completo ejecutado en Chromium real en 9.9s).
- **Formato y diff:**
  - `git diff --check`: Salida completamente vacía (código de salida 0).

### B. Estado de Base de Datos y RLS
- **Migración inicial (`supabase/migrations/20260829000000_init_v8.sql`):**
  - Restaurada al baseline `bbca07c`.
  - `git diff bbca07c -- supabase/migrations/20260829000000_init_v8.sql`: **0 diferencias (idéntica byte a byte)**.
- **Migración incremental (`supabase/migrations/20260902000000_fix_stock_outlet_items_rls.sql`):**
  - Presente localmente: **YES**
  - Contenido: Política `"Renglones salidas propias o Admin"` en `stock_outlet_items`.
- **Estado de RLS en Supabase Cloud:**
  ```text
  RLS migration present locally: YES
  RLS migration applied in Cloud: NO
  ```
  - Comprobación empírica: Consulta directa a `stock_outlet_items` como Admin en Supabase Cloud retorna 0 filas debido a la ausencia de la directiva permisiva en el proyecto remoto.
  - El sistema en Cloud opera actualmente gracias al mecanismo de **fallback resiliente a `inventory_logs`** implementado en `src/routes/admin/historial/+page.server.ts`.
  - **Instrucción para aplicar en Cloud:** Ejecutar en el **SQL Editor** de Supabase Cloud el siguiente script:
    ```sql
    DROP POLICY IF EXISTS "Renglones salidas propias o Admin" ON stock_outlet_items;

    CREATE POLICY "Renglones salidas propias o Admin" ON stock_outlet_items FOR SELECT TO authenticated
      USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        OR EXISTS (
          SELECT 1 FROM stock_outlets so
          WHERE so.id = stock_outlet_items.outlet_id
            AND so.user_id = auth.uid()
        )
      );
    ```

### C. Variables de Entorno y Secretos
- **`.env.example`:** Saneado. Contiene exclusivamente marcadores de posición estándar (`your-project-id.supabase.co`, `your_supabase_anon_key`, `your_admin_secure_password`, etc.), sin espacios en blanco al final de línea y libre de contraseñas o tokens reales.
- **`.env.local`:** Confirmado como ignorado por `.gitignore` (línea 26: `.env.*`) y no rastreado por Git (`git ls-files .env.local` vacío).

---

## 4. Seguridad Histórica en Git

### Auditoría de Secretos en el Historial:
1. **Commits que contienen credenciales reales:**
   - **`a866551`** (*Entrar a ver*): Se introdujeron claves de conexión y contraseñas de cuentas de prueba en `.env.example`.
2. **Ramas afectadas:**
   - Exclusivamente **`fer_test`** y **`origin/fer_test`**.
   - Las ramas `main` y `harold_test` **NO contienen** este commit.
3. **Estado actual en el repositorio:**
   - Aunque el commit posterior `4da5d51` reemplazó los valores por marcadores dummy en el árbol de trabajo, los secretos permanecen accesibles en el historial de objetos de Git para cualquier persona con acceso al repositorio remoto.
4. **Procedimiento recomendado para reescritura (a ejecutar en sprint dedicado):**
   - **Paso 1:** Iniciar rebase interactivo desde el baseline:
     ```bash
     git rebase -i bbca07c9d96bbab219d85b732099b2cffc42076e
     ```
   - **Paso 2:** Fusionar (*squash*) los 3 commits de Fer (`a866551`, `e0a32bb`, `4da5d51`) junto con los ajustes de saneamiento en un único commit atómico:
     ```text
     feat(historial): fix stock_outlet_items visibility and add navigation header
     ```
   - **Paso 3:** Verificar que `.env.example` en ese commit resultante contenga únicamente placeholders genéricos.
   - **Paso 4:** Rotar de manera preventiva las contraseñas de las cuentas de prueba (`admin@papeleria.com`, `cajero@papeleria.com`) en Supabase Cloud.

---

## 5. Archivos en Working Tree

| Archivo | Estado | Categoría |
|---|---|---|
| `.env.example` | Saneado | Configuración |
| `supabase/migrations/20260829000000_init_v8.sql` | Restaurado | Base de datos (Idéntico a `bbca07c`) |
| `supabase/migrations/20260902000000_fix_stock_outlet_items_rls.sql` | Conservado | Base de datos (Migración incremental) |
| `tests/setup.test.ts` | Actualizado | Tests (Valida migración incremental) |
| `deuda_tecnica.md` | Actualizado | Documentación de Sprints |
| `docs/REPORTE_VALIDACION_FER_TEST.md` | Actualizado | Documentación de Auditoría |

---

## 6. Dictamen de este Sprint

```text
APROBADO
```
*(Con bloqueo pendiente documentado: las credenciales históricas requieren reescritura de Git previa a cualquier integración hacia `main`).*
