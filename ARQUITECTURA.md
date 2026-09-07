# Documento de Arquitectura de Software — Sistema POS e Inventario

**Especificación de Arquitectura Vigente:** Alineada a **SRS v8.1** (Arquitectura Local y Offline sobre PostgreSQL 15)
**Referencia Histórica:** SRS v8.0 (Supabase Cloud BaaS original, preservado para trazabilidad)
**Rama Canónica:** `harold_test`
**Estado:** Arquitectura Oficial Vigente de Producción Local

---

## 1. Visión General del Sistema

El sistema implementa una arquitectura en capas basada en **SvelteKit 2**, con renderizado del lado del servidor (**SSR**), componentes reactivos en **Svelte 5**, delegación transaccional directa en **PostgreSQL 15 local (Docker / pg.Pool)** y control de acceso basado en roles (**RBAC**) respaldado por políticas de seguridad a nivel de fila (**RLS**) y funciones almacenadas (**RPCs**).

> 📌 **Evolución Arquitectónica (v8.0 → v8.1):**
> - **Arquitectura Vigente (SRS v8.1):** Operación **100% local y offline**. Persistencia en PostgreSQL 15 bajo Docker (`localhost:5433`, base `inventario_dev`), conexión nativa mediante driver `pg.Pool`, autenticación local con contraseñas cifradas (PBKDF2) en `auth.users` y sesiones mediante cookies HTTP-only firmadas con HMAC-SHA256 (`app_session`).
> - **Línea Base Histórica (SRS v8.0):** Especificación inicial respaldada por servicios administrados en la nube (Supabase Cloud, GoTrue Cloud y PostgREST). Dicha configuración se conserva en la documentación histórica como referencia de origen, pero **no constituye una dependencia de runtime de la aplicación vigente**.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. CLIENTE WEB (Navegador / Chrome / Escáner USB HID)                                  │
│    - UI reactiva en Svelte 5 / TailwindCSS 4                                          │
│    - Sistema de Diseño Desacoplado: Button, Input, Card, Badge, utilidad cn           │
│    - Captura global de eventos de teclado (Keyboard Wedge <100ms)                      │
│    - Jerarquía de Headings Unívoca (Breadcrumb como span, h1 único por vista)          │
│    - CERO llamadas externas salientes (src/lib/supabase/client.ts neutralizado)        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Peticiones HTTP / Form Actions / Cookies HTTP-only
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. SERVIDOR DE APLICACIÓN (Node.js + @sveltejs/adapter-node)                           │
│    - SSR & Server Load Functions (+page.server.ts)                                     │
│    - Interceptores y Guardias RBAC (hooks.server.ts con redirección 303)               │
│    - Autenticación Local y Verificación de Firma HMAC-SHA256 en cookies               │
│    - Server Actions (Manejo de formularios, cobro e idempotencia)                      │
│    - Adaptador de base de datos nativo mediante pg.Pool                                │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Transacciones con Aislamiento RLS (SET LOCAL)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. CAPA DE SEGURIDAD Y CONTEXTO RLS (PostgreSQL Local)                                │
│    - SET LOCAL ROLE authenticated (Rol no-superuser sin BYPASSRLS)                     │
│    - SET LOCAL "request.jwt.claims" = '{"sub": "...", "role": "...", "app_metadata":..}'│
│    - Funciones de compatibilidad auth.uid() y auth.jwt() consumiendo claims locales    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Socket TCP (localhost:5433 / inventario_dev)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 4. MOTOR DE BASE DE DATOS LOCAL (PostgreSQL 15 en Docker: pg_integration_test)         │
│    ├── Tablas de Dominio: products, product_costs, stock_outlets, stock_outlet_items   │
│    ├── Bitácora Inmutable: inventory_logs                                              │
│    ├── Capa de Autorización: Row Level Security (RLS) activo en las 5 tablas           │
│    ├── Capa Transaccional: Funciones RPC SECURITY DEFINER                              │
│    │   ├── upsert_product_with_cost(...)                                               │
│    │   ├── process_stock_outlet(...) (Validación de stock, cálculo y deducción atómica)│
│    │   └── cancel_stock_outlet(...) (Restauración de stock y anulación por Admin)      │
│    └── Triggers Automáticos: Auditoría inmutable de stock (trg_audit_product_stock)    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnológico Vigente

| Tecnología | Versión / Tipo | Rol y Responsabilidad Arquitectónica Vigente |
| :--- | :--- | :--- |
| **SvelteKit** | `^2.63.0` | Framework Full-Stack; gestión de rutas, SSR, Server Actions y middleware de autorización. |
| **Svelte** | `^5.56.1` | Biblioteca de UI reactiva moderna con soporte de Runes (`$state`, `$derived`, `$props`) y ciclo de vida de componentes. |
| **TypeScript** | `^6.0.3` | Tipado estático integral en frontend, servidor y definición de esquemas de datos. |
| **TailwindCSS** | `^4.3.0` | Motor de estilos utilitarios, tokens semánticos en `src/routes/layout.css` y diseño responsivo. |
| **Driver PostgreSQL (`pg`)** | `^8.23.0` | Driver nativo de conexión TCP con `pg.Pool`; transacciones ACID, aislamiento RLS y ejecución de RPCs. |
| **PostgreSQL 15 Local** | `15-alpine` | Motor relacional alojado en contenedor Docker local (`pg_integration_test`, puerto 5433, base `inventario_dev`). Persistencia, RLS, triggers y transacciones atómicas. |
| **Autenticación Local** | PBKDF2 + HMAC | Autenticación local mediante contraseñas hasheadas en `auth.users` y cookies de sesión HTTP-only firmadas con HMAC-SHA256 (`app_session`). |
| **Adapter Node** | `@sveltejs/adapter-node ^5.5.7` | Adaptador de compilación para servidor Node.js standalone ejecutable (`/build`). |
| **Vitest** | `^4.1.8` | Runner de pruebas unitarias, de integración DB y contratos de servidor (92 passed, 1 skipped). |
| **Playwright** | `^1.62.1` | Framework de pruebas End-to-End en navegador Chromium real contra el servidor compilado (1 passed). |
| **Iconografía UI** | `lucide-svelte ^1.0.1` | Biblioteca de iconos vectoriales nativa para Svelte 5. |
| **Utilidades de Estilo** | `clsx ^2.1.1` + `tailwind-merge ^3.6.0` | Función `cn` en `src/lib/utils.ts` para composición condicional de clases CSS. |

> ⚠️ **Aclaración sobre Dependencias de React:**
> La presencia de `lucide-react` en `package.json` corresponde a una dependencia inactiva del ecosistema React instalada accidentalmente durante la integración inicial de UI. **El runtime de la aplicación es 100% SvelteKit / Svelte 5**. En ningún momento se ejecuta React en el cliente ni en el servidor. Dicha dependencia está registrada como deuda técnica (`DEBT-DEP-001`).

---

## 3. Arquitectura del Frontend y Sistema de Diseño UI

El frontend reside bajo `src/routes/` y `src/lib/`:

```text
src/
├── lib/
│   ├── components/
│   │   ├── admin/       # Modales de productos, edición de costos confidenciales y detalle de ventas
│   │   ├── auth/        # Formularios de inicio de sesión y validación visual
│   │   ├── caja/        # BarcodeScanner, CartTable, ProductCard y CheckoutModal
│   │   └── ui/          # Componentes atómicos base: Badge, Button, Card, Input
│   ├── supabase/        # Adaptador server-side local (server.ts) y stub de cliente (client.ts)
│   └── utils.ts         # Utilidad 'cn' para combinación de clases CSS
└── routes/
    ├── +layout.svelte   # Shell global responsivo (Sidebar, Drawer móvil, Breadcrumbs)
    ├── layout.css       # Tokens de diseño y variables semánticas HSL
    ├── login/           # Pantalla de autenticación pública local
    ├── caja/            # Terminal de Punto de Venta (POS) para cajeros y administradores
    └── admin/           # Módulos protegidos exclusivamente para administradores
        ├── productos/   # Gestión de catálogo, precios, costos confidenciales y Soft Delete
        ├── historial/   # Consulta de salidas y procesamiento de cancelaciones / devoluciones
        └── auditoria/   # Consulta forense inmutable de movimientos de almacén (SSR)
```

### 3.1 Componentes UI Reutilizables
El sistema incorpora componentes atómicos bajo `src/lib/components/ui/`:
- **`Button.svelte`:** Variantes `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` y tamaños `default`, `sm`, `lg`, `icon`.
- **`Input.svelte`:** Control de entrada estilizado con soporte de foco accesible y estados de deshabilitación.
- **`Card.svelte`:** Contenedor estructurado para tarjetas de producto y resúmenes de venta.
- **`Badge.svelte`:** Etiquetas de estado para roles (`admin`, `cajero`), existencias y estatus de transacción.

### 3.2 Jerarquía Semántica de Headings y Contratos Visuales E2E
Para evitar colisiones semánticas y garantizar la estabilidad de la suite de pruebas E2E automatizada con Playwright:
1. **Unicidad de `<h1>` por Vista:**
   - El breadcrumb global en `src/routes/+layout.svelte` se renderiza como elemento no-heading:
     ```svelte
     <span class="font-semibold tracking-tight text-foreground">{pageTitle}</span>
     ```
   - Cada página concreta define su propio encabezado principal `<h1>`:
     - `/login`: `<h1 class="mt-4 text-2xl font-bold tracking-tight text-white">Inventario Papelería</h1>`
     - `/caja`: `<h1 class="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">Punto de Venta (Caja)</h1>`
     - `/admin/productos`: `<h1>Gestión de Productos</h1>`
     - `/admin/historial`: `<h1>Historial de Ventas y Devoluciones</h1>`
     - `/admin/auditoria`: `<h1>Bitácora de Auditoría de Stock</h1>`
2. **Contratos Textuales de Escáner y Banner:**
   - [BarcodeScanner.svelte](file:///d:/proyectos%20$/inventario_papeleria/src/lib/components/caja/BarcodeScanner.svelte): Etiqueta textual del último código leído:
     ```svelte
     <span class="font-mono font-medium text-foreground">Último: {lastScannedCode}</span>
     ```
   - [caja/+page.svelte](file:///d:/proyectos%20$/inventario_papeleria/src/routes/caja/+page.svelte): Banner de confirmación de venta:
     ```svelte
     ID Salida: {completedSale.id} • Total: ${completedSale.total.toFixed(2)} ({completedSale.count} artículos)
     ```

---

## 4. Servidor SvelteKit (SSR, Middleware y Server Actions)

El servidor de aplicación actúa como intermediario seguro y autoritativo:

1. **`hooks.server.ts`:**
   - Intercepta cada solicitud HTTP entrante.
   - Lee la cookie HTTP-only `app_session`, valida su firma criptográfica HMAC-SHA256 y extrae la identidad del usuario y su rol.
   - Aplica los guardias de ruta (**Guardias RBAC**):
     - Usuarios sin sesión intentando acceder a `/admin/*` o `/caja/*` son redirigidos con HTTP 303 a `/login`.
     - Usuarios con rol `cajero` intentando acceder a cualquier ruta `/admin/*` son redirigidos con HTTP 303 a `/caja`.
     - Usuarios autenticados accediendo a `/login` son redirigidos con HTTP 303 a `/caja`.
   - Inyecta `event.locals.user`, `event.locals.role` y el cliente de base de datos contextualizado en `event.locals.supabase`.
2. **`+page.server.ts` (Server Load Functions):**
   - Ejecuta consultas server-side antes de renderizar la vista, garantizando que datos sensibles (como `product_costs`) nunca viajen al cliente a menos que el usuario sea Administrador.
3. **Server Actions:**
   - Procesan mutaciones críticas (login, logout, cobro en caja, alta/edición de catálogo, cancelaciones).
   - Validan entradas y ejecutan llamadas a los procedimientos almacenados (RPCs) en transacciones de PostgreSQL.

---

## 5. Arquitectura de Autenticación Local

La autenticación opera de forma **100% autónoma y local** sin depender de servicios externos como GoTrue o Supabase Auth Cloud:

```text
[ Browser ] ─── (1) POST /login (email, password) ────────► [ SvelteKit SSR ]
                                                                   │
                                                (2) Valida hash PBKDF2
                                                    en auth.users local
                                                                   ▼
                                                            [ PostgreSQL ]
                                                                   │
                                                (3) Retorna usuario y rol
                                                                   ▼
[ Browser ] ◄── (4) Set-Cookie (app_session firmada) ─────── [ SvelteKit SSR ]
```

### 5.1 Credenciales y Almacenamiento
- Los usuarios se registran en la tabla `auth.users` de PostgreSQL local:
  - `admin@papeleria.com` (Rol: `admin`)
  - `cajero@papeleria.com` (Rol: `cajero`)
- Las contraseñas se almacenan mediante hash seguro **PBKDF2-HMAC-SHA512** con salt criptográfico de 16 bytes y 100,000 iteraciones (`salt:hash`). En ningún caso se persiste texto plano.

### 5.2 Tokens de Sesión y Cookies HTTP-only
- Tras la validación de credenciales, el servidor emite un token de sesión firmado criptográficamente con HMAC-SHA256 (`SESSION_SECRET`).
- Payload del token: `{ id, email, app_metadata: { role: 'admin' | 'cajero' }, exp }`.
- Se almacena en la cookie `app_session` con atributos: `HttpOnly=true`, `SameSite=Lax`, `Path=/`, `Secure=false` (en desarrollo local).
- El cierre de sesión en `/logout` elimina la cookie `app_session` y redirige a `/login`.

---

## 6. Control de Acceso Basado en Roles (RBAC)

```text
                           Solicitud HTTP a /admin/*
                                     │
                        ¿Usuario Autenticado?
                               /      \
                             (No)     (Sí)
                             /          \
                Redirige 303 a /login   ¿Rol == 'admin'?
                                          /       \
                                        (No)      (Sí)
                                        /           \
                           Redirige 303 a /caja    Permite Render SSR
```

### Matriz de Acceso por Ruta:
- `/login`: Pública (redirige a `/caja` si ya existe sesión activa).
- `/caja`: Accesible para roles `admin` y `cajero`.
- `/admin/productos`: Exclusivo para rol `admin`.
- `/admin/historial`: Exclusivo para rol `admin`.
- `/admin/auditoria`: Exclusivo para rol `admin`.

---

## 7. Modelo de Datos Relacional

El modelo relacional está optimizado para garantizar la integridad referencial y el aislamiento de datos sensibles:

```text
  ┌────────────────────────────────────────────────────────┐
  │ products                                               │
  ├────────────────────────────────────────────────────────┤
  │ id: UUID (PK)                                          │
  │ sku_code: VARCHAR(50) (UNIQUE)                         │
  │ name: VARCHAR(255)                                     │
  │ description: TEXT                                      │
  │ price: NUMERIC(10,2)                                   │
  │ stock: NUMERIC(10,3)                                   │
  │ min_stock: NUMERIC(10,3)                               │
  │ is_active: BOOLEAN (DEFAULT TRUE)                      │
  │ image_url: TEXT                                        │
  │ created_at, updated_at: TIMESTAMPTZ                    │
  └──────────────────────────┬─────────────────────────────┘
                             │ 1:1 (Aislamiento confidencial)
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │ product_costs (Protegido por RLS)                      │
  ├────────────────────────────────────────────────────────┤
  │ id: UUID (PK, FK -> products.id ON DELETE CASCADE)     │
  │ cost: NUMERIC(10,2)                                    │
  │ updated_at: TIMESTAMPTZ                                │
  │ updated_by: UUID (FK -> auth.users)                    │
  └────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────┐
  │ stock_outlets (Salidas / Ventas de mostrador)          │
  ├────────────────────────────────────────────────────────┤
  │ id: UUID (PK)                                          │
  │ outlet_number: BIGSERIAL (Folio visible #000104)       │
  │ user_id: UUID (FK -> auth.users - Cajero)              │
  │ total_amount: NUMERIC(10,2)                            │
  │ idempotency_key: VARCHAR(64) (UNIQUE)                  │
  │ is_canceled: BOOLEAN (DEFAULT FALSE)                   │
  │ canceled_at: TIMESTAMPTZ                               │
  │ canceled_by: UUID (FK -> auth.users - Admin)           │
  │ cancel_reason: TEXT                                    │
  │ created_at: TIMESTAMPTZ                                │
  └──────────────────────────┬─────────────────────────────┘
                             │ 1:N
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │ stock_outlet_items (Partidas individuales)             │
  ├────────────────────────────────────────────────────────┤
  │ id: UUID (PK)                                          │
  │ outlet_id: UUID (FK -> stock_outlets.id)               │
  │ product_id: UUID (FK -> products.id)                   │
  │ quantity: NUMERIC(10,3)                                │
  │ unit_price: NUMERIC(10,2)                              │
  │ subtotal: NUMERIC(10,2)                                │
  └────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────┐
  │ inventory_logs (Bitácora Forense Inmutable)            │
  ├────────────────────────────────────────────────────────┤
  │ id: UUID (PK)                                          │
  │ product_id: UUID (FK -> products.id)                   │
  │ change_type: VARCHAR(30) (VENTA, DEVOLUCION, etc.)     │
  │ previous_stock: NUMERIC(10,3)                          │
  │ new_stock: NUMERIC(10,3)                               │
  │ quantity_changed: NUMERIC(10,3)                        │
  │ reference_id: VARCHAR(100) (Ej. Folio de venta)        │
  │ created_by: UUID (FK -> auth.users)                    │
  │ notes: TEXT                                            │
  │ created_at: TIMESTAMPTZ (DEFAULT now())                │
  └────────────────────────────────────────────────────────┘
```

---

## 8. Seguridad a Nivel de Fila (Row Level Security - RLS) en PostgreSQL Local

Row Level Security actúa como la **segunda línea de defensa**, forzada directamente en el motor de base de datos:

### 8.1 Ejecución Transaccional sin Superusuario (`SET LOCAL`)
Para que PostgreSQL evalúe las políticas RLS y no las omita mediante privilegios administrativos (`BYPASSRLS`), cada operación adquiere un cliente del pool y ejecuta:
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "<uuid>", "role": "authenticated", "app_metadata": {"role": "<admin|cajero>"}}';
-- Consultas DML / RPCs
COMMIT;
```
* **Rol `authenticated`:** Es un rol estándar sin privilegios `SUPERUSER` ni `BYPASSRLS`.
* **Aislamiento en Pool:** El modificador `SET LOCAL` solo aplica durante la transacción activa. Al ejecutar `COMMIT` o `ROLLBACK`, PostgreSQL limpia automáticamente las variables y revierte el rol al estado base de la conexión física.

### 8.2 Políticas RLS Activas:
1. **`products`:** Lectura para usuarios autenticados donde `is_active = true`. Creación, actualización y Soft Delete restringidos al rol `admin`.
2. **`product_costs`:** Aislamiento total mediante RLS. La política `SELECT` evalúa `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`. Para un usuario cajero, cualquier consulta retorna estrictamente `0` filas.
3. **`stock_outlets` y `stock_outlet_items`:** Políticas `"Salidas propias o Admin"` y `"Renglones salidas propias o Admin"`. Los cajeros únicamente pueden consultar las ventas generadas por su propio usuario (`auth.uid() = user_id`); el administrador tiene visibilidad global.
4. **`inventory_logs`:** Inserción exclusiva para funciones RPC internas (`SECURITY DEFINER`). Lectura restringida a administradores (`(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`). No existen políticas de `UPDATE` ni `DELETE` (inmutabilidad estricta).

---

## 9. Funciones Almacenadas Transaccionales (RPCs)

Las mutaciones críticas se ejecutan dentro de PostgreSQL en bloques transaccionales atómicos:

### A. `upsert_product_with_cost(...)`
- **Rol ejecutor:** Exclusivo `admin`.
- **Operación:** Inserta o actualiza un registro en `products` y, simultáneamente, crea o actualiza su costo en `product_costs`.
- **Auditoría:** Dispara el trigger `trg_audit_product_stock` para registrar ajustes en `inventory_logs`.

### B. `process_stock_outlet(...)`
- **Rol ejecutor:** `cajero` o `admin`.
- **Operación:** Procesa el cobro atómico de una venta con verificación de `p_idempotency_key`.
- **Lógica Transaccional:**
  1. Bloquea las filas de productos involucradas con `SELECT ... FOR UPDATE` para prevenir condiciones de carrera.
  2. Obtiene el precio oficial directo de la base de datos y calcula el subtotal autoritativo.
  3. Comprueba que `stock >= cantidad_solicitada`. Si falta existencia en cualquier partida, aborta con excepción y revierte toda la transacción.
  4. Descuenta el stock y registra las partidas en `stock_outlet_items`.
  5. Inserta los asientos correspondientes con tipo `VENTA` en `inventory_logs` registrando a `auth.uid()`.

### C. `cancel_stock_outlet(...)`
- **Rol ejecutor:** Exclusivo `admin`.
- **Operación:** Cancela una venta previamente cobrada y restaura las existencias al inventario.
- **Lógica Transaccional:**
  1. Valida que la venta exista y que `is_canceled = false`. Si ya estaba cancelada, rechaza la operación.
  2. Valida que el motivo tenga al menos 3 caracteres.
  3. Marca la venta como cancelada (`is_canceled = true`, `canceled_at = now()`, `canceled_by = auth.uid()`, `cancel_reason`).
  4. Recorre cada artículo vendido y suma la cantidad al stock del producto en `products`.
  5. Inserta asientos de tipo `DEVOLUCION` en `inventory_logs`.

---

## 10. Flujo Transaccional de una Venta

```text
[ Cajero ] ─── Escanea / Agrega artículos al Carrito ───► [ Interfaz POS ]
                                                                  │
                                                Presiona "Cobrar Venta"
                                                                  ▼
[ PostgreSQL Local ] ◄── Invoca RPC process_stock_outlet() ── [ Server Action ]
      │
      ├── 1. Valida Idempotency Key (Si existe, retorna venta previa sin descontar)
      ├── 2. Bloquea filas (SELECT ... FOR UPDATE) y valida existencias
      ├── 3. Si stock insuficiente ──► ROLLBACK TOTAL ──► Error al Cajero
      ├── 4. Si stock suficiente:
      │      ├── Inserta cabecera en stock_outlets (user_id = auth.uid())
      │      ├── Inserta partidas en stock_outlet_items
      │      ├── Descuenta existencias en products (stock = stock - qty)
      │      └── Inserta registros tipo 'VENTA' en inventory_logs
      └── 5. COMMIT TRANSACCIÓN ──► Retorna Folio exitoso al Cajero
```

---

## 11. Mecanismo de Idempotencia

Para evitar cobros duplicados por intermitencias o clics múltiples:
1. El cliente genera un identificador único UUID (`idempotency_key`) al iniciar el cobro.
2. La función `process_stock_outlet` consulta si existe un registro previo con dicho `idempotency_key` en `stock_outlets`.
3. **Comportamiento ante reintento:** Si la clave ya existe, la función no vuelve a descontar existencias ni crea nuevas partidas; retorna inmediatamente el folio original registrado, garantizando que cada venta se procese exactamente una vez.

---

## 12. Garantía de Atomicidad (ACID)

- **Todo o Nada:** En ventas de múltiples artículos, si el último producto no cuenta con existencia suficiente, el motor PostgreSQL cancela todas las operaciones intermedias y no descuenta ninguno de los artículos.
- **Consistencia:** El stock en `products` y el historial en `inventory_logs` cambian de manera indivisible dentro de la misma transacción de base de datos.

---

## 13. Mecanismo de Desactivación Lógica (Soft Delete)

Para preservar la integridad referencial histórica:
- Los productos eliminados por el administrador no se borran físicamente (`DELETE FROM products` no se ejecuta).
- Se actualiza la bandera booleana `is_active = false`.
- Las consultas en la terminal de Caja filtran automáticamente `WHERE is_active = true`, impidiendo la venta de productos descontinuados.
- Las ventas históricas y reportes conservan sus claves foráneas válidas sin generar registros huérfanos.

---

## 14. Arquitectura de Auditoría Forense

La tabla `inventory_logs` opera como un libro mayor contable (*ledger*) inalterable:
- **Generación Automática:** Los registros solo se insertan desde funciones transaccionales RPC (`process_stock_outlet`, `cancel_stock_outlet`, `upsert_product_with_cost`) y triggers de almacén.
- **Trazabilidad Completa:** Cada entrada almacena el stock previo, el nuevo stock, la variación neta (`quantity_changed`), el usuario responsable y la referencia de la venta.
- **Consulta de Solo Lectura:** La pantalla `/admin/auditoria` expone una interfaz server-side de filtrado y búsqueda sin capacidades de edición o borrado físico.

---

## 15. Arquitectura del Escáner de Códigos de Barras

El componente [BarcodeScanner.svelte](file:///d:/proyectos%20$/inventario_papeleria/src/lib/components/caja/BarcodeScanner.svelte) implementa integración de hardware por emulación de teclado (**USB HID / Keyboard Wedge**):

```text
[ Escáner USB Dispara Haz ] ──► Emite ráfaga de teclas a velocidad <100ms
                                            │
                                            ▼
[ Window Event Listener ] ────► Buffer en Memoria (Acumula caracteres)
                                            │
                                            ▼ Recibe tecla 'Enter'
[ Validador de Intervalo ] ───► ¿Tiempo entre teclas < 100ms?
                                  /                  \
                                (Sí)                 (No: Escritura humana)
                                  /                     \
                Despacha evento 'scan' con SKU        Ignora buffer
                                  │
                                  ▼
                Agrega producto al carrito en POS
```

- **Resiliencia de Foco:** El listener global captura las ráfagas del escáner independientemente de si el foco del navegador se encuentra en un `<input>` de texto o en un `<button>`.
- **Limpieza de Ciclo de Vida:** Al salir de la ruta `/caja`, el hook `$effect` / cleanup remueve el event listener global de `window` para evitar fugas de memoria.

---

## 16. Modelo de Seguridad en Profundidad

```text
1. NAVEGADOR        ──► Validación de formularios, captura de foco y sanitización.
2. SVELTEKIT SSR    ──► Verificación criptográfica de cookie 'app_session' y guardias RBAC 303.
3. CONTEXTO RLS     ──► SET LOCAL ROLE authenticated y "request.jwt.claims" transaccionales.
4. POSTGRESQL RLS   ──► Aislamiento estricto de tablas (product_costs invisible a cajeros).
5. RPC FUNCTIONS    ──► SECURITY DEFINER con verificación explícita de app_metadata.role.
```

---

## 17. Flujo Transaccional de Devolución

```text
[ Administrador ] ─── Abre Detalle en /admin/historial ───► Presiona "Cancelar Venta"
                                                                     │
                                                   Ingresa Motivo (mín. 3 chars)
                                                                     ▼
[ PostgreSQL Local ] ◄── Invoca RPC cancel_stock_outlet() ── [ Server Action ]
      │
      ├── 1. Valida que usuario sea 'admin'
      ├── 2. Valida que venta exista y is_canceled == false
      ├── 3. Marca venta como cancelada (is_canceled = true)
      ├── 4. Itera stock_outlet_items y reintegra existencias (stock = stock + qty)
      ├── 5. Inserta asientos de tipo 'DEVOLUCION' en inventory_logs
      └── 6. COMMIT ──► Actualiza UI y bloquea segunda cancelación
```

---

## 18. Arquitectura de Despliegue en Producción

```text
[ Cliente Web / Navegador ] ──► [ Proxy Inverso / HTTPS ] ──► [ Node.js (:3000) /build ] ──► [ PostgreSQL 15 Local (Docker :5433) ]
```

- **Adaptador:** `@sveltejs/adapter-node` compila la aplicación a JavaScript nativo en el directorio `/build`.
- **Arranque:** Ejecutado mediante `node build` o `npm run start`.
- **Variables de Entorno Vigentes:** `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `SESSION_SECRET`, `PORT`, `ORIGIN`, `NODE_ENV`.
- **Exclusión de Nube:** No se requiere conectividad externa hacia `*.supabase.co` ni servicios Serverless/Edge.

---

## 19. Arquitectura de Calidad y Pruebas (Quality Gate)

El sistema valida su integridad mediante cuatro niveles complementarios de evidencia:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ NIVEL D — E2E Browser Testing (Playwright / Chromium Real)                             │
│ └── tests/e2e/pos_critical_flow.spec.ts (1 test passed)                                │
│     Valida el flujo vertical completo: Login Cajero -> POS -> Scanner -> Cobro RPC ->   │
│     Login Admin -> Cancelación RPC -> Auditoría UI.                                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ NIVEL C — Integración de Seguridad y RLS en PostgreSQL Local (Docker)                  │
│ └── tests/db/ (18 tests passed)                                                        │
│     - tests/db/process_outlet.test.ts (6 tests)                                        │
│     - tests/db/cancel_outlet.test.ts (6 tests)                                         │
│     - tests/db/rls_costs.test.ts (6 tests)                                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ NIVEL B — Pruebas de Integración y Lógica de Aplicación (Vitest)                       │
│ └── 10 archivos de prueba locales (92 tests passed / 1 skipped):                       │
│     - tests/auth/route_guards.test.ts (13 tests)                                       │
│     - tests/ui/admin_products.test.ts (9 tests)                                        │
│     - tests/ui/returns_audit.test.ts (14 tests)                                        │
│     - tests/ui/scanner_checkout.test.ts (10 tests)                                     │
│     - tests/ui/scanner_dom_lifecycle.test.ts (6 tests)                                 │
│     - tests/setup.test.ts (15 tests)                                                   │
│     - tests/cloud/supabase_cloud.test.ts (7 tests de compatibilidad)                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ NIVEL A — Evidencia Estática (TypeScript, Linter y Esquema SQL)                        │
│ └── Verificación estricta de tipos, sintaxis Svelte y migraciones declarativas.        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

> **Nota sobre el Baseline de Pruebas:**
> - `npm run test` ejecuta la suite de Vitest reportando **92 pasados y 1 omitido (*skipped*)**. El test omitido corresponde al wrapper de `pos_critical_flow.spec.ts`, que se ejecuta exclusivamente bajo Playwright con `npx playwright test`.

---

## 20. Clasificación y Separación de Supabase Cloud

| Aspecto | Supabase Cloud (SRS v8.0) | PostgreSQL 15 Local (SRS v8.1) |
| :--- | :--- | :--- |
| **Rol en Runtime** | Referencia histórica / verificación de compatibilidad | **Ruta de ejecución principal y autoritativa** |
| **Conexión** | HTTPS / WebSockets hacia `*.supabase.co` | Conexión TCP local `localhost:5433` vía `pg.Pool` |
| **Autenticación** | GoTrue Cloud (`/auth/v1`) | PBKDF2 local en `auth.users` + cookies firmadas |
| **Dependencia de Internet** | Obligatoria | **Cero (100% Offline / Local)** |
| **Suite de Tests** | `tests/cloud/supabase_cloud.test.ts` | `tests/db/*.test.ts` y suite completa de Vitest/Playwright |

---

## 21. Deuda Técnica de Dependencias

Conforme a la auditoría técnica del repositorio, se documentan las siguientes partidas no bloqueantes en `deuda_tecnica.md`:
1. **`DEBT-DEP-001` (`lucide-react`):** Dependencia de React presente en `package.json` pero no utilizada en el runtime de SvelteKit.
2. **`DEBT-DEP-002` (`@lucide/svelte`):** Paquete alias redundante respecto a `lucide-svelte`.

---

## 22. Estructura del Repositorio

```text
inventario_papeleria/
├── docs/                                  # Documentación técnica y manuales funcionales
│   ├── MANUAL_USUARIO.md                  # Manual operativo para cajeros
│   ├── GUIA_ADMINISTRADOR.md              # Guía de supervisión y gestión
│   ├── INSTALACION_Y_DEPLOYMENT.md        # Guía técnica de aprovisionamiento
│   ├── ESPECIFICACION_FUNCIONAL.md        # Casos de uso y reglas de negocio
│   └── SRS_v8.1_Arquitectura_Local.md     # Especificación arquitectónica v8.1 (enmienda oficial)
├── ARQUITECTURA.md                        # Documento de arquitectura técnica principal (este archivo)
├── Estado_cero.md                         # Baseline arquitectónico e invariantes del sistema
├── deuda_tecnica.md                       # Sprint history, control de issues y catálogo de deuda
├── README.md                              # Guía operativa y arranque rápido
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── admin/                     # Modales de catálogo, costos y ventas
│   │   │   ├── caja/                      # BarcodeScanner, CartTable, ProductCard
│   │   │   └── ui/                        # Componentes atómicos (Badge, Button, Card, Input)
│   │   ├── supabase/                      # Adaptador PostgreSQL server.ts y stub client.ts
│   │   └── utils.ts                       # Utilidad cn (clsx + tailwind-merge)
│   └── routes/                            # Rutas SvelteKit y Server Actions
├── supabase/
│   └── migrations/                        # Migraciones SQL declarativas
│       ├── 20260829000000_init_v8.sql     # Esquema DDL inicial, RLS, RPCs y triggers
│       └── 20260902000000_fix_stock_outlet_items_rls.sql # RLS en stock_outlet_items
├── tests/
│   ├── auth/                              # Pruebas de guardias y RBAC
│   ├── cloud/                             # Pruebas de compatibilidad con Supabase Cloud
│   ├── db/                                # Pruebas de RPCs y RLS en PostgreSQL Docker
│   ├── e2e/                               # Pruebas de navegador con Playwright
│   └── ui/                                # Pruebas de componentes y DOM
├── package.json                           # Dependencias y scripts de ejecución
├── svelte.config.js                       # Configuración de SvelteKit y adapter-node
├── vite.config.ts                         # Configuración del empaquetador Vite
└── playwright.config.ts                   # Configuración del runner E2E
```
