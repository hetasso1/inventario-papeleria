# Documento de Requerimientos de Software (SRS) — Versión 8.1
## Especificación de Arquitectura Local y Enmienda Oficial al SRS v8.0

**Proyecto:** Web App de Gestión de Inventario y Punto de Venta para Papelería (`inventario-papeleria`)  
**Rama de Implementación Canónica:** `harold_test`  
**Fecha de Emisión:** 2 de Septiembre de 2026  
**Estado:** Especificación Arquitectónica Oficial Vigente (Enmienda Técnica Aprobada)  
**Documento Base Predecesor:** `Documento de Requerimientos de Software (SRS) — Versión 8.0 (Especificación de Arquitectura Final).pdf` (Preservado íntegramente como referencia histórica de requisitos funcionales).

---

## 1. Propósito y Alcance de la Enmienda v8.1

El presente documento constituye la especificación técnica y arquitectónica oficial **Versión 8.1** del sistema. Su objetivo es formalizar y gobernar la transición del backend desde los servicios gestionados de *Supabase Cloud* hacia una **arquitectura de ejecución 100% local y offline sobre PostgreSQL 15**, preservando de manera estricta e inalterada todos los requisitos funcionales, reglas de negocio y garantías de seguridad establecidos en el SRS v8.0 original.

### 1.1 Declaración de Independencia de Supabase Cloud
En esta versión 8.1:
1. **Supabase Cloud (`*.supabase.co`) NO es una dependencia de runtime.** La aplicación no requiere conexión a Internet ni resolución DNS hacia servidores de Supabase.
2. **GoTrue Cloud (`/auth/v1/*`) NO es una dependencia.** La autenticación y emisión de sesiones son manejadas localmente por el servidor SvelteKit.
3. **PostgREST Cloud (`/rest/v1/*`) NO es una dependencia.** El acceso a datos se realiza de forma directa desde Node.js mediante el driver nativo de PostgreSQL (`pg`).
4. **Supabase Storage Cloud (`/storage/v1/*`) NO es una dependencia.** Las imágenes de producto se manejan vía URLs locales o estáticas referenciadas en la columna `image_url`.
5. El sistema es completamente operativo en entornos locales aislados, redes de área local (LAN) o servidores dedicados sin salida a la nube pública.

---

## 2. Pila Tecnológica Vigente (Stack v8.1)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               Navegador Web                                 │
│  - Svelte 5 / SvelteKit 2 (SSR + Hidratación Reactiva)                      │
│  - TailwindCSS 4 para diseño y layout responsivo                            │
│  - Captura global de eventos de teclado para Escáner USB (<100ms)           │
│  - CERO peticiones cliente a APIs externas (src/lib/supabase/client.ts stub)│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / Form Actions / Cookies HTTP-only
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                      SvelteKit Server (Runtime Node.js)                     │
│                                                                             │
│  1. Middleware de Autenticación y RBAC (src/hooks.server.ts):               │
│     - Lectura y verificación criptográfica de cookie de sesión 'app_session' │
│     - Inyección de event.locals.user y event.locals.role                    │
│     - Guardias de ruta: Cajero a /admin/* -> Redirección 303 a /caja         │
│                                                                             │
│  2. Adaptador PostgreSQL Nativo (src/lib/supabase/server.ts):               │
│     - Pool de conexiones reutilizable con 'pg.Pool'                         │
│     - Aislamiento transaccional estricto para Row Level Security (RLS)      │
│     - Servicio de autenticación local con PBKDF2-HMAC-SHA512                │
│     - Invocación directa y atómica de procedimientos almacenados (RPCs)     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Socket TCP (localhost:5433)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    PostgreSQL 15 Local (Docker Engine)                      │
│                    Contenedor: pg_integration_test                          │
│                    Base de Datos: inventario_dev                            │
│                                                                             │
│  - Motor PostgreSQL 15 estándar (sin extensiones propietarias cloud)        │
│  - Esquema auth de compatibilidad local (auth.uid(), auth.jwt())            │
│  - Rol de aplicación sin privilegios superusuario: 'authenticated'          │
│  - Row Level Security (RLS) habilitado en las 5 tablas del sistema          │
│  - Funciones transaccionales SECURITY DEFINER (RPCs)                        │
│  - Triggers automáticos de auditoría (trg_audit_product_stock)              │
│  - Bitácora inmutable de movimientos (inventory_logs)                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mecanismo de Seguridad y RLS en Arquitectura Local

Uno de los principios inviolables del SRS v8.0 es que la seguridad de los datos debe residir en el motor de base de datos y no ser delegada únicamente a comprobaciones en la capa de aplicación web.

### 3.1 Soporte de `auth.uid()` y `auth.jwt()` en PostgreSQL Local
Las políticas RLS y los procedimientos PL/pgSQL del SRS v8.0 consumen las funciones `auth.uid()` y `auth.jwt()`. En la arquitectura local v8.1, estas funciones se implementan directamente en el esquema `auth` de la base local:

```sql
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  encrypted_password TEXT,
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
```

### 3.2 Aislamiento Transaccional sin Superusuario (`SET LOCAL`)
Para que PostgreSQL evalúe las políticas RLS sin evadirlas con privilegios administrativos (`BYPASSRLS`), el servidor SvelteKit adquiere un cliente del pool y ejecuta cada consulta o RPC dentro de una transacción acotada:

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "<uuid_usuario>", "role": "authenticated", "app_metadata": {"role": "<admin|cajero>"}}';
-- Consultas DML / Invocación de RPC
COMMIT;
```

**Propiedades de este mecanismo:**
1. **No Superusuario:** El rol `authenticated` carece de atributos `SUPERUSER` y `BYPASSRLS`. PostgreSQL fuerza la comprobación de las políticas activas de cada tabla.
2. **Sin contaminación de conexiones:** `SET LOCAL` aplica de manera exclusiva a la transacción en curso. Tras `COMMIT` o `ROLLBACK`, PostgreSQL revierte el rol y los parámetros al estado por defecto. Al retornar la conexión a `pg.Pool`, no queda residuo de la sesión previa.
3. **Resiliencia ante excepciones:** Si la consulta genera un error, el bloque `ROLLBACK` asegura la liberación limpia de la conexión física.

---

## 4. Preservación de Garantías Funcionales y de Seguridad del SRS v8.0

Todas las garantías requeridas por el SRS v8.0 se mantienen operativas al 100%:

| Garantía SRS v8.0 | Mecanismo de Cumplimiento en SRS v8.1 |
| :--- | :--- |
| **Control de Acceso (RBAC)** | Roles **Admin** y **Cajero**. Guardias de servidor en `src/hooks.server.ts` con redirección HTTP 303 obligatoria de cajero a `/caja` al intentar acceder a cualquier ruta `/admin/*`. |
| **Aislamiento de Costos** | Política RLS `"Costos solo Admin"` en tabla `product_costs`. La consulta como cajero retorna `0` filas directamente a nivel PostgreSQL. |
| **Aislamiento de Salidas por Cajero** | Políticas RLS `"Salidas propias o Admin"` en `stock_outlets` y `"Renglones salidas propias o Admin"` en `stock_outlet_items`. Cajeros únicamente pueden leer sus propias ventas; Admin visualiza el historial global. |
| **Bajas Lógicas (Soft Delete)** | Columna `is_active BOOLEAN DEFAULT true` en `products`. Se prohíbe el `DELETE` físico. Productos inactivos no pueden venderse ni consultarse en mostrador. |
| **Transacciones Atómicas de Venta** | RPC `process_stock_outlet(p_items, p_idempotency_key)` ejecuta en bloque la deducción de existencias, cálculo autoritativo de importes y generación de partidas. |
| **Idempotencia de Cobro** | `p_idempotency_key UUID` en `process_stock_outlet`. Reintentos con la misma llave retornan el folio existente sin duplicar la deducción de inventario. |
| **Devolución Atómica** | RPC `cancel_stock_outlet(p_outlet_id, p_reason)`. Exclusiva para Admin (`auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`). Restaura el stock atómicamente y genera auditoría `DEVOLUCION`. |
| **Auditoría Inmutable** | Trigger `trg_audit_product_stock` y tabla `inventory_logs`. Cada venta, devolución o ajuste manual genera un registro de almacén inalterable. |

---

## 5. Autenticación y Sesiones Locales

### 5.1 Almacenamiento de Credenciales
* Las credenciales se gestionan en la tabla `auth.users` de PostgreSQL local.
* Las contraseñas se almacenan cifradas utilizando **PBKDF2-HMAC-SHA512** con salt criptográfico de 16 bytes y 100,000 iteraciones (`salt:hash`). En ningún caso se persiste texto plano.

### 5.2 Tokens y Cookies de Sesión
* Tras validar las credenciales en `/login`, el servidor emite un token de sesión firmado mediante **HMAC-SHA256** utilizando una clave secreta de servidor (`SESSION_SECRET`).
* El token contiene: `{ id, email, app_metadata: { role }, exp }`.
* Se almacena en la cookie `app_session` con directivas: `HttpOnly=true`, `SameSite=Lax`, `Path=/`, `Secure=false` (en desarrollo local).
* El cierre de sesión en `/logout` elimina la cookie `app_session` y redirige a `/login`.

---

## 6. Compatibilidad con SRS v8.0

### Qué permanece idéntico funcionalmente:
1. **Reglas de Negocio:** Validación de precios positivos, stock mínimo, importes fraccionados a 3 decimales (`NUMERIC(10,3)`), lectura de código de barras < 100 ms y terminador `Enter`.
2. **Esquema de Datos:** Las tablas `products`, `product_costs`, `stock_outlets`, `stock_outlet_items` e `inventory_logs` conservan sus tipos de datos, restricciones de integridad y llaves foráneas.
3. **Firmas de Procedimientos Almacenados (RPCs):** Las funciones `upsert_product_with_cost`, `process_stock_outlet` y `cancel_stock_outlet` mantienen sus parámetros, tipos y comportamiento exactos.
4. **Contratos de UI y Rutas:** `/login`, `/caja`, `/admin/productos`, `/admin/historial` y `/admin/auditoria` presentan las mismas interfaces y flujos de usuario.

### Qué cambió a nivel de infraestructura:
1. **Motor de Datos:** De Supabase Cloud administrado a contenedor PostgreSQL 15 Docker local (`pg_integration_test`, puerto 5433).
2. **Driver de Conexión:** De `@supabase/ssr` vía llamadas REST HTTP (PostgREST) a socket TCP nativo Node.js gestionado con `pg.Pool`.
3. **Proveedor de Identidad:** De GoTrue Cloud a servicio de autenticación local SvelteKit con cookie firmada.
4. **Almacenamiento de Archivos:** Las imágenes no dependen de buckets de Supabase Storage; se direccionan vía URLs locales o estáticas en `image_url`.

---

## 7. Cambios Respecto a SRS v8.0

| Elemento | En SRS v8.0 | En SRS v8.1 (Vigente) |
| :--- | :--- | :--- |
| **Backend de Base de Datos** | Supabase Cloud (remoto) | PostgreSQL 15 local en Docker (`inventario_dev`) |
| **Servicio de Autenticación** | Supabase Auth (GoTrue Cloud) | Autenticación local en SvelteKit con hash PBKDF2 |
| **Gestión de Sesiones** | JWT emitido y refrescado por GoTrue Cloud | Cookie `app_session` HTTP-only firmada con HMAC-SHA256 |
| **Capa de Conexión de Datos** | Clientes `@supabase/ssr` y PostgREST HTTP | Driver nativo `pg.Pool` sobre socket TCP (puerto 5433) |
| **Cliente de Navegador** | `createBrowserClient` en `$lib/supabase/client` | Neutralizado (`supabase = null`); 100% de operaciones vía SvelteKit Server |
| **Almacenamiento de Imágenes** | Supabase Storage Cloud proyectado | Campo `image_url` con soporte para URLs estáticas locales |
| **Entorno de Validación Canónico** | Proyecto remoto Supabase Cloud | Contenedor local Docker `pg_integration_test` |

---

## 8. Estado de Validación y Baseline de Calidad

La presente arquitectura v8.1 ha sido demostrada empíricamente y validada en su totalidad en la rama `harold_test`:

* **Pruebas Automatizadas Unitarias y de Integración (`npm run test`):**
  ```text
  Test Files  10 passed | 1 skipped (11)
  Tests       92 passed | 1 skipped (93)
  ```
  *(1 prueba skipped correspondiente al wrapper de Playwright dentro de Vitest).*
* **Prueba End-to-End en Navegador Real (`npx playwright test`):**
  ```text
  1 passed (flujo vertical crítico completo validado en Chromium)
  ```
  *Corte vertical demostrado:* Browser → SvelteKit → Autenticación Local → Cookie HTTP-only → PostgreSQL local (puerto 5433) → RLS activo → RPC `process_stock_outlet` → Login Admin → RPC `cancel_stock_outlet` → Verificación en Log de Auditoría UI.
* **Validación RLS/RPC en Base de Datos Local:** 10/10 criterios de aislamiento y permisos verificados con éxito (Cajero bloqueado en costos y auditoría; Admin autorizado; RPCs evaluando contexto transaccional).
* **Integridad Git:** `git diff --check` limpio (0 errores de whitespace) y working tree sin modificaciones de código pendientes.
