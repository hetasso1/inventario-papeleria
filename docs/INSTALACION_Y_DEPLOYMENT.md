# Guía de Instalación, Configuración y Despliegue en Producción

Esta guía detalla el procedimiento técnico paso a paso para clonar, configurar, aprovisionar la base de datos en Supabase Cloud, ejecutar suites de prueba automatizadas, compilar el paquete de producción y desplegar la aplicación en un entorno de servidor Node.js independiente.

---

## 1. Requisitos Previos

Antes de comenzar, asegúrese de que el entorno de desarrollo o el servidor de despliegue cumpla con los siguientes requisitos:

- **Node.js:** Versión `18.13.0+` o `20.x+` LTS (compatible con SvelteKit 2 y `@sveltejs/adapter-node` v5).
- **Gestor de paquetes:** `npm` versión `9.x+` o `10.x+` (incluido con Node.js).
- **Sistema de Control de Versiones:** `Git` versión `2.30+`.
- **Cuenta de Base de Datos:** Proyecto activo en [Supabase Cloud](https://supabase.com) con motor PostgreSQL 15+.
- **Navegador Web:** Google Chrome o Chromium (requerido para la ejecución de pruebas E2E con Playwright).
- **Hardware Opcional:** Lector de código de barras USB configurado en modo emulación de teclado (HID) para pruebas físicas en mostrador.

---

## 2. Obtener el Proyecto

1. Clone el repositorio desde su servidor de control de versiones:
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd inventario_papeleria
   ```

2. Instale las dependencias del proyecto:
   ```bash
   npm install
   ```

---

## 3. Variables de Entorno

El proyecto incluye una plantilla base [.env.example](file:///d:/proyectos%20$/inventario_papeleria/.env.example). Cree su archivo de configuración local a partir de dicha plantilla:

```bash
cp .env.example .env.local
```

### A. Variables utilizadas por la Aplicación Web SvelteKit (Browser y SSR)
Estas variables son consumidas por el cliente Supabase del navegador ([src/lib/supabase/client.ts](file:///d:/proyectos%20$/inventario_papeleria/src/lib/supabase/client.ts)) y por el cliente del servidor SSR ([src/lib/supabase/server.ts](file:///d:/proyectos%20$/inventario_papeleria/src/lib/supabase/server.ts)):

| Variable | Descripción | Ámbito | Obligatoria |
| :--- | :--- | :--- | :---: |
| `VITE_SUPABASE_URL` | URL base del proyecto Supabase Cloud (ej. `https://xxxx.supabase.co`). | Build / Runtime | **Sí** |
| `VITE_SUPABASE_ANON_KEY` | Clave pública anónima de Supabase con permisos RLS aplicados. | Build / Runtime | **Sí** |

### B. Variables utilizadas por las Pruebas de Integración Cloud (`tests/cloud/`)
Estas variables son leídas por el runner de pruebas de integración contra Supabase Cloud ([tests/cloud/supabase_cloud.test.ts](file:///d:/proyectos%20$/inventario_papeleria/tests/cloud/supabase_cloud.test.ts)):

| Variable | Descripción | Ámbito | Obligatoria |
| :--- | :--- | :--- | :---: |
| `PUBLIC_SUPABASE_URL` | URL del proyecto Supabase Cloud para la suite de integración. | Tests | **Sí** (en tests) |
| `PUBLIC_SUPABASE_ANON_KEY` | Clave pública anónima para inicializar clientes de prueba. | Tests | **Sí** (en tests) |
| `TEST_ADMIN_EMAIL` | Correo del usuario de prueba con rol de Administrador. | Tests | Opcional *(Def: admin@papeleria.com)* |
| `TEST_ADMIN_PASSWORD` | Contraseña del usuario de prueba Administrador. | Tests | **Sí** (en tests) |
| `TEST_CAJERO_EMAIL` | Correo del usuario de prueba con rol de Cajero. | Tests | Opcional *(Def: cajero@papeleria.com)* |
| `TEST_CAJERO_PASSWORD` | Contraseña del usuario de prueba Cajero. | Tests | **Sí** (en tests) |

### C. Variables utilizadas por el Runtime de Producción (Node.js)
| Variable | Descripción | Ámbito | Valor por Defecto |
| :--- | :--- | :--- | :--- |
| `PORT` | Puerto TCP de escucha del servidor HTTP Node.js. | Runtime | `3000` |
| `ORIGIN` | URL canónica de la aplicación (requerida por SvelteKit para validación CSRF en peticiones `POST`). | Runtime | `http://localhost:3000` |
| `NODE_ENV` | Entorno de ejecución (`production`). | Runtime | `production` |

> ⚠️ **Regla Crítica de Seguridad:** Nunca utilice ni exponga la clave de servicio (`service_role key`) en el código fuente, archivos `.env` ni repositorios. La aplicación opera exclusivamente con la clave pública anónima (`anon key`) y delega la seguridad en las políticas RLS y funciones `SECURITY DEFINER` de PostgreSQL.

---

## 4. Control de Versiones y Protección de Secretos

El archivo [.gitignore](file:///d:/proyectos%20$/inventario_papeleria/.gitignore) está configurado para excluir estrictamente cualquier archivo con credenciales locales, artefactos de compilación y datos temporales:

```gitignore
.env
.env.*
!.env.example
node_modules/
.svelte-kit/
build/
test-results/
```

### Verificación de Exclusión:
Verifique que los archivos de credenciales no estén rastreados por Git antes de confirmar cambios:
```bash
git status --ignored
```
Asegúrese de que `.env.local` aparezca listado bajo la sección de archivos ignorados (*Ignored files*).

---

## 5. Configuración del Proyecto en Supabase Cloud

1. Inicie sesión en [Supabase Dashboard](https://supabase.com/dashboard) y seleccione o cree un nuevo proyecto.
2. Diríjase a **Project Settings** → **API**:
   - Copie el valor de **Project URL** y asígnelo a `VITE_SUPABASE_URL` y `PUBLIC_SUPABASE_URL`.
   - Copie el valor de **Project API Keys** → `anon` / `public` y asígnelo a `VITE_SUPABASE_ANON_KEY` y `PUBLIC_SUPABASE_ANON_KEY`.
3. Diríjase a **Authentication** → **Providers** → **Email**:
   - Asegúrese de que el proveedor de correo y contraseña esté habilitado.
   - En entornos de prueba o despliegue privado, puede deshabilitar la opción *Confirm email* para permitir el acceso inmediato de los usuarios creados.

---

## 6. Migración de Base de Datos

El esquema completo de la aplicación (tablas, tipos ENUM, triggers de auditoría, políticas RLS y funciones RPC) se encuentra centralizado en un único archivo de migración:

📁 **Ruta:** [supabase/migrations/20260829000000_init_v8.sql](file:///d:/proyectos%20$/inventario_papeleria/supabase/migrations/20260829000000_init_v8.sql)

### Aplicación del esquema en Supabase Cloud:
1. En el panel lateral de Supabase, abra el módulo **SQL Editor**.
2. Abra una nueva pestaña de consulta (*New Query*).
3. Copie y pegue íntegramente el contenido del archivo `20260829000000_init_v8.sql`.
4. Haga clic en **Run** (o presione `Ctrl + Enter`).

### Comprobación posterior de objetos creados:
- **Tablas:** Verifique en **Table Editor** la existencia de `products`, `product_costs`, `stock_outlets`, `stock_outlet_items` e `inventory_logs`.
- **Row Level Security:** Compruebe en **Authentication** → **Policies** que todas las tablas tengan el candado RLS activado.
- **Funciones RPC:** Verifique en **Database** → **Functions** la presencia de `upsert_product_with_cost`, `process_stock_outlet` y `cancel_stock_outlet`.

### Aprovisionamiento de Usuarios y Roles:
La base de datos cuenta con el trigger `on_auth_user_created_set_role`. Al crear el primer usuario en Authentication, recibirá automáticamente el rol `admin`; los siguientes recibirán `cajero`.

Si aprovisiona usuarios directamente desde el Dashboard o por script, asegúrese de que el campo `raw_app_meta_data` contenga el rol respectivo:
- Administrador: `{"role": "admin"}`
- Cajero: `{"role": "cajero"}`

---

## 7. Ejecutar en Modo Desarrollo

Para iniciar el servidor de desarrollo local con recarga en caliente (HMR):

```bash
npm run dev
```

El servidor Vite iniciará y mostrará la dirección local:
```text
  VITE v8.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```
Abra `http://localhost:5173/login` en su navegador para interactuar con la aplicación.

---

## 8. Validación de la Instalación (Pruebas Unitarias y de Integración)

Ejecute la suite completa de pruebas automatizadas con Vitest:

```bash
npm run test
```

### Baseline de Validación Esperado:
```text
Test Files  10 passed | 1 skipped (11)
     Tests  85 passed | 1 skipped (86)
```
- **85 tests pasados:** Cobertura de guardias RBAC, pruebas de RPC en base de datos local, aislamiento de costos por RLS, cálculo de carrito y ciclo de vida del escáner en DOM.
- **1 test omitido (*skipped*):** La suite [tests/e2e/pos_critical_flow.spec.ts](file:///d:/proyectos%20$/inventario_papeleria/tests/e2e/pos_critical_flow.spec.ts) se omite deliberadamente bajo el runner de Vitest porque es una prueba de navegador real diseñada para ejecutarse de forma independiente con Playwright.

---

## 9. Pruebas de Integración en Supabase Cloud

Para verificar que la instancia remota de Supabase Cloud tiene la migración correcta, autenticación funcional y políticas RLS activas:

```bash
npx vitest run --reporter=verbose tests/cloud/supabase_cloud.test.ts
```

### Baseline Esperado:
```text
✓ 1. Conexión Supabase Cloud: verifica configuración y conectividad a proyecto remoto válido
✓ 2. Auth Real: autentica usuario Admin y verifica derivación de rol app_metadata.role
✓ 3. Auth Real: autentica usuario Cajero y verifica derivación de rol app_metadata.role
✓ 4. RLS product_costs: cajero autenticado recibe 0 registros debido a Row Level Security
✓ 5. RPC upsert_product_with_cost: Admin crea producto con costo de forma atómica
✓ 6. RPC process_stock_outlet: Cajero procesa venta idempotente y descuenta stock
✓ 7. RPC cancel_stock_outlet: Admin cancela venta, restaura stock y bloquea a Cajero

Test Files  1 passed (1)
     Tests  7 passed (7)
```

---

## 10. Pruebas End-to-End en Navegador Real (Playwright)

El archivo [playwright.config.ts](file:///d:/proyectos%20$/inventario_papeleria/playwright.config.ts) está configurado para compilar la aplicación, levantar automáticamente el servidor Node.js en el puerto 3000 y ejecutar el flujo crítico vertical sobre **Google Chrome**.

```bash
npx playwright test tests/e2e/pos_critical_flow.spec.ts
```

### Baseline Esperado:
```text
Running 1 test using 1 worker

  ok 1 tests/e2e/pos_critical_flow.spec.ts › Flujo Vertical Crítico Completo (Login Cajero → RBAC → Scanner USB dual-foco → Cobro → Login Admin → Devolución → Auditoría)

  1 passed
```

---

## 11. Compilación para Producción (Build)

La compilación empaqueta los componentes Svelte, el cliente web y el servidor SSR utilizando `@sveltejs/adapter-node`.

```bash
npm run build
```

### Artefacto generado:
- Se crea el directorio `/build` que contiene el archivo de entrada standalone `build/index.js` y los activos estáticos optimizados en `build/client`.

### Observaciones sobre avisos (Warnings) en build:
- Durante la compilación, Vite emite el aviso informativo:
  `svelte.config.js is ignored when options are passed via your Vite config`
  Este aviso se debe a la configuración del plugin en `vite.config.ts` y no afecta la generación del artefacto ni la ejecución del servidor Node.js.
- Se muestran advertencias de accesibilidad (A11y) sobre botones auxiliares que tampoco bloquean la compilación.
- El build finaliza con `> Using @sveltejs/adapter-node` y `✔ done`.

---

## 12. Ejecución del Servidor de Producción

Una vez generado el directorio `/build`, arranque el servidor web Node.js mediante:

```bash
npm run start
```
o directamente invocando el binario de Node:
```bash
node build
```

El proceso escuchará conexiones entrantes en el puerto configurado:
```text
Listening on http://0.0.0.0:3000
```

---

## 13. Arquitectura de Despliegue en Servidor

El proyecto está configurado para ejecutarse en cualquier entorno con soporte para **Node.js standalone** (Servidor Linux/Windows, VPS, contenedor Docker, o plataformas PaaS como Railway, Render, Fly.io):

```text
  [ Cliente Web / Navegador Chrome ]
                 │
                 ▼ (Puerto 80 / 443 HTTPS)
  [ Proxy Inverso: Nginx / Caddy / Cloud Host ]
                 │
                 ▼ (Puerto 3000 HTTP local)
  [ Servidor Node.js (node build) ]
                 │
                 ▼ (HTTPS / WSS / REST)
  [ Supabase Cloud (PostgreSQL 15) ]
```

> 🚫 **Nota sobre Serverless / Edge:** El proyecto está empaquetado exclusivamente con `@sveltejs/adapter-node`. No se incluye soporte ni adaptadores para Vercel Serverless, Cloudflare Pages/Workers o Netlify Edge.

---

## 14. Configuración del Servidor de Producción

En el servidor de producción (o en el panel de variables de su proveedor PaaS), configure las siguientes variables de entorno a nivel del sistema operativo:

```bash
# Variables del motor Supabase
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Configuración de red y seguridad
PORT=3000
ORIGIN=https://pos.tudominio.com
NODE_ENV=production
```

> **Aviso sobre ORIGIN:** SvelteKit exige la variable `ORIGIN` en producción para validar el encabezado `Origin` en peticiones `POST` de formularios y proteger contra ataques CSRF.

---

## 15. Checklist de Verificación para Puesta en Producción

Antes de liberar el sistema a los usuarios finales en mostrador, valide los siguientes puntos:

- [ ] **Node.js:** Versión 18.13+ o 20+ LTS instalada en el host.
- [ ] **Dependencias:** `npm install` ejecutado limpiamente.
- [ ] **Variables de Entorno:** `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` configuradas.
- [ ] **Seguridad de Secretos:** `.env.local` excluido y ausente en Git.
- [ ] **Esquema de BD:** Migración `20260829000000_init_v8.sql` ejecutada en Supabase Cloud.
- [ ] **Políticas RLS:** RLS activo en las 5 tablas (`products`, `product_costs`, `stock_outlets`, `stock_outlet_items`, `inventory_logs`).
- [ ] **Usuarios y Roles:** Cuentas `admin` y `cajero` creadas con sus respectivos claims en `app_metadata`.
- [ ] **Pruebas Automatizadas:** `npm run test` finalizado con 85 tests pasados.
- [ ] **Prueba Cloud:** `supabase_cloud.test.ts` finalizado con 7 tests pasados.
- [ ] **Prueba E2E:** `pos_critical_flow.spec.ts` finalizado con 1 test pasado en Chromium.
- [ ] **Compilación:** `npm run build` ejecutado exitosamente con artefacto en `/build`.
- [ ] **Arranque de Producción:** Servidor iniciado con `node build` o gestor de procesos (PM2 / Systemd).
- [ ] **Verificación de Mostrador:** Acceso a `/caja` verificado, lector de código de barras probado y venta de prueba cobrada con éxito.

---

## 16. Guía de Solución de Problemas (Troubleshooting)

### 1. Error de conexión con Supabase (`TypeError: fetch failed` o variables ausentes)
- **Causa:** Las variables `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY` no están presentes en el entorno.
- **Solución:** Compruebe que `.env.local` exista en la raíz del proyecto o que las variables del host de producción estén asignadas antes de arrancar `node build`.

### 2. Error de redirección CSRF en producción (`Cross-site POST form submissions are forbidden`)
- **Causa:** La variable de entorno `ORIGIN` no coincide con el dominio real desde el cual se accede a la aplicación.
- **Solución:** Configure `ORIGIN=https://tu-dominio.com` en el servidor de producción.

### 3. Las pruebas de Playwright fallan al iniciar (`Executable doesn't exist`)
- **Causa:** Los binarios de navegador de Playwright no han sido instalados en el sistema.
- **Solución:** Ejecute `npx playwright install chromium` o `npx playwright install chrome`.

### 4. Error al ejecutar RPCs (`function process_stock_outlet does not exist`)
- **Causa:** La migración SQL v8.0 no fue ejecutada completamente en el proyecto de Supabase Cloud.
- **Solución:** Abra el SQL Editor en Supabase Dashboard y reejecute el contenido de [20260829000000_init_v8.sql](file:///d:/proyectos%20$/inventario_papeleria/supabase/migrations/20260829000000_init_v8.sql).

### 5. Puerto ocupado (`Error: listen EADDRINUSE: address already in use :::3000`)
- **Causa:** Otro proceso está utilizando el puerto 3000.
- **Solución:** Defina un puerto alternativo mediante la variable `PORT=3001 node build`.

### 6. Artículos no visibles en el Historial de Ventas (0 productos / tabla vacía en detalle)
- **Causa:** La tabla `stock_outlet_items` tiene Row Level Security (RLS) activo pero le falta la política permisiva de `SELECT` para usuarios autenticados.
- **Solución:** Ejecute en el **SQL Editor** de Supabase Cloud la migración [20260902000000_fix_stock_outlet_items_rls.sql](file:///supabase/migrations/20260902000000_fix_stock_outlet_items_rls.sql):
  ```sql
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

---

## 17. Checklist de Seguridad Antes de Publicar

- [ ] `.env.local` verificado dentro de `.gitignore` (no rastreado por Git).
- [ ] Ninguna clave `service_role` ni contraseña escrita en archivos de documentación o código fuente.
- [ ] Ningún secreto expuesto en commits o mensajes de Git.
- [ ] Uso exclusivo de `anon key` pública para el cliente y el servidor SSR.
- [ ] Cookies de sesión configuradas con `path: '/'` y protegidas por SSR.
- [ ] Comunicación HTTPS activada en el proxy inverso de producción.

---

## 18. Limitaciones Técnicas del Despliegue

1. **Runtimes de Ejecución:** El proyecto está diseñado exclusivamente para ejecutarse en entornos con runtime **Node.js** permanente mediante `@sveltejs/adapter-node`. No es compatible directamente con entornos serverless ni edge.
2. **Navegador del Pipeline:** La prueba End-to-End automatizada ha sido validada sobre motores basados en **Chromium / Google Chrome**.
3. **Escáner USB:** El punto de venta requiere lectores de código de barras configurados en modo teclado **USB HID** con retorno de carro (`Enter`). No se admite comunicación serie (RS-232 / Web Serial).

---

## 19. Procedimiento Rápido de Puesta en Marcha (Resumen en 10 Pasos)

```bash
# 1. Clonar el repositorio
git clone <URL_REPOSITORIO> && cd inventario_papeleria

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno locales
cp .env.example .env.local
# (Editar .env.local con las credenciales de Supabase Cloud)

# 4. Aplicar esquema de base de datos
# (Ejecutar supabase/migrations/20260829000000_init_v8.sql en el SQL Editor de Supabase)

# 5. Crear usuarios de prueba en Supabase Authentication (admin y cajero)

# 6. Validar pruebas unitarias y de integración
npm run test

# 7. Validar integración remota en Supabase Cloud
npx vitest run tests/cloud/supabase_cloud.test.ts

# 8. Validar flujo crítico en navegador real
npx playwright test tests/e2e/pos_critical_flow.spec.ts

# 9. Compilar para producción
npm run build

# 10. Iniciar servidor de producción
npm run start
```
