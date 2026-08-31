# Sistema POS, Control de Inventario y Auditoría Forense

Sistema web integral de **Punto de Venta (POS)**, **Gestión de Inventario** y **Bitácora Forense de Auditoría**, diseñado para papelerías y comercios minoristas con soporte para transacciones unitarias y artículos fraccionados por medida.

Construido sobre **SvelteKit** (con Svelte 5 Runes), **TailwindCSS**, **Supabase Cloud (PostgreSQL 15)** y empaquetado para producción mediante **`@sveltejs/adapter-node`**.

---

## 1. Propósito y Roles del Sistema

El sistema centraliza las operaciones de mostrador y administración bajo un esquema estricto de control de acceso basado en roles (**RBAC**) gestionado desde el servidor:

- **Cajero (`cajero`):** Operación ágil de terminal de venta, lectura automática de códigos de barras mediante escáner USB, captura de artículos fraccionados, cobro transaccional e idempotente, y visualización de existencias de catálogo activo. Tiene restringido el acceso a módulos administrativos y costos de compra.
- **Administrador (`admin`):** Control total del catálogo de productos, gestión confidencial de costos de adquisición, desactivación lógica de artículos (**Soft Delete**), consulta del historial de ventas, procesamiento atómico de devoluciones con reversión de inventario y consulta de la bitácora inmutable de auditoría forense.

---

## 2. Características Principales

- **Autenticación SSR y Sesiones Seguras:** Manejo de sesiones en servidor sincronizadas mediante cookies HTTP-only a través de `@supabase/ssr`.
- **Control de Acceso RBAC Server-Side:** Middleware en `hooks.server.ts` que protege rutas `/admin/*` y redirige automáticamente a usuarios con rol `cajero` hacia `/caja` con código `HTTP 303`.
- **Terminal POS y Escáner USB Resiliente:** Captura global de lecturas de código de barras mediante ráfagas rápidas de teclado (<100ms) finalizadas en `Enter`, funcionando transparentemente aun cuando el cursor está enfocado en `<input>` o `<button>`.
- **Soporte para Cantidades Fraccionadas:** Manejo de precisión `NUMERIC(10,3)` para artículos vendidos por metro o a granel (ej. listón, cartulina, papel).
- **Cobro Atómico e Idempotente (`process_stock_outlet`):** Recálculo de precios oficiales en base de datos (inmune a manipulaciones del cliente), bloqueo de filas `FOR UPDATE` para evitar sobreventas y prevención de cobros duplicados mediante `idempotency_key` (UUID v4).
- **Aislamiento Confidencial de Costos (RLS):** La tabla `product_costs` está desacoplada físicamente y protegida por Row Level Security; los cajeros reciben 0 filas al intentar consultar costos.
- **Desactivación Lógica (Soft Delete):** Los productos se desactivan con `is_active = false`, impidiendo nuevas ventas pero preservando la integridad referencial en históricos y auditoría.
- **Devoluciones Atómicas (`cancel_stock_outlet`):** Cancelación de folios exclusiva para administradores que restaura el stock en base de datos e inserta registros de auditoría tipo `DEVOLUCION`.
- **Bitácora Inmutable de Auditoría (`inventory_logs`):** Registro inalterable de solo inserción (append-only) que audita todo cambio de inventario (`VENTA`, `DEVOLUCION`, `REABASTECIMIENTO`, `AJUSTE_MANUAL`, `MERMA`).

---

## 3. Módulos del Sistema

| Módulo | Ruta | Rol Requerido | Función Principal |
| :--- | :--- | :--- | :--- |
| **Login** | `/login` | Anónimo / Todos | Formulario de autenticación con correo y contraseña. Redirige a `/caja` si ya existe sesión activa. |
| **Punto de Venta (POS)** | `/caja` | `cajero`, `admin` | Terminal de ventas, buscador en tiempo real, captura por escáner USB, carrito interactivo y cobro atómico. |
| **Catálogo de Productos** | `/admin/productos` | `admin` | Alta y edición atómica de productos con costo unitario, búsqueda y desactivación lógica (**Soft Delete**). |
| **Historial de Ventas** | `/admin/historial` | `admin` | Consulta de folios de salida, detalle de artículos vendidos y procesamiento de cancelaciones/devoluciones. |
| **Auditoría Forense** | `/admin/auditoria` | `admin` | Inspección inmutable de movimientos de stock con filtros por tipo de evento y búsqueda de folios/SKU. |

---

## 4. Roles y Permisos

| Capacidad / Función | Administrador (`admin`) | Cajero (`cajero`) | Anónimo (Sin sesión) |
| :--- | :---: | :---: | :---: |
| Acceso a Pantalla de Login (`/login`) | ✅ | ✅ | ✅ |
| Acceso a Terminal POS (`/caja`) | ✅ | ✅ | ❌ *(Redirige 303 a `/login`)* |
| Escaneo USB y Cobro de Ventas | ✅ | ✅ | ❌ |
| Reintentos Idempotentes de Cobro | ✅ | ✅ | ❌ |
| Consulta de Catálogo Básico (Precio y Stock) | ✅ | ✅ | ❌ |
| Acceso a Módulo de Productos (`/admin/productos`) | ✅ | ❌ *(Redirige 303 a `/caja`)* | ❌ *(Redirige 303 a `/login`)* |
| Visualización de Costos de Compra (`product_costs`) | ✅ | ❌ *(0 registros por RLS)* | ❌ |
| Creación / Modificación de Productos con Costo | ✅ | ❌ | ❌ |
| Desactivación de Productos (Soft Delete) | ✅ | ❌ | ❌ |
| Acceso a Historial de Ventas (`/admin/historial`) | ✅ | ❌ *(Redirige 303 a `/caja`)* | ❌ *(Redirige 303 a `/login`)* |
| Cancelación de Ventas / Devolución de Stock | ✅ | ❌ *(Bloqueado por RPC)* | ❌ |
| Acceso a Bitácora Forense (`/admin/auditoria`) | ✅ | ❌ *(Redirige 303 a `/caja`)* | ❌ *(Redirige 303 a `/login`)* |

---

## 5. Flujos de Operación

### Flujo del Cajero
1. **Inicio de Sesión:** El cajero ingresa a `/login` con sus credenciales y es redirigido automáticamente a `/caja`.
2. **Búsqueda / Captura de Productos:**
   - *Por catálogo visual:* Clic sobre cualquier producto del catálogo rápido para agregarlo al carrito con cantidad inicial `1`.
   - *Por escáner USB:* Lectura física del código de barras. El sistema detecta la ráfaga (<100ms), agrega el producto o incrementa la cantidad en `+1` y muestra la confirmación `Último: [SKU]`.
3. **Modificación de Cantidades:** Ajuste de unidades enteras o valores decimales fraccionados (ej. `1.500` metros).
4. **Cobro de Venta:** Clic en **"Cobrar Venta"**. El sistema envía la solicitud con un `idempotency_key` (UUID v4). La base de datos valida existencias, descuenta inventario y emite el folio de salida.
5. **Manejo de Excepciones:**
   - *Stock insuficiente:* Si la cantidad solicitada supera las existencias, la transacción se cancela atómicamente (`ROLLBACK`) y el carrito se conserva intacto para su corrección.
   - *Fallo de red / Reintento:* Si se reintenta el cobro con la misma clave de idempotencia, la base de datos retorna el ID de la venta previamente procesada sin duplicar el cobro ni descontar stock adicional.

### Flujo del Administrador
1. **Gestión de Catálogo (`/admin/productos`):** Alta de nuevos artículos mediante modal interactivo, asignando precio de venta y costo confidencial en una sola transacción atómica (`upsert_product_with_cost`).
2. **Desactivación (`Soft Delete`):** Desactivar artículos obsoletos; el producto cambia a `is_active = false` y deja de mostrarse en el POS sin eliminar datos históricos.
3. **Historial y Devoluciones (`/admin/historial`):** Consulta de folios de venta. Para devoluciones, el administrador ingresa el motivo; la RPC `cancel_stock_outlet` revierte el stock e inserta un registro `DEVOLUCION` en auditoría.
4. **Auditoría Forense (`/admin/auditoria`):** Inspección de la bitácora inmutable para verificar qué usuario realizó cada movimiento, el stock previo, el stock resultante y el identificador de referencia.

---

## 6. Escáner de Código de Barras USB

- **Modo Requerido:** El lector físico de código de barras (1D/2D) debe estar configurado en modo **Keyboard Wedge / USB HID** (emulación de teclado estándar) con sufijo terminador `Enter` (`CR` / `\r` o `LF` / `\n`).
- **Detección Temporal:** El listener global intercepta los caracteres emitidos a cadencia ultra-rápida (<100ms entre teclas) y los distingue de la escritura manual humana.
- **Resiliencia de Foco:** Funciona de manera global y transparente mientras el cajero tiene el cursor en cajas de búsqueda, botones u otros controles del DOM.
- **Alcance Validado:** Flujo crítico de escaneo validado en navegador Chromium / Google Chrome mediante pruebas automatizadas E2E.
- *Nota de compatibilidad:* No se requiere ni se utiliza Web Serial API, puertos COM virtuales ni drivers propietarios.

---

## 7. Arquitectura del Sistema

```text
[ Navegador Web / Chrome / POS ]
        │
        ▼ (HTTP / HTTPS / SSR Cookies)
[ SvelteKit Application Server (Node.js) ]
  ├── hooks.server.ts (Middleware RBAC + Sesiones SSR)
  ├── Server Actions & Load Functions (Validación, Sanitización, Idempotencia)
  └── BarcodeScanner / CartTable (Componentes Svelte 5 Runes)
        │
        ▼ (@supabase/ssr / PostgREST)
[ Supabase Cloud (PostgreSQL 15 Engine) ]
  ├── Row Level Security (RLS) -> Aislamiento de product_costs e inventory_logs
  ├── RPCs Atómicas (upsert_product_with_cost, process_stock_outlet, cancel_stock_outlet)
  └── Triggers Automáticos (handle_first_user_admin, log_product_stock_changes)
```

---

## 8. Seguridad y Modelo de Datos

### Seguridad
- **Roles en `app_metadata`:** Los roles residen en `raw_app_meta_data -> 'role'` (`admin` y `cajero`), impidiendo su modificación desde el cliente.
- **RPCs `SECURITY DEFINER`:** Las funciones de cobro, alta de producto y devolución se ejecutan con contexto seguro validando internamente los claims del JWT.
- **Políticas RLS Estrictas:** Sin permisos de eliminación física (`DELETE`) en ninguna tabla del sistema.

### Esquema de Base de Datos
- **`products`:** Catálogo de productos (`id`, `sku_code`, `name`, `price`, `stock`, `min_stock`, `is_active`).
- **`product_costs`:** Costos unitarios de adquisición confidenciales (`product_id`, `cost`).
- **`stock_outlets`:** Cabecera de salidas/ventas con soporte de idempotencia (`id`, `folio`, `user_id`, `total_amount`, `idempotency_key`, `is_canceled`).
- **`stock_outlet_items`:** Renglones de venta con precio oficial recalculado (`id`, `outlet_id`, `product_id`, `quantity`, `unit_price`, `subtotal`).
- **`inventory_logs`:** Bitácora inmutable de auditoría (`id`, `product_id`, `change_type`, `previous_stock`, `new_stock`, `quantity_changed`, `created_by`, `reference_id`, `notes`).

---

## 9. Requisitos del Sistema

- **Runtime:** Node.js versión `18.13+` o `20+` LTS.
- **Gestor de Paquetes:** npm versión `9+` o `10+`.
- **Base de Datos:** Proyecto en Supabase Cloud (PostgreSQL 15+ con extensiones `pgcrypto`).
- **Navegador Web:** Google Chrome / Chromium (navegador verificado en pipeline E2E).
- **Hardware Opcional:** Lector de código de barras USB estándar (Keyboard Wedge).

---

## 10. Configuración de Variables de Entorno

Crear un archivo `.env.local` en la raíz del proyecto basado en `.env.example`:

```bash
# Variables requeridas por la aplicación SvelteKit (Browser y SSR)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Variables requeridas para suites de prueba Cloud (tests/cloud/)
PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Credenciales de prueba para suites automatizadas
TEST_ADMIN_EMAIL=admin@papeleria.local
TEST_ADMIN_PASSWORD=your_admin_secure_password
TEST_CAJERO_EMAIL=cajero@papeleria.local
TEST_CAJERO_PASSWORD=your_cajero_secure_password

# Variables de entorno para Runtime de Producción Node.js
PORT=3000
ORIGIN=http://localhost:3000
NODE_ENV=production
```

> **Importante:** Nunca expongas claves de servicio (`service_role`), JWT ni contraseñas en el repositorio. El archivo `.env.local` está explícitamente ignorado por `.gitignore`.

---

## 11. Instalación y Puesta en Marcha

1. **Clonar el repositorio:**
   ```bash
   git clone <url-del-repositorio>
   cd inventario_papeleria
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar el entorno:**
   Copiar `.env.example` a `.env.local` y colocar las credenciales de tu proyecto en Supabase Cloud.

4. **Aplicar la migración en Supabase Cloud:**
   Abrir el **SQL Editor** en el Dashboard de Supabase y ejecutar íntegramente el script:
   `supabase/migrations/20260829000000_init_v8.sql`

5. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   La aplicación estará disponible en `http://localhost:5173`.

---

## 12. Pruebas Automatizadas

El proyecto cuenta con una pirámide completa de pruebas automatizadas clasificadas por nivel de evidencia:

- **Nivel A (Unitaria / DOM):** Lógica de componentes, cálculo de totales y ciclo de vida del escáner en DOM.
- **Nivel B (Integración DB):** Validación de RPCs, transacciones, RLS y Soft Delete.
- **Nivel C (Cloud Real):** Conexión remota contra Supabase Cloud, autenticación real con claims de rol y RPCs en la nube.
- **Nivel D (E2E Navegador Real):** Flujo vertical crítico completo ejecutado en Google Chrome con Playwright contra el build de producción Node.js y Supabase Cloud.

### Comandos de Testing

```bash
# 1. Ejecutar suite completa de pruebas unitarias, de integración y DOM (Vitest)
npm run test

# 2. Ejecutar específicamente la suite de integración contra Supabase Cloud real
npx vitest run --reporter=verbose tests/cloud/supabase_cloud.test.ts

# 3. Ejecutar la prueba End-to-End en navegador real (Playwright Chrome)
npx playwright test tests/e2e/pos_critical_flow.spec.ts
```

### Resultados de la Última Validación Oficial
- **Vitest (`npm run test`):** 10 archivos pasados, 1 archivo omitido (*skipped* justificado por pertenecer al runner de Playwright), **85 tests pasados, 0 fallidos, 1 omitido**.
- **Supabase Cloud (`supabase_cloud.test.ts`):** **7 tests pasados, 0 fallidos, 0 omitidos**.
- **Playwright E2E (`pos_critical_flow.spec.ts`):** **1 test de flujo vertical crítico pasado, 0 fallidos, 0 omitidos**.

---

## 13. Compilación y Despliegue a Producción

El proyecto utiliza `@sveltejs/adapter-node` para generar un servidor Node.js independiente de alto rendimiento.

1. **Generar el bundle de producción:**
   ```bash
   npm run build
   ```
   Esto compila el cliente y servidor en el directorio `/build`.

2. **Iniciar el servidor en producción:**
   ```bash
   npm run start
   # o directamente:
   node build
   ```
   El servidor arrancará escuchando en el puerto configurado (`PORT`, por defecto `3000`).

---

## 14. Limitaciones Conocidas

- **Validación de Navegadores:** La prueba automatizada End-to-End ha sido validada exclusivamente en **Google Chrome / Chromium**. Motores como Gecko (Firefox) o WebKit (Safari) no forman parte del pipeline automatizado actual.
- **Tipo de Escáner Compatible:** El sistema soporta lectores USB en modo emulación de teclado (HID). No se incluye soporte para comunicación por puerto serie virtual (Web Serial API / RS-232).
- **Runtime de Despliegue:** El artefacto está optimizado para entornos Node.js mediante `@sveltejs/adapter-node`. No se garantiza compatibilidad directa con runtimes serverless o edge sin cambiar el adaptador.
- **Warning informativo en Build:** Durante `npm run build` Vite emite el aviso `svelte.config.js is ignored when options are passed via your Vite config` debido a la configuración de opciones en `vite.config.ts`; este comportamiento no afecta la generación del build de Node.

---

## 15. Estructura del Proyecto

```text
inventario_papeleria/
├── .env.example                       # Plantilla de variables de entorno requeridas
├── .gitignore                         # Exclusión de secretos (.env.local), temporales y build
├── package.json                       # Scripts y dependencias del proyecto
├── playwright.config.ts               # Configuración del runner E2E con Google Chrome
├── svelte.config.js                   # Configuración de SvelteKit con adapter-node
├── vite.config.ts                     # Configuración de Vite, TailwindCSS y Vitest
│
├── supabase/
│   └── migrations/
│       └── 20260829000000_init_v8.sql # Migración PostgreSQL v8.0 (Tablas, RLS, RPCs, Triggers)
│
├── src/
│   ├── app.d.ts                       # Tipos globales de Locals (user, role, supabase)
│   ├── hooks.server.ts                # Middleware SSR y guardias de seguridad RBAC
│   │
│   ├── lib/
│   │   ├── components/
│   │   │   ├── admin/
│   │   │   │   └── ProductModal.svelte  # Modal de alta/edición de productos con costo
│   │   │   └── caja/
│   │   │       ├── BarcodeScanner.svelte # Componente de captura USB y cadencia <100ms
│   │   │       └── CartTable.svelte      # Carrito, cálculo de totales y cantidades
│   │   └── supabase/
│   │       ├── client.ts              # Cliente Supabase Browser
│   │       └── server.ts              # Cliente Supabase SSR con cookies
│   │
│   └── routes/
│       ├── +layout.svelte             # Layout raíz
│       ├── login/                     # Formulario y server action de autenticación
│       ├── caja/                      # Terminal POS y server action de cobro
│       └── admin/
│           ├── productos/             # Gestión de catálogo y costos
│           ├── historial/             # Historial de ventas y cancelaciones
│           └── auditoria/             # Bitácora forense de auditoría
│
└── tests/
    ├── auth/                          # Pruebas de guardias RBAC y redirección 303
    ├── db/                            # Pruebas de integración DB (RPCs, RLS, Soft Delete)
    ├── cloud/                         # Pruebas de integración contra Supabase Cloud real
    ├── ui/                            # Pruebas unitarias de UI y ciclo de vida DOM del escáner
    └── e2e/                           # Suite E2E vertical en navegador real (Playwright)
```

---

## 16. Documentación Futura

Para especificaciones operativas y de ingeniería detalladas, el proyecto contempla la incorporación de las siguientes guías en el directorio `docs/`:

- `docs/MANUAL_USUARIO.md`: Manual operativo para cajeros (uso del POS, escáner USB y cobros).
- `docs/GUIA_ADMINISTRADOR.md`: Manual de gestión para administradores (catálogo, costos y devoluciones).
- `docs/INSTALACION_Y_DEPLOYMENT.md`: Guía técnica de aprovisionamiento de infraestructura y despliegue.
- `docs/ARQUITECTURA.md`: Documento de arquitectura de software, modelo relacional y transaccionalidad.
