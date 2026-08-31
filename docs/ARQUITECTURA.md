# Documento de Arquitectura de Software — Sistema POS e Inventario

---

## 1. Visión General del Sistema

El sistema implementa una arquitectura en capas basada en **SvelteKit**, con renderizado del lado del servidor (**SSR**), delegación transaccional en **PostgreSQL (Supabase Cloud)** y control de acceso basado en roles (**RBAC**) respaldado por políticas de seguridad a nivel de fila (**RLS**) y funciones almacenadas (**RPCs**).

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. CLIENTE WEB (Navegador / Chrome / Escáner USB HID)                                  │
│    - UI reactiva en Svelte 5 / TailwindCSS                                            │
│    - Captura global de eventos de teclado (Keyboard Wedge <100ms)                      │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Peticiones HTTP / Form Actions / SSE
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. SERVIDOR DE APLICACIÓN (Node.js + @sveltejs/adapter-node)                           │
│    - SSR & Server Load Functions (+page.server.ts)                                     │
│    - Interceptores y Guardias RBAC (hooks.server.ts)                                   │
│    - Server Actions (Manejo de formularios, cobro e idempotencia)                      │
│    - Validación estricta y recálculo de precios desde la fuente de verdad              │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Cliente Supabase JS (Anon Key + JWT)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. CAPA DE SERVICIOS SUPABASE (BaaS / Cloud)                                           │
│    - Supabase Auth (Gestión de sesiones, tokens JWT y app_metadata.role)               │
│    - PostgREST API Gateway & RPC Dispatcher                                            │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Conexión PostgreSQL (SQL Transaccional)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 4. MOTOR DE BASE DE DATOS (PostgreSQL 15+)                                             │
│    ├── Tablas de Dominio: products, product_costs, stock_outlets, stock_outlet_items   │
│    ├── Bitácora Inmutable: inventory_logs                                              │
│    ├── Capa de Autorización: Row Level Security (RLS) en todas las tablas              │
│    ├── Capa Transaccional: Funciones RPC SECURITY DEFINER                              │
│    │   ├── upsert_product_with_cost(...)                                               │
│    │   ├── process_stock_outlet(...) (Validación de stock, cálculo y deducción)        │
│    │   └── cancel_stock_outlet(...) (Restauración de stock y anulación)                │
│    └── Triggers Automáticos: Asignación de rol inicial al crear usuario                │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnológico

| Tecnología | Versión / Tipo | Rol y Responsabilidad Arquitectónica |
| :--- | :--- | :--- |
| **SvelteKit** | `^2.49.2` | Framework Full-Stack; gestión de rutas, SSR, Server Actions y API routing. |
| **Svelte** | `^5.51.3` | Biblioteca de UI reactiva (soporte de Runes y ciclo de vida de componentes). |
| **TypeScript** | `^5.9.3` | Tipado estático en frontend, backend y definición de esquemas de datos. |
| **TailwindCSS** | `^4.1.18` | Motor de estilos utilitarios y diseño responsivo de la interfaz. |
| **Supabase JS** | `^2.97.0` | SDK de integración con Supabase Auth, PostgREST y llamadas a RPCs. |
| **PostgreSQL** | `15+` | Motor de base de datos relacional; persistencia, RLS, triggers y transacciones ACID. |
| **Adapter Node**| `@sveltejs/adapter-node ^5.5.7` | Adaptador de compilación para generar un servidor Node.js standalone (`/build`). |
| **Vitest** | `^4.1.11` | Runner de pruebas unitarias, de integración DOM y validación de RPCs. |
| **Playwright** | `^1.58.2` | Framework de pruebas End-to-End en navegador real contra el servidor Node.js. |

---

## 3. Arquitectura del Frontend

El frontend reside bajo `src/routes/` y `src/lib/components/`:

```text
src/
├── lib/
│   ├── components/
│   │   ├── admin/       # Modales de productos, edición de costos y detalle de ventas
│   │   ├── auth/        # Formularios de inicio de sesión y guardias de vista
│   │   └── caja/        # BarcodeScanner, CartTable, ProductCard y CheckoutModal
│   └── supabase/        # Inicialización de clientes (client.ts y server.ts)
└── routes/
    ├── +layout.svelte   # Layout global (Navbar, sesión y estado reactivo)
    ├── login/           # Pantalla de autenticación pública
    ├── caja/            # Terminal de Punto de Venta (POS) para cajeros y admin
    └── admin/           # Módulos protegidos para administradores
        ├── productos/   # Gestión de catálogo, precios, costos y desactivación
        ├── historial/   # Consulta de salidas y procesamiento de devoluciones
        └── auditoria/   # Consulta forense inmutable de movimientos de stock
```

### Principios de UI:
- **Separación de Estado:** El carrito de compra se mantiene en memoria reactiva local durante la sesión de cobro y solo se envía al servidor al presionar *Cobrar*.
- **Sin Lógica de Negocio Sensible en Cliente:** La interfaz no calcula totales definitivos ni valida stock por su cuenta; envía las partidas al backend donde se audita el precio oficial y la disponibilidad física.

---

## 4. Servidor SvelteKit (SSR y Server Actions)

El servidor de aplicación actúa como intermediario seguro entre el navegador y la base de datos:

1. **`hooks.server.ts`:**
   - Intercepta cada solicitud entrante.
   - Extrae el token JWT de la sesión y consulta el perfil del usuario.
   - Aplica las políticas de guardia de ruta (**Guardias RBAC**).
   - Inyecta el usuario autenticado y su rol en `event.locals`.
2. **`+page.server.ts` (Server Load Functions):**
   - Ejecuta consultas del lado del servidor antes de renderizar la vista.
   - Si la ruta requiere privilegios administrativos y el usuario es cajero, interrumpe el ciclo y responde con una redirección HTTP 303.
3. **Server Actions:**
   - Procesan mutaciones críticas (inicio de sesión, checkout, actualización de productos y cancelaciones).
   - Validan entradas de usuario y ejecutan las llamadas a las funciones almacenadas (RPCs) de PostgreSQL.

---

## 5. Arquitectura de Autenticación

La autenticación utiliza **Supabase Auth** con persistencia de tokens en cookies de sesión HTTP seguras:

```text
[ Browser ] ─── (1) POST /login (email, password) ───► [ SvelteKit SSR ]
                                                              │
                                            (2) signInWithPassword()
                                                              ▼
                                                     [ Supabase Auth ]
                                                              │
                                            (3) Retorna JWT + app_metadata
                                                              ▼
[ Browser ] ◄── (4) Set-Cookie (sb-access-token) ────── [ SvelteKit SSR ]
```

### Derivación de Roles (`app_metadata.role`):
- Los roles de usuario (**`admin`** o **`cajero`**) se almacenan en los metadatos protegidos de la cuenta (`raw_app_meta_data` en PostgreSQL).
- **Seguridad:** A diferencia de `user_metadata` (que el usuario final puede editar desde el cliente), `app_metadata` solo puede ser modificado por administradores o mediante triggers `SECURITY DEFINER` en la base de datos.
- El servidor SvelteKit lee `user.app_metadata.role` en cada petición para conceder o denegar el acceso.

---

## 6. Control de Acceso Basado en Roles (RBAC)

El sistema implementa dos niveles de control:

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
  │ stock_outlet_id: UUID (FK -> stock_outlets.id)         │
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
  │ movement_type: movement_type (VENTA, DEVOLUCION, etc.) │
  │ previous_stock: NUMERIC(10,3)                          │
  │ new_stock: NUMERIC(10,3)                               │
  │ quantity_changed: NUMERIC(10,3)                        │
  │ reference_id: VARCHAR(100) (Ej. Folio de venta)        │
  │ user_id: UUID (FK -> auth.users)                       │
  │ notes: TEXT                                            │
  │ created_at: TIMESTAMPTZ (DEFAULT now())                │
  └────────────────────────────────────────────────────────┘
```

---

## 8. Seguridad a Nivel de Fila (Row Level Security - RLS)

RLS actúa como la **segunda línea de defensa**, impidiendo el acceso no autorizado incluso si la capa de aplicación sufriera vulnerabilidades:

1. **`products`:** Lectura pública para usuarios autenticados con `is_active = true`. Creación, actualización y desactivación restringida al rol `admin`.
2. **`product_costs`:** Aislamiento total mediante RLS. La política `SELECT` exige explícitamente `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`. Para un cajero, cualquier consulta a esta tabla retorna `0` filas.
3. **`stock_outlets` y `stock_outlet_items`:** Inserción permitida para cajeros y administradores. Modificaciones restringidas a funciones RPC autorizadas.
4. **`inventory_logs`:** Inserción restringida exclusivamente a funciones RPC internas (`SECURITY DEFINER`). Lectura permitida solo a usuarios con rol `admin`. No existen políticas de `UPDATE` ni `DELETE` (inmutabilidad estricta).

---

## 9. Funciones Almacenadas Transaccionales (RPCs)

Las mutaciones críticas de inventario se ejecutan dentro del motor PostgreSQL en bloques transaccionales atómicos:

### A. `upsert_product_with_cost(...)`
- **Rol ejecutor:** Exclusivo `admin`.
- **Operación:** Inserta o actualiza un registro en `products` y, simultáneamente, crea o actualiza su costo en `product_costs`.
- **Auditoría:** Si el stock cambia, registra automáticamente un movimiento de tipo `REABASTECIMIENTO` o `AJUSTE_MANUAL` en `inventory_logs`.

### B. `process_stock_outlet(...)`
- **Rol ejecutor:** `cajero` o `admin`.
- **Operación:** Procesa el cobro de una venta con verificación de `idempotency_key`.
- **Lógica Transaccional:**
  1. Bloquea las filas de productos involucradas con `FOR UPDATE` para evitar condiciones de carrera (*race conditions*).
  2. Obtiene el precio oficial directo de la base de datos y calcula el subtotal.
  3. Comprueba que `stock >= cantidad_solicitada`. Si falta stock en cualquier partida, lanza excepción y revierte toda la transacción.
  4. Descuenta el stock y registra las partidas en `stock_outlet_items`.
  5. Inserta los asientos correspondientes con tipo `VENTA` en `inventory_logs`.

### C. `cancel_stock_outlet(...)`
- **Rol ejecutor:** Exclusivo `admin`.
- **Operación:** Cancela un folio de venta previamente cobrado y restaura la mercancía al inventario.
- **Lógica Transaccional:**
  1. Valida que la venta exista y que `is_canceled = false`. Si ya estaba cancelada, rechaza la operación.
  2. Valida que el motivo tenga al menos 3 caracteres.
  3. Marca la venta como cancelada (`is_canceled = true`, `canceled_at`, `canceled_by`, `cancel_reason`).
  4. Recorre cada artículo vendido y suma la cantidad al stock del producto en `products`.
  5. Inserta asientos de tipo `DEVOLUCION` en `inventory_logs`.

---

## 10. Flujo Transaccional de una Venta

```text
[ Cajero ] ─── Escanea / Agrega artículos al Carrito ───► [ Interfaz POS ]
                                                                  │
                                                Presiona "Cobrar Venta"
                                                                  ▼
[ PostgreSQL ] ◄── Invoca RPC process_stock_outlet() ─── [ Server Action ]
      │
      ├── 1. Valida Idempotency Key (Si existe, retorna venta previa sin descontar)
      ├── 2. Bloquea filas (SELECT ... FOR UPDATE) y valida existencias
      ├── 3. Si stock insuficiente ──► ROLLBACK TOTAL ──► Error al Cajero
      ├── 4. Si stock suficiente:
      │      ├── Inserta cabecera en stock_outlets
      │      ├── Inserta partidas en stock_outlet_items
      │      ├── Descuenta existencias en products (stock = stock - qty)
      │      └── Inserta registros tipo 'VENTA' en inventory_logs
      └── 5. COMMIT TRANSACCIÓN ──► Retorna Folio exitoso al Cajero
```

---

## 11. Mecanismo de Idempotencia

Para evitar cobros duplicados ocasionados por intermitencias de red o clics repetidos en el botón de cobro:
1. El cliente genera un identificador único UUID (`idempotency_key`) al abrir la transacción de cobro.
2. La función `process_stock_outlet` consulta si existe un registro previo con dicho `idempotency_key` en `stock_outlets`.
3. **Comportamiento ante reintento:** Si la clave ya existe, la función no vuelve a descontar stock ni crea nuevas partidas; retorna inmediatamente el folio original registrado, garantizando que cada venta se procese exactamente una vez.

---

## 12. Garantía de Atomicidad (ACID)

- **Todo o Nada:** En ventas de múltiples artículos (ej. 5 cuadernos y 2 cajas de lápices), si el último producto no cuenta con existencia suficiente, el motor PostgreSQL cancela todas las operaciones intermedias y no descuenta ninguno de los artículos.
- **Consistencia:** El stock en `products` y el historial en `inventory_logs` cambian de manera indivisible dentro de la misma transacción de base de datos.

---

## 13. Mecanismo de Desactivación Lógica (Soft Delete)

Para preservar la integridad referencial histórica:
- Los productos eliminados por el administrador no se borran físicamente (`DELETE FROM products` no se utiliza).
- Se actualiza la bandera booleana `is_active = false`.
- Las consultas en la terminal de Caja filtran automáticamente `WHERE is_active = true`, evitando que productos descontinuados sean vendidos.
- Las ventas pasadas, reportes y partidas en `stock_outlet_items` conservan sus claves foráneas válidas sin generar registros huérfanos.

---

## 14. Arquitectura de Auditoría Forense

La tabla `inventory_logs` funciona como un libro mayor contable (*ledger*) inalterable:

- **Generación Automática:** Los registros solo se insertan desde las funciones transaccionales RPC (`process_stock_outlet`, `cancel_stock_outlet` y `upsert_product_with_cost`).
- **Trazabilidad Completa:** Cada entrada almacena el stock previo, el nuevo stock, la variación neta (`quantity_changed`), el usuario responsable y la referencia de la venta.
- **Consulta de Solo Lectura:** La pantalla `/admin/auditoria` expone una interfaz de filtrado y búsqueda sin capacidades de edición o borrado.

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
- **Limpieza de Ciclo de Vida:** Al salir de la ruta `/caja`, el hook `onDestroy` remueve el event listener global de `window` para evitar fugas de memoria.

---

## 16. Modelo de Seguridad en Profundidad

La seguridad del sistema está estructurada en múltiples capas defensivas:

```text
1. NAVEGADOR       ──► Validación de formularios, captura de foco y sanitización.
2. SVELTEKIT SSR   ──► Validación de sesiones JWT y guardias RBAC de ruta (303).
3. API GATEWAY     ──► Operación exclusiva con anon key pública (sin service_role).
4. POSTGRESQL RLS  ──► Aislamiento estricto de tablas (product_costs invisible a cajeros).
5. RPC FUNCTIONS   ──► SECURITY DEFINER con verificación explícita de app_metadata.role.
```

---

## 17. Flujo Transaccional de Devolución

```text
[ Administrador ] ─── Abre Detalle en /admin/historial ───► Presiona "Cancelar Venta"
                                                                     │
                                                   Ingresa Motivo (mín. 3 chars)
                                                                     ▼
[ PostgreSQL ] ◄── Invoca RPC cancel_stock_outlet() ─────── [ Server Action ]
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
[ Cliente Web / Navegador ] ──► [ Proxy Inverso / HTTPS ] ──► [ Node.js (:3000) /build ] ──► [ Supabase Cloud ]
```

- **Adaptador:** `@sveltejs/adapter-node` compila la aplicación a JavaScript nativo en el directorio `/build`.
- **Arranque:** Ejecutado mediante `npm run start` o `node build`.
- **Variables de Entorno:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `PORT`, `ORIGIN`, `NODE_ENV`.
- **Exclusiones:** No se requiere ni soporta infraestructura Serverless / Edge (Vercel, Cloudflare Pages, etc.).

---

## 19. Arquitectura de Calidad y Pruebas (Quality Gate)

El sistema valida su integridad mediante cuatro niveles complementarios de evidencia:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ NIVEL D — E2E Browser Testing (Playwright / Chrome Real)                               │
│ └── tests/e2e/pos_critical_flow.spec.ts (1 test passed)                                │
│     Valida el flujo vertical completo: Login -> POS -> Scanner -> Checkout ->         │
│     Admin Login -> Cancelación -> Auditoría.                                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ NIVEL C — Integración Real en Supabase Cloud                                           │
│ └── tests/cloud/supabase_cloud.test.ts (7 tests passed)                                │
│     Valida conexión remota, Auth, RLS de product_costs y RPCs en base de datos real.   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ NIVEL B — Pruebas de Integración y Lógica de Aplicación (Vitest)                       │
│ └── 10 archivos de prueba locales (85 tests passed / 1 skipped):                       │
│     - tests/db/process_outlet.test.ts (6 tests)                                        │
│     - tests/db/cancel_outlet.test.ts (6 tests)                                         │
│     - tests/db/rls_costs.test.ts (6 tests)                                             │
│     - tests/auth/route_guards.test.ts (13 tests)                                       │
│     - tests/ui/admin_products.test.ts (9 tests)                                        │
│     - tests/ui/returns_audit.test.ts (8 tests)                                         │
│     - tests/ui/scanner_checkout.test.ts (10 tests)                                     │
│     - tests/ui/scanner_dom_lifecycle.test.ts (6 tests)                                 │
│     - tests/setup.test.ts (14 tests)                                                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ NIVEL A — Evidencia Estática (TypeScript, Linter y Esquema SQL v8.0)                   │
│ └── Verificación estricta de tipos, sintaxis Svelte y migración declarativa.           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

> **Nota sobre el Baseline de Pruebas:**
> - `npm run test` ejecuta la suite de Vitest reportando **85 pasados y 1 omitido (*skipped*)**. El test omitido corresponde a `pos_critical_flow.spec.ts`, que se ejecuta exclusivamente bajo Playwright con `npx playwright test`.

---

## 20. Estructura del Repositorio

```text
inventario_papeleria/
├── docs/                                  # Documentación oficial del sistema
│   ├── MANUAL_USUARIO.md                  # Manual operativo para cajeros
│   ├── GUIA_ADMINISTRADOR.md              # Guía de supervisión y gestión
│   ├── INSTALACION_Y_DEPLOYMENT.md        # Guía técnica de aprovisionamiento
│   └── ARQUITECTURA.md                    # Documento de arquitectura (este archivo)
├── src/
│   ├── lib/
│   │   ├── components/                    # Componentes modulares Svelte 5
│   │   └── supabase/                      # Clientes client.ts y server.ts
│   └── routes/                            # Sistema de rutas y Server Actions
├── supabase/
│   └── migrations/
│       └── 20260829000000_init_v8.sql     # Esquema SQL, RLS, RPCs y triggers
├── tests/
│   ├── auth/                              # Pruebas de guardias y RBAC
│   ├── cloud/                             # Pruebas de integración Supabase Cloud
│   ├── db/                                # Pruebas locales de RPCs y RLS
│   ├── e2e/                               # Pruebas de navegador con Playwright
│   └── ui/                                # Pruebas de componentes y DOM
├── package.json                           # Scripts y dependencias
├── svelte.config.js                       # Configuración de SvelteKit y adapter-node
├── vite.config.ts                         # Configuración de empaquetado Vite
└── playwright.config.ts                   # Configuración del runner E2E
```

---

## 21. Decisiones Arquitectónicas Relevantes (ADR Summary)

1. **Renderizado SSR:** Garantiza que las credenciales, validaciones RBAC y cookies de sesión se procesen en el servidor antes de entregar contenido al navegador.
2. **Aislamiento de Costos en Tabla Separada:** Separa `product_costs` de `products` para habilitar una política RLS estricta que impide la fuga de datos financieros hacia la terminal de cobro.
3. **Funciones RPC `SECURITY DEFINER`:** Centraliza la lógica transaccional de cobro y devolución en PostgreSQL, eliminando discrepancias por latencia de red y garantizando atomicidad total.
4. **Adopción de `@sveltejs/adapter-node`:** Genera un artefacto estándar ejecutable en cualquier contenedor o servidor dedicado sin atarse a proveedores propietarios de funciones serverless.

---

## 22. Limitaciones Arquitectónicas

- **Runtime Target:** Exclusivamente Node.js para el servidor de producción. No compatible con plataformas serverless tipo Vercel / Cloudflare Workers.
- **Hardware de Escaneo:** Diseñado para lectores de código de barras USB configurados en emulación de teclado (**HID / Keyboard Wedge**). No se implementa comunicación por puerto serie virtual (**Web Serial**).
- **Validación E2E:** Pipeline automatizado validado sobre motores **Chromium / Google Chrome**.

---

## 23. Flujo Integral del Sistema

```text
 ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
 │    LOGIN     │ ───► │ AUTORIZACIÓN │ ───► │  CAJA / POS  │ ───► │    COBRO     │
 │  Credenciales│      │  app_metadata│      │ Lector <100ms│      │ RPC Atómica  │
 └──────────────┘      └──────────────┘      └──────────────┘      └──────┬───────┘
                                                                          │
                                                                          ▼
 ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
 │  AUDITORÍA   │ ◄─── │ RESTAURACIÓN │ ◄─── │  DEVOLUCIÓN  │ ◄─── │  INVENTARIO  │
 │Bitácora Inmut│      │ Stock Reint. │      │ Admin Motivo │      │Stock Deducido│
 └──────────────┘      └──────────────┘      └──────────────┘      └──────────────┘
```
