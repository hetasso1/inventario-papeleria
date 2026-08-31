# Guía del Administrador — Sistema de Punto de Venta e Inventario

---

## 1. Objetivo de la guía

Esta guía proporciona al **Administrador del Sistema** las directrices operativas, de control y de supervisión necesarias para gestionar el catálogo de productos, proteger la confidencialidad de los costos de compra, auditar los movimientos de existencias, autorizar cancelaciones o devoluciones y garantizar la integridad del inventario de la papelería.

Como Administrador, sus responsabilidades principales son:
- Mantener actualizado el catálogo de artículos, precios al público y niveles de stock mínimo.
- Registrar y custodiar la información confidencial de costos de adquisición.
- Supervisar el historial cronológico de ventas y la actuación de los cajeros en mostrador.
- Evaluar y autorizar devoluciones de mercancía con reintegración automática al inventario.
- Inspeccionar periódicamente la bitácora inalterable de auditoría forense ante cualquier discrepancia.

---

## 2. Acceso Administrativo

### Inicio de Sesión
1. Abra el navegador web e ingrese a la dirección asignada al sistema.
2. Ingrese su **Correo Electrónico de Administrador** y su **Contraseña**.
3. Haga clic en **"Iniciar Sesión"**.

### Diferencia entre sesión de Administrador y Cajero
- **Sesión de Administrador:** Cuenta con permisos globales para operar el Punto de Venta en `/caja` y navegar libremente por todos los módulos de gestión bajo la ruta `/admin/*` (Productos, Historial y Auditoría).
- **Sesión de Cajero:** Su acceso está limitado exclusivamente a la terminal de ventas en mostrador (`/caja`). Si un usuario con rol de cajero intenta ingresar a cualquier sección administrativa, el sistema denegará la petición y lo redirigirá automáticamente a la terminal de cobro.

### Comportamiento ante credenciales incorrectas
Si ingresa datos no válidos, el sistema presentará el mensaje:
> *"Credenciales inválidas. Verifique su correo y contraseña."*

Por seguridad, no se revela si el dato erróneo corresponde al correo o a la contraseña. Verifique que no tenga el bloqueo de mayúsculas activo e intente nuevamente.

---

## 3. Módulos y Áreas Administrativas

El sistema cuenta con tres áreas administrativas especializadas accesibles desde la barra de navegación superior:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  SISTEMA POS & INVENTARIO                                                              │
│  [ Ir a Caja ]   [ Productos ]   [ Historial ]   [ Auditoría ]   ( admin@papeleria.com )│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Gestión de Productos (`/admin/productos`):** Módulo central del catálogo para dar de alta nuevos artículos, fijar precios de venta, registrar costos confidenciales, actualizar existencias y desactivar artículos descontinuados.
2. **Historial de Salidas y Ventas (`/admin/historial`):** Registro cronológico de todas las ventas cobradas en mostrador, desglose pormenorizado de partidas y procesamiento de devoluciones/cancelaciones.
3. **Auditoría Forense de Inventario (`/admin/auditoria`):** Bitácora inmutable de solo lectura que documenta cada incremento o decremento de inventario con fecha, hora, usuario ejecutor, folio y diferencial exacto.

---

## 4. Gestión del Catálogo de Productos

Ubicación: **/admin/productos**

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  CATÁLOGO DE PRODUCTOS (ADMINISTRACIÓN)                         [ + Nuevo Producto ]   │
│  [ Buscar por nombre o SKU...                                ]                         │
├───────────────┬──────────────────────────┬──────────┬──────────┬──────────┬────────────┤
│ SKU           │ Nombre                   │ Precio   │ Costo    │ Stock    │ Acciones   │
├───────────────┼──────────────────────────┼──────────┼──────────┼──────────┼────────────┤
│ 7501031311309 │ Cuaderno Profesional 100h│ $35.00   │ $22.50   │ 45.000   │ [Editar]   │
│ 7501234567890 │ Lápiz Grafito HB #2      │ $5.00    │ $2.10    │ 120.000  │ [Desact.]  │
└───────────────┴──────────────────────────┴──────────┴──────────┴──────────┴────────────┘
```

### Consultar y buscar productos
- La tabla muestra todos los productos actualmente **activos**.
- Puede ingresar cualquier texto o código en el campo de búsqueda superior para filtrar instantáneamente por nombre o código SKU.
- Si un artículo tiene existencias iguales o inferiores a su stock mínimo configurado, el sistema resaltará el indicador de stock como recordatorio preventivo para reabastecer.

### Crear un nuevo producto
1. Haga clic en el botón **"+ Nuevo Producto"**.
2. Complete la información en la ventana modal:
   - **SKU / Código de Barras:** Identificador alfanumérico único. Puede teclearlo manualmente o leer el código directamente con el escáner USB.
   - **Nombre del Producto:** Nombre comercial claro y descriptivo.
   - **Descripción:** Detalles complementarios del artículo (opcional).
   - **Precio de Venta:** Precio oficial al público (número mayor o igual a 0).
   - **Costo de Compra:** Costo unitario pagado al proveedor (número mayor o igual a 0).
   - **Stock Actual:** Cantidad física inicial disponible (admite valores fraccionados con hasta 3 decimales, ej. `100.000` o `25.500`).
   - **Stock Mínimo de Alerta:** Umbral numérico para advertir escasez (por defecto `5`).
   - **URL de Imagen:** Enlace a una imagen del producto (opcional).
3. Presione **"Guardar Producto"**. El sistema guardará el artículo y su costo confidencial simultáneamente.

### Editar un producto existente
1. Ubique el producto en la tabla y haga clic en **"Editar"**.
2. La ventana modal cargará los valores vigentes del artículo, incluyendo su costo de compra confidencial.
3. Modifique los campos necesarios (por ejemplo, actualizar el precio de venta o corregir el costo).
4. Presione **"Guardar Producto"**. Los cambios se reflejarán de inmediato en el catálogo y en la terminal de Caja.

### Desactivar un producto (Soft Delete / Baja Lógica)
- Cuando un artículo se descontinúa o deja de comercializarse, el Administrador debe hacer clic en el botón **"Desactivar"** en la fila correspondiente.
- **¿Qué significa desactivar para el negocio?:**
  - El producto cambia su estado a inactivo (`is_active = false`).
  - **Desaparece de forma inmediata de la terminal de Caja**, impidiendo que los cajeros puedan venderlo o agregarlo a nuevos carritos.
  - **No se borra físicamente de la base de datos:** El historial de ventas pasadas, las estadísticas y la bitácora de auditoría se conservan íntegros sin romper reportes anteriores.

---

## 5. Gestión Confidencial de Costos de Compra

### Concepto de Costo vs. Precio de Venta
- **Precio de Venta:** Es el importe público que el cliente paga en mostrador por cada unidad o fracción del producto. Es visible para cajeros y administradores.
- **Costo de Compra (Costo Unitario):** Es el precio neto que el negocio paga al proveedor para adquirir el producto. Constituye información estratégica para calcular la rentabilidad y el margen de ganancia.

### Reglas de Custodia y Confidencialidad:
1. **Acceso Exclusivo:** Los costos únicamente son visibles para usuarios con rol de **Administrador**.
2. **Aislamiento en Terminal de Caja:** Los cajeros no tienen acceso a la columna de costos en ninguna vista ni pueden deducir los márgenes comerciales desde la interfaz de cobro.
3. **Modificación Controlada:** El costo solo puede fijarse o actualizarse a través de la ventana modal de producto en `/admin/productos`.

---

## 6. Supervisión del Historial de Ventas

Ubicación: **/admin/historial**

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  HISTORIAL DE SALIDAS Y VENTAS                                                         │
├─────────┬──────────────────────────┬──────────────┬──────────────┬──────────┬──────────┤
│ Folio   │ Fecha y Hora             │ Cajero       │ Total Venta  │ Estado   │ Acciones │
├─────────┼──────────────────────────┼──────────────┼──────────────┼──────────┼──────────┤
│ #000104 │ 30/08/2026 14:22:10      │ cajero@...   │ $150.00      │ ● Activa │ [Detalle]│
│ #000103 │ 30/08/2026 13:10:05      │ admin@...    │ $45.00       │ ✕ Cancel.│ [Detalle]│
└─────────┴──────────────────────────┴──────────────┴──────────────┴──────────┴──────────┘
```

### Consulta y desglose de operaciones
- El historial muestra todas las transacciones ordenadas cronológicamente (las más recientes primero).
- Cada registro muestra el número consecutivo de **Folio**, la **Fecha y Hora**, el **Cajero** que cobró la venta, el **Importe Total** y el **Estado**.
- Al hacer clic en **"Ver Detalle"**, se despliega el desglose completo de artículos: nombre del producto, SKU, cantidad vendida (entera o fraccionada), precio unitario cobrado y subtotal por renglón.

### Estados de Venta
- **Activa (Verde):** Transacción completada legalmente cuyo importe ingresó a caja y cuyo stock fue descontado del inventario.
- **Cancelada (Gris/Rojo):** Transacción anulada formalmente mediante el proceso de devolución. Muestra la fecha/hora de cancelación y el motivo justificado.

---

## 7. Procedimiento de Cancelación y Devolución

La cancelación de una venta es una operación **exclusiva del Administrador** que anula el folio y devuelve la mercancía al inventario disponible.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  MODAL: DETALLE DE VENTA #000104                                                       │
│  Partidas:                                                                             │
│  - 2.000 x Cuaderno Profesional ($35.00) = $70.00                                      │
│  - 1.500 x Papel Kraft ($12.00) = $18.00                                               │
│  TOTAL: $88.00                                                                         │
│                                                                                        │
│  [ Cancelar Venta / Devolución ]                                         [ Cerrar ]    │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  CONFIRMAR CANCELACIÓN Y DEVOLUCIÓN                                                    │
│  Esta acción cancelará la venta por $88.00 y restaurará el stock de todos los          │
│  artículos en inventario.                                                              │
│                                                                                        │
│  Motivo de la cancelación / devolución (Obligatorio, mín. 3 caracteres):               │
│  [ Cliente devolvió cuadernos por cambio de lista escolar____________________ ]        │
│                                                                                        │
│  [ Confirmar Devolución ]                                                [ Volver ]    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Paso a paso para procesar una devolución:
1. Ingrese a **/admin/historial**.
2. Localice la venta por su número de folio o fecha y haga clic en **"Ver Detalle"**.
3. Verifique que los artículos y cantidades coincidan con la mercancía devuelta físicamente por el cliente.
4. Presione el botón **"Cancelar Venta / Devolución"**.
5. En el cuadro de texto, **escriba obligatoriamente el motivo** de la devolución (mínimo 3 caracteres, por ejemplo: *"Cambio de producto solicitado por cliente"*, *"Error de cobro en mostrador"* o *"Mercancía defectuosa"*).
6. Presione **"Confirmar Devolución"**.

### Efectos automáticos e inmediatos en el sistema:
1. El estado de la venta cambia a **Cancelada**.
2. **Reintegración de existencias:** El sistema suma automáticamente las cantidades de cada artículo al stock del catálogo.
3. **Registro en auditoría:** Se inserta de forma automática una entrada de tipo **`DEVOLUCION`** en la bitácora forense vinculada al folio cancelado y con el motivo especificado.
4. **Irreversibilidad:** Una venta cancelada queda protegida; el sistema no permite volver a cancelarla.

---

## 8. Bitácora Forense de Auditoría

Ubicación: **/admin/auditoria**

La pantalla de auditoría es una **herramienta de supervisión inalterable y de solo lectura**. Ningún usuario (ni siquiera el administrador) puede editar, alterar o eliminar registros de esta bitácora.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  BITÁCORA FORENSE DE INVENTARIO                                                        │
│  Filtro Tipo: [ Todos ▼ ]   Buscar: [ Buscar por producto, SKU, folio o notas...     ] │
├─────────────────────┬──────────────┬────────────────────────┬─────────┬─────────┬──────┤
│ Fecha y Hora        │ Tipo         │ Producto / SKU         │ Previo  │ Nuevo   │ Ref. │
├─────────────────────┼──────────────┼────────────────────────┼─────────┼─────────┼──────┤
│ 30/08/2026 14:25:00 │ DEVOLUCION   │ Cuaderno Prof. (750..) │ 43.000  │ 45.000  │#00104│
│ 30/08/2026 14:22:10 │ VENTA        │ Cuaderno Prof. (750..) │ 45.000  │ 43.000  │#00104│
│ 30/08/2026 10:00:15 │ REABASTECIM. │ Lápiz Grafito (7501..) │ 20.000  │ 120.000 │Manual│
└─────────────────────┴──────────────┴────────────────────────┴─────────┴─────────┴──────┘
```

### Tipos de Movimientos Registrados:
- **`VENTA`:** Generado automáticamente cuando se completa un cobro en la terminal de Caja. Registra la salida de mercancía (diferencial negativo).
- **`DEVOLUCION`:** Generado automáticamente cuando el administrador autoriza la cancelación de un folio en el historial. Registra el reingreso de mercancía (diferencial positivo) junto con el motivo.
- **`REABASTECIMIENTO`:** Generado automáticamente cuando el administrador edita un producto en el catálogo e incrementa su stock físico disponible.
- **`AJUSTE_MANUAL`:** Generado automáticamente cuando el administrador edita un producto en el catálogo y reduce su stock físico.
- **`MERMA`:** Registro reservado para mermas o pérdidas justificadas.

### Información auditable en cada movimiento:
- **Fecha y Hora exacta:** Timestamp de la operación.
- **Tipo de Movimiento:** Etiqueta distintiva del evento.
- **Producto y SKU:** Identificador del artículo afectado.
- **Stock Previo:** Existencia física antes del movimiento.
- **Nuevo Stock:** Existencia física resultante.
- **Cambio Neto:** Cantidad sumada o restada.
- **Folio / Referencia:** Identificador de la venta vinculada o indicación de ajuste manual.
- **Usuario Responsable:** Identificador de la cuenta que autorizó o ejecutó la acción.
- **Notas / Motivo:** Justificación ingresada en la devolución o ajuste.

---

## 9. Supervisión y Balance de Inventario

El sistema garantiza que cada movimiento físico tenga una correspondencia matemática exacta en el inventario:

```text
       VENTA EN CAJA (Salida)                      DEVOLUCIÓN EN HISTORIAL (Reintegro)
┌──────────────────────────────────┐        ┌──────────────────────────────────┐
│ Stock Previo:            50.000  │        │ Stock Previo:            47.500  │
│ Cantidad Vendida:        -2.500  │        │ Cantidad Devuelta:       +2.500  │
│ ──────────────────────────────── │        │ ──────────────────────────────── │
│ Stock Resultante:        47.500  │        │ Stock Resultante:        50.000  │
└──────────────────────────────────┘        └──────────────────────────────────┘
```

### Principios clave para el administrador:
1. **Consistencia total:** El stock nunca disminuye ni aumenta sin generar simultáneamente su asiento correspondiente en `inventory_logs`.
2. **Validación de disponibilidad:** Si un cajero intenta vender más piezas o metros de los registrados en el catálogo, el cobro es rechazado automáticamente para proteger la integridad del stock.
3. **Trazabilidad de fracciones:** Las ventas por metro o fraccionadas descuentan exactamente la porción vendida con hasta 3 decimales, evitando desajustes acumulados a granel.

---

## 10. Seguridad y Buenas Prácticas Operativas

1. **Credenciales Personales e Intransferibles:** Nunca comparta su cuenta de Administrador con el personal de caja. Si un cajero requiere permisos temporales, asígnele una cuenta propia con el rol adecuado.
2. **Verificación Previa a Devoluciones:** Antes de confirmar una cancelación en el Historial, revise físicamente que la mercancía devuelta esté completa y en condiciones adecuadas.
3. **Motivos de Devolución Fidedignos:** Escriba descripciones claras y objetivas en el campo de motivo; este texto quedará asentado permanentemente en la bitácora de auditoría forense.
4. **Protección de Costos:** No deje la pantalla de edición de productos abierta en terminales accesibles al público o a los clientes.
5. **Cierre de Sesión:** Al retirarse de la terminal administrativa, cierre siempre su sesión en el navegador.

---

## 11. Resolución de Problemas Administrativos Frecuentes

### 1. Un cajero reporta que un producto no aparece en la terminal de Caja
- **Diagnóstico:** El producto probablemente fue desactivado (**Soft Delete**) o no ha sido dado de alta.
- **Acción:** Ingrese a `/admin/productos`, verifique si el código SKU existe y si está activo. Si está dado de baja, actívelo o edite sus datos.

### 2. El sistema rechaza una devolución con error
- **Diagnóstico:** El motivo ingresado no cumple con el mínimo requerido de 3 caracteres o la venta ya fue cancelada con anterioridad.
- **Acción:** Escriba una justificación completa en el campo de motivo y verifique en la tabla de historial que la venta se encuentre en estado "Activa".

### 3. El stock físico en estante no coincide con el stock en pantalla
- **Diagnóstico:** Pudo ocurrir una venta no registrada, una merma física o un conteo inicial erróneo.
- **Acción:** Ingrese a `/admin/auditoria` y filtre por el código SKU del producto. Revise todos los movimientos históricos (ventas, devoluciones y ajustes) para identificar cuándo y quién modificó el stock. Posteriormente, realice el ajuste correspondiente editando el producto en `/admin/productos`.

### 4. Un cajero intenta ingresar a rutas administrativas y el sistema lo regresa a Caja
- **Diagnóstico:** Comportamiento de seguridad normal del sistema (RBAC).
- **Acción:** No se requiere acción técnica; el sistema protege las pantallas administrativas y los costos frente a usuarios con rol de cajero.

---

## 12. Procedimiento Recomendado de Supervisión Diaria

Se recomienda que el Administrador ejecute la siguiente rutina al inicio y al cierre de la jornada comercial:

```text
 RUTINA DE SUPERVISIÓN DIARIA
 ─────────────────────────────────────────────────────────────────────────────
 [1] REVISIÓN DE ALERTAS DE STOCK (/admin/productos)
     • Identificar artículos marcados por debajo del stock mínimo.
     • Generar órdenes de compra a proveedores para reabastecimiento.

 [2] AUDITORÍA DE CANCELACIONES (/admin/historial)
     • Filtrar ventas canceladas del día.
     • Validar que todas las devoluciones cuenten con su motivo justificado.
     • Cotejar que los artículos devueltos estén físicamente en inventario.

 [3] INSPECCIÓN FORENSE (/admin/auditoria)
     • Revisar el volumen total de movimientos de salida (VENTA) y entrada (DEVOLUCION).
     • Verificar que no existan ajustes manuales de stock no autorizados.
```

---

## 13. Flujo Completo de Operación del Administrador

1. **Ingreso al Sistema:** El administrador inicia sesión con sus credenciales en `/login`.
2. **Actualización de Catálogo:** Accede a `/admin/productos`, da de alta nuevos productos recibidos de proveedores, captura el costo confidencial y el precio al público.
3. **Supervisión de Ventas:** A media jornada, consulta `/admin/historial` para monitorear el flujo de ventas cobradas por los cajeros.
4. **Atención de una Devolución:** Un cliente solicita cambiar un producto. El administrador localiza el folio en el historial, abre el detalle, presiona *"Cancelar Venta / Devolución"*, asienta el motivo y confirma la devolución.
5. **Comprobación de Inventario:** Verifica en el catálogo que el stock del artículo devuelto se haya incrementado automáticamente.
6. **Cierre y Auditoría:** Al término del día, ingresa a `/admin/auditoria` para validar la concordancia de todas las transacciones registradas.

---

## 14. Limitaciones Operativas Conocidas

- **Tipo de Escáner Compatible:** El sistema procesa lecturas de escáner USB estándar configurado en modo emulación de teclado (HID). No se requiere ni se admite integración por puerto serie virtual (COM / Web Serial).
- **Navegador Recomendado:** La interfaz administrativa y el flujo de punto de venta están optimizados y validados para **Google Chrome / Chromium**.
- **Arquitectura de Ejecución:** El sistema opera sobre un servidor Node.js centralizado enlazado a la base de datos en la nube. Requiere conectividad de red activa para registrar transacciones y sincronizar existencias.

---

## 15. Matriz Resumen de Permisos

| Capacidad Operativa | Administrador (`admin`) | Cajero (`cajero`) |
| :--- | :---: | :---: |
| **Operación de Caja y Cobro de Ventas (`/caja`)** | ✅ Permitido | ✅ Permitido |
| **Uso de Escáner USB y Carrito de Venta** | ✅ Permitido | ✅ Permitido |
| **Consulta de Catálogo Activo y Existencias Públicas** | ✅ Permitido | ✅ Permitido |
| **Acceso a Gestión de Catálogo (`/admin/productos`)** | ✅ Permitido | ❌ Denegado *(Redirige 303 a `/caja`)* |
| **Consulta y Modificación de Costos de Compra** | ✅ Permitido | ❌ Denegado *(0 registros por RLS)* |
| **Alta y Edición de Productos con Costo** | ✅ Permitido | ❌ Denegado |
| **Desactivación de Productos (Soft Delete)** | ✅ Permitido | ❌ Denegado |
| **Acceso a Historial de Ventas (`/admin/historial`)** | ✅ Permitido | ❌ Denegado *(Redirige 303 a `/caja`)* |
| **Autorización de Cancelaciones y Devoluciones** | ✅ Permitido | ❌ Denegado |
| **Acceso a Bitácora Forense (`/admin/auditoria`)** | ✅ Permitido | ❌ Denegado *(Redirige 303 a `/caja`)* |
