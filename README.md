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

- **`/login`:** Inicio de sesión seguro con derivación automática de rol mediante Supabase Auth.
- **`/caja`:** Terminal de cobro rápido con escáner USB y catálogo rápido.
- **`/admin/productos`:** Alta, edición, precios, costos confidenciales y stock mínimo de alerta.
- **`/admin/historial`:** Consulta de ventas históricas, desglose de partidas y anulación justificada con reposición de existencias.
- **`/admin/auditoria`:** Bitácora inmutable de movimientos de almacén con filtros por tipo de evento.

---

## 5. Arquitectura del Sistema

```
[ Navegador Web ] ──► [ SvelteKit SSR (hooks.server.ts) ] ──► [ Supabase PostgreSQL 15 ]
  • BarcodeScanner      • Autenticación y RBAC (Cookies)       • Row Level Security (RLS)
  • CartTable           • Server-Side Actions                 • RPCs Atómicas (PL/pgSQL)
  • Admin Views         • Validación de Esquema               • Triggers de Auditoría
```

---

## 6. Estado del Proyecto

- **Funcionalidad Principal:** **100% Implementada y Operativa** conforme al SRS v8.0.
- **Base de Datos y Seguridad:** Esquema DDL, políticas RLS, triggers y funciones RPC verificadas en PostgreSQL 15.
- **Pruebas Automatizadas:** 85 pruebas unitarias/integración y 1 prueba E2E en Playwright ejecutadas con éxito.
- **Mejoras Futuras (UX Backlog):** Redirección automática de la ruta raíz `/`, panel de dashboard administrativo, barra de navegación global y vista previa de imagen en modal.

---

## 7. Pruebas y Validación (Testing)

El repositorio incluye suites completas de pruebas automatizadas:

```bash
# Ejecutar todas las pruebas unitarias y de base de datos
npm run test

# Ejecutar pruebas End-to-End con Playwright
npx playwright test
```

- **Vitest:** `85 passed | 0 failed | 1 skipped` (86 tests totales).
- **Cloud Integration:** `7 passed | 0 failed | 0 skipped` (Supabase Cloud).
- **Playwright E2E:** `1 passed (11.0s)` (Flujo crítico de venta en Chromium).

---

## 8. Instalación y Ejecución Rápida

### Requisitos Previos
- **Node.js:** Versión 20.x o 22.x LTS.
- **npm:** Versión 10.x o superior.
- **Proyecto Supabase Cloud:** Instancia de Supabase con la migración v8.0 aplicada.

### Pasos de Instalación

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/hetasso1/inventario-papeleria.git
   cd inventario-papeleria
   ```

2. **Instalar dependencias:**
   ```bash
   npm ci
   ```

3. **Configurar variables de entorno:**
   Copiar `.env.example` a `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Completar las variables con la URL y la Anon Key de su proyecto Supabase:
   ```bash
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   TEST_ADMIN_EMAIL=admin@papeleria.com
   TEST_ADMIN_PASSWORD=your_admin_secure_password
   TEST_CAJERO_EMAIL=cajero@papeleria.com
   TEST_CAJERO_PASSWORD=your_cajero_secure_password
   PORT=3000
   ```

4. **Iniciar en modo desarrollo:**
   ```bash
   npm run dev
   ```
   Abrir en el navegador: [http://localhost:5173/login](http://localhost:5173/login)

5. **Construir y ejecutar en producción:**
   ```bash
   npm run build
   node build
   ```

---

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
