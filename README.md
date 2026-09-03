# Web App de Inventario y Punto de Venta para Papelería

[![SvelteKit](https://img.shields.io/badge/SvelteKit-2.0-orange?style=flat-square&logo=svelte)](https://kit.svelte.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2015-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Vitest](https://img.shields.io/badge/Vitest-Unit%20%26%20DB-green?style=flat-square&logo=vitest)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-45ba4b?style=flat-square&logo=playwright)](https://playwright.dev/)

Sistema web integral de **Gestión de Inventario y Punto de Venta (POS)** optimizado para papelerías y comercios minoristas. Diseñado para operar con alta velocidad en mostrador mediante escáneres de código de barras USB, ventas fraccionadas, aislamiento confidencial de costos de adquisición y auditoría inmutable en PostgreSQL.

---

## 1. Problema que Resuelve

- **Fugas de Información Financiera:** Impide que los cajeros visualicen costos de compra y márgenes de ganancia mediante políticas estrictas de *Row Level Security* (RLS).
- **Desfase en Inventario:** Previene existencias negativas y ventas concurrentes corruptas a través de transacciones atómicas en base de datos.
- **Lentitud en Mostrador:** Captura ráfagas de lectores de código de barras USB sin importar el foco del cursor y soporta artículos fraccionados (por metro o decimales).
- **Pérdida de Trazabilidad:** Prohíbe el borrado físico de registros (*Soft Delete* estricto) y audita de forma automática cada venta, devolución o ajuste manual.

---

## 2. Características Principales

- 🛒 **Terminal de Punto de Venta (POS):** Carrito reactivo, cálculo de totales en tiempo real y cobro en una sola transacción.
- ⚡ **Captura Global de Escáner USB:** Intercepción de ráfagas de teclado (<100ms) en la ventana del navegador.
- 📐 **Soporte de Ventas Fraccionadas:** Manejo de cantidades con precisión de 3 decimales (`NUMERIC(10,3)`).
- 🔒 **Aislamiento de Costos por RLS:** Acceso exclusivo a costos de adquisición para el rol Administrador.
- 🛡️ **Bajas Lógicas Obligatorias (Soft Delete):** Desactivación de artículos (`is_active = false`) sin romper llaves foráneas históricas.
- 🔄 **Cobro y Cancelación Atómica vía RPC:** Procedimientos almacenados PL/pgSQL que garantizan consistencia y reposición automática de stock en devoluciones.
- 📋 **Bitácora Inmutable de Auditoría:** Registro automático de todos los movimientos de almacén (`inventory_logs`).
- 🖼️ **Referencia de Imágenes de Producto:** Soporte para almacenar y mostrar imágenes mediante URLs externas (`image_url`).

---

## 3. Control de Acceso y Roles (RBAC)

| Rol | Alcance y Responsabilidades | Acceso a Módulos |
| :--- | :--- | :--- |
| **Cajero** | Operación de mostrador, escaneo de artículos y cobro de ventas. No puede ver costos, crear productos ni cancelar ventas. | `/caja`, `/login` |
| **Administrador** | Gestión de catálogo, consulta y edición de costos de compra, supervisión de salidas, anulación de ventas y consulta de auditoría. | `/caja`, `/admin/productos`, `/admin/historial`, `/admin/auditoria`, `/login` |

---

## 4. Mapa de Módulos

- **`/login`:** Inicio de sesión seguro con derivación automática de rol mediante autenticación local PostgreSQL y cookies de sesión HTTP-only firmadas.
- **`/caja`:** Terminal de cobro rápido con escáner USB y catálogo rápido.
- **`/admin/productos`:** Alta, edición, precios, costos confidenciales y stock mínimo de alerta.
- **`/admin/historial`:** Consulta de ventas históricas, desglose de partidas y anulación justificada con reposición de existencias.
- **`/admin/auditoria`:** Bitácora inmutable de movimientos de almacén con filtros por tipo de evento.

---

## 5. Arquitectura del Sistema

```
[ Navegador Web ] ──► [ SvelteKit SSR (hooks.server.ts / pg.Pool) ] ──► [ PostgreSQL 15 Local (Docker) ]
  • BarcodeScanner      • Autenticación y RBAC (Cookies)                 • Row Level Security (RLS)
  • CartTable           • Server-Side Actions                           • RPCs Atómicas (PL/pgSQL)
  • Admin Views         • Validación de Esquema                         • Triggers de Auditoría
```

---

## 6. Estado del Proyecto

- **Funcionalidad Principal:** **100% Implementada y Operativa** conforme al SRS v8.0.
- **Base de Datos y Seguridad:** Esquema DDL, políticas RLS, triggers y funciones RPC verificadas en PostgreSQL 15.
- **Pruebas Automatizadas:** 92 pruebas unitarias/integración y 1 prueba E2E en Playwright ejecutadas con éxito.
- **Mejoras Futuras (UX Backlog):** Redirección automática de la ruta raíz `/`, panel de dashboard administrativo, barra de navegación global y vista previa de imagen en modal.

---

## 7. Pruebas y Validación (Testing)

El repositorio incluye suites completas de pruebas automatizadas que validan tanto la base de datos PostgreSQL canónica local como los contratos de interfaz y SSR:

```bash
# Ejecutar todas las pruebas unitarias y de base de datos (PostgreSQL Docker)
npm run test

# Ejecutar pruebas End-to-End con Playwright (navegador real)
npx playwright test
```

- **Vitest:** `92 passed | 0 failed | 1 skipped` (93 tests totales).
- **PostgreSQL 15 Local (Docker):** 18 tests de integración DB (`tests/db/*.test.ts`) pasando al 100%.
- **Cloud Integration:** `7 passed | 0 failed | 0 skipped` (`tests/cloud/supabase_cloud.test.ts`).
- **Playwright E2E:** `1 passed` (Flujo crítico de venta, escáner USB, cobro y devolución en Chromium).

---

## 8. Instalación y Ejecución Rápida

### Requisitos Previos
- **Node.js:** Versión 20.x o 22.x LTS.
- **npm:** Versión 10.x o superior.
- **Docker Desktop / Docker Engine:** Para la base de datos PostgreSQL 15 local y ejecución de pruebas de integración DB.
- **Opcional (Despliegue Remoto):** Proyecto en Supabase Cloud.

---

### Pasos de Instalación y Puesta en Marcha

#### 1. Clonar el repositorio
```bash
git clone https://github.com/hetasso1/inventario-papeleria.git
cd inventario-papeleria
```

#### 2. Instalar dependencias
```bash
npm ci
```

#### 3. Levantar PostgreSQL Local (Docker)
El proyecto utiliza un contenedor Docker estandarizado (`pg_integration_test`) basado en `postgres:15-alpine` en el puerto `5433`:

```bash
# Crear e iniciar el contenedor local
docker run --name pg_integration_test -e POSTGRES_PASSWORD=postgres -d -p 5433:5432 postgres:15-alpine

# O si el contenedor ya existe y está detenido:
docker start pg_integration_test
```

#### 4. Crear y Migrar la Base de Datos de Desarrollo (`inventario_dev`)

**A. Crear la base limpia:**
```bash
docker exec -i pg_integration_test psql -U postgres -c "DROP DATABASE IF EXISTS inventario_dev WITH (FORCE);" -c "CREATE DATABASE inventario_dev;"
```

**B. Configurar esquema de compatibilidad Supabase (`auth` y funciones):**
```bash
docker exec -i pg_integration_test psql -U postgres -d inventario_dev -c "CREATE SCHEMA IF NOT EXISTS auth; CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), raw_app_meta_data JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT now()); CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS \$\$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.sub', true), ''), (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid; \$\$ LANGUAGE sql STABLE; CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS \$\$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb); \$\$ LANGUAGE sql STABLE; DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF; END \$\$; GRANT ALL ON SCHEMA public TO authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;"
```

**C. Aplicar las migraciones en orden secuencial:**

*En Windows (PowerShell):*
```powershell
Get-Content supabase/migrations/20260829000000_init_v8.sql -Raw | docker exec -i pg_integration_test psql -U postgres -d inventario_dev
Get-Content supabase/migrations/20260902000000_fix_stock_outlet_items_rls.sql -Raw | docker exec -i pg_integration_test psql -U postgres -d inventario_dev
```

*En Linux / macOS / Bash:*
```bash
docker exec -i pg_integration_test psql -U postgres -d inventario_dev < supabase/migrations/20260829000000_init_v8.sql
docker exec -i pg_integration_test psql -U postgres -d inventario_dev < supabase/migrations/20260902000000_fix_stock_outlet_items_rls.sql
```

**D. Otorgar permisos finales y crear usuarios de prueba:**
```bash
docker exec -i pg_integration_test psql -U postgres -d inventario_dev -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated; GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated; GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated; GRANT SELECT ON auth.users TO authenticated; ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE; ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS encrypted_password TEXT; INSERT INTO auth.users (id, email, raw_app_meta_data) VALUES ('11111111-1111-1111-1111-111111111111', 'admin@papeleria.com', '{\"role\": \"admin\"}') ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, raw_app_meta_data = EXCLUDED.raw_app_meta_data; INSERT INTO auth.users (id, email, raw_app_meta_data) VALUES ('22222222-2222-2222-2222-222222222222', 'cajero@papeleria.com', '{\"role\": \"cajero\"}') ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, raw_app_meta_data = EXCLUDED.raw_app_meta_data;"
```

#### 5. Verificar que PostgreSQL Local está Funcionando
Ejecutar la siguiente comprobación SQL para validar que las 5 tablas existen, tienen RLS activo (`rowsecurity = t`) y las RPCs están registradas:
```bash
docker exec -i pg_integration_test psql -U postgres -d inventario_dev -c "SELECT current_database(), version();" -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" -c "SELECT policyname, tablename, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;"
```

#### 6. Configurar Variables de Entorno
Copiar el archivo `.env.example` a `.env.local`:
```bash
cp .env.example .env.local
```
Completar las variables locales y de prueba:
```env
# Conexión local canónica
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/inventario_dev
PGHOST=localhost
PGPORT=5433
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=inventario_dev

# Supabase (para ejecución de pruebas y desarrollo)
PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
TEST_ADMIN_EMAIL=admin@papeleria.com
TEST_ADMIN_PASSWORD=admin777
TEST_CAJERO_EMAIL=cajero@papeleria.com
TEST_CAJERO_PASSWORD=cajero111
```

#### 7. Ejecutar Pruebas y Servidor
```bash
# Validar suite completa (92 passed, 0 failed, 1 skipped)
npm run test

# Iniciar servidor de desarrollo SvelteKit
npm run dev
```
Abrir en el navegador: [http://localhost:5173/login](http://localhost:5173/login)

#### 8. Compilar y Ejecutar en Modo Producción
```bash
npm run build
node build
```

## 9. Seguridad de Credenciales

> ⚠️ **Aviso Importante:** El archivo `.env.local` contiene credenciales reales de conexión y está estrictamente excluido del repositorio mediante `.gitignore`. Nunca exponga claves de servicio (`service_role`), JWT ni contraseñas en el control de versiones.

---

## 10. Índice de Documentación Oficial

Consulte los documentos técnicos y manuales funcionales disponibles en la carpeta [`docs/`](file:///d:/proyectos%20$/inventario_papeleria/docs):

- 📋 **[Especificación Funcional Completa](file:///d:/proyectos%20$/inventario_papeleria/docs/ESPECIFICACION_FUNCIONAL.md):** Descripción detallada de identidad, actores, matriz de permisos, casos de uso (CU-01 a CU-18) y reglas de negocio.
- 👤 **[Manual de Usuario](file:///d:/proyectos%20$/inventario_papeleria/docs/MANUAL_USUARIO.md):** Guía operativa para cajeros y personal de mostrador.
- 🛡️ **[Guía del Administrador](file:///d:/proyectos%20$/inventario_papeleria/docs/GUIA_ADMINISTRADOR.md):** Manual de supervisión, catálogo, costos confidenciales y devoluciones.
- 🚀 **[Instalación y Deployment](file:///d:/proyectos%20$/inventario_papeleria/docs/INSTALACION_Y_DEPLOYMENT.md):** Guía técnica de instalación limpia, configuración de servidor y despliegue en producción.
- 🏗️ **[Arquitectura del Sistema](file:///d:/proyectos%20$/inventario_papeleria/docs/ARQUITECTURA.md):** Especificación técnica de componentes, flujo de datos, RLS y esquemas DDL.
- 📄 **[Documento de Requerimientos de Software (SRS) v8.0](file:///d:/proyectos%20$/inventario_papeleria/Documento%20de%20Requerimientos%20de%20Software%20(SRS)%20%E2%80%94%20Versi%C3%B3n%208.0%20(Especificaci%C3%B3n%20de%20Arquitectura%20Final).pdf):** Documento formal de requisitos y arquitectura base.
