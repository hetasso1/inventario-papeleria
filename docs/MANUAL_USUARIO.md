# Manual de Usuario — Sistema de Punto de Venta e Inventario

---

## 1. ¿Qué es el sistema?

El **Sistema de Punto de Venta e Inventario** es una aplicación web diseñada para agilizar las operaciones diarias en papelerías y comercios minoristas.

Permite registrar ventas rápidas en mostrador mediante lectores de códigos de barras USB, gestionar artículos vendidos por piezas o unidades enteras, aplicar control preventivo de existencias en tiempo real, procesar cobros y devoluciones con folio oficial, y llevar un registro inmutable de auditoría para la supervisión administrativa.

El sistema es utilizado por dos tipos de usuarios:
1. **Cajeros:** Encargados de la atención en mostrador, escaneo de artículos, registro de productos en el carrito y cobro de ventas.
2. **Administradores:** Responsables de la gestión del catálogo, consulta y actualización de costos de compra, supervisión del historial de ventas, autorización de devoluciones e inspección de la bitácora de auditoría.

---

## 2. Acceso al sistema

### Pantalla de Inicio de Sesión
1. Abra el navegador web e ingrese a la dirección asignada para el sistema (por ejemplo, `http://localhost:3000` o la URL del servidor local).
2. Si no tiene una sesión activa, el sistema mostrará automáticamente la pantalla de **Inicio de Sesión**.
3. Ingrese su **Correo Electrónico** registrado.
4. Ingrese su **Contraseña**.
5. Haga clic en el botón **"Iniciar Sesión"**.

### Comportamiento ante credenciales incorrectas
Si ingresa un correo no registrado o una contraseña errónea, la pantalla mostrará una alerta en color rojo:
> *"Credenciales inválidas. Verifique su correo y contraseña."*

Por motivos de seguridad, el sistema no especifica si el dato incorrecto fue el correo o la contraseña. Verifique que no tenga la tecla de mayúsculas activada e intente nuevamente.

---

## 3. Roles y Niveles de Acceso

### Cajero
- Acceso directo a la terminal de ventas (**Caja / POS**).
- Uso del lector de códigos de barras USB y búsqueda manual de productos.
- Agregado, modificación de cantidades enteras (mínimo 1) y eliminación de artículos en el carrito.
- Cobro transaccional de ventas y asignación de folio numérico oficial.
- Consulta de existencias con alertas de bajo stock y bloqueo de productos agotados, y precios de venta al público.
- **Restricciones:** No tiene acceso a los costos de compra ni a los módulos administrativos (`/admin/*`). Si un cajero intenta ingresar a una sección administrativa, el sistema lo devolverá automáticamente a la pantalla de Caja.

### Administrador
- Acceso completo a la terminal de ventas (**Caja / POS**).
- Acceso exclusivo al catálogo de **Productos**, con facultad para crear, editar, fijar precios de venta, consultar/actualizar costos de adquisición confidenciales, exportar el catálogo activo a formato CSV compatible con Excel y desactivar artículos obsoletos (**Soft Delete**).
- Acceso exclusivo al **Historial de Ventas**, con facultad para revisar ventas pasadas mediante filtros temporales (por fecha o preset 'Hoy') y procesar **Cancelaciones / Devoluciones** que restauran el inventario automáticamente.
- Acceso exclusivo a la **Auditoría Forense**, con vista inmutable de todos los movimientos de stock realizados en la tienda.

### Usuario no autenticado (Público / Sin sesión)
- Si un usuario no ha iniciado sesión e intenta acceder a la Caja o a cualquier pantalla administrativa, el sistema lo redirigirá inmediatamente a la pantalla de **Inicio de Sesión**.

---

## 4. Módulo Caja / Punto de Venta (POS)

La pantalla de **Caja** está optimizada para realizar ventas rápidas en mostrador con el menor número de clics.

```text
┌────────────────────────────────────────────────────────┬──────────────────────────────────────────┐
│  CATÁLOGO RÁPIDO & BÚSQUEDA                            │  CARRITO DE VENTA                        │
│  [ Buscar por nombre o SKU... ]  ● Lector USB Activo   │  2 artículos                  [ Vaciar ] │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │  ┌────────────────────────────────────┐  │
│  │ Cuaderno F.F │ │ Lápiz Grafito│ │ Cartulina B. │   │  │ Cuaderno Forma Francesa            │  │
│  │ SKU: 750103..│ │ SKU: 750123..│ │ SKU: CART-01 │   │  │ 2 piezas x $35.00        $70.00 [x]│  │
│  │ $35.00  St:20│ │ $5.00   St:50│ │ $12.00  St:15│   │  └────────────────────────────────────┘  │
│  └──────────────┘ └──────────────┘ └──────────────┘   │  TOTAL: $70.00                           │
│                                                        │  [       COBRAR VENTA - $70.00        ]  │
└────────────────────────────────────────────────────────┴──────────────────────────────────────────┘
```

### Paso a paso para realizar una venta:

1. **Ingresar a Caja:** Una vez iniciada la sesión, se mostrará la interfaz principal de cobro.
2. **Buscar un producto:**
   - Puede escribir el nombre o código SKU en la barra superior *"Buscar por nombre o SKU..."*. El catálogo filtrará los resultados en tiempo real.
   - O bien, puede escanear directamente el código de barras con el lector USB.
3. **Agregar producto al carrito:**
   - Al hacer clic sobre la tarjeta de un producto en el catálogo, se añadirá al carrito con cantidad `1`.
   - Si utiliza el escáner, el producto se agregará de manera automática.
4. **Modificar cantidades:**
   - En la fila del artículo dentro del carrito, puede hacer clic en los botones **`+`** o **`-`** para incrementar o reducir piezas.
   - El botón **`-`** se deshabilita automáticamente cuando la cantidad es `1` (mínimo permitido por partida).
   - El botón **`+`** se deshabilita automáticamente cuando la cantidad alcanza el total de existencias físicas disponibles en tienda, mostrando la etiqueta *"Máx. disponible"*.
   - O puede hacer clic directamente en el campo numérico de cantidad y teclear la cifra entera deseada (ej. `2` o `5` piezas; el sistema exige valores enteros mayores o iguales a `1` con paso unitario y topa preventivamente el valor al stock disponible).
5. **Eliminar un producto del carrito:**
   - Haga clic en el botón con icono de papelera o **`✕`** al final del renglón del producto que desea quitar.
6. **Vaciar todo el carrito:**
   - Si el cliente cancela la compra antes de pagar, haga clic en el botón rojo **"Vaciar"** en la esquina superior del carrito.
7. **Revisar el total:**
   - El sistema calcula y actualiza automáticamente los subtotales por partida y el importe total a cobrar.
8. **Cobrar:**
   - Presione el botón principal **"Cobrar Venta - $[Total]"**.
9. **Confirmar venta:**
   - El sistema procesa la transacción atómicamente en la base de datos vía la RPC `process_stock_outlet`, descuenta el stock de inmediato, limpia el carrito y muestra una notificación en color verde con el folio asignado y el identificador de salida (ej. *"¡Venta Registrada Exitosamente! • ID Salida: [UUID]"* y folio secuencial `#...`).

---

## 5. Uso del Lector de Códigos de Barras USB

### Tipo de lector compatible
El sistema es compatible con cualquier **lector de código de barras USB estándar (1D o 2D)** configurado en modo **Emulación de Teclado (USB HID / Keyboard Wedge)**.

### Conexión y configuración
1. Conecte el cable USB del lector a un puerto libre de la computadora.
2. La computadora reconocerá el lector como si fuera un teclado externo estándar.
3. Verifique que el lector esté configurado para enviar un retorno de carro (**Enter**) al final de cada lectura (esta es la configuración de fábrica de casi todos los lectores).

### Cómo escanear durante la venta
- En la parte superior de la pantalla de Caja observará el indicador:
  **`● Lector USB Activo | <100ms`**
- Apunte el haz de luz del lector hacia el código de barras del producto y presione el gatillo.
- El sistema detectará la ráfaga de caracteres ultra-rápida (<100 milisegundos), localizará el producto en el catálogo y lo agregará al carrito.
- El indicador mostrará la etiqueta **`Último: [SKU]`** confirmando la lectura.

### Resiliencia de foco (No requiere hacer clic antes de escanear)
El lector funciona de manera **global e interactiva**:
- Puede escanear mientras tiene el cursor dentro de la caja de búsqueda de texto.
- Puede escanear mientras tiene el cursor sobre un botón.
- No es necesario que haga clic en un campo específico antes de disparar el lector; el sistema captura la lectura y mantiene la interfaz en orden sin alterar el texto que estuviera escribiendo manualmente.

---

## 6. Reglas de Cantidades Enteras y Control Preventivo de Existencias

El Punto de Venta opera bajo una política estricta de **cantidades enteras mayores o iguales a 1** (`>= 1`) y control preventivo de existencias para proteger la integridad del almacén y evitar quiebres de inventario.

### Reglas de captura de cantidades:
- **Mínimo permitido:** `1` unidad por renglón.
- **Unidades enteras:** Solo se admiten valores enteros (`1`, `2`, `3`, etc.). No se permiten cantidades decimales ni fraccionarias en mostrador.
- **Validación en interfaz:** El campo de cantidad cuenta con paso unitario (`step="1"`) y valor mínimo (`min="1"`).
- **Validación en servidor y base de datos:** Si se intenta registrar una cantidad decimal, negativa o cero, el servidor rechaza la transacción con un error HTTP 400 y preserva los artículos en el carrito junto con la clave de idempotencia para permitir la corrección inmediata sin pérdida de captura.

### Control preventivo de stock en mostrador:
1. **Productos Agotados:** Si un artículo cuenta con stock `<= 0`, su tarjeta en el catálogo muestra la etiqueta **`Agotado`** y queda bloqueada para su adición al carrito (tanto por clic como por lector USB).
2. **Alerta de Bajo Stock:** Si las existencias son menores o iguales al stock mínimo configurado (`stock <= min_stock`), se muestra un indicador visual en color ámbar de **`Bajo stock`**.
3. **Tope de Existencias en Carrito:** Al agregar o incrementar unidades de un producto, la cantidad queda topada a las existencias físicas disponibles. Al alcanzar dicho límite, el botón **`+`** se deshabilita y se muestra la leyenda **`Máx. disponible`**.

---

## 7. Proceso de Cobro y Manejo de Errores

### ¿Qué ocurre al presionar "Cobrar Venta"?
1. La aplicación envía la lista de productos al servidor junto con un identificador único de seguridad (**clave de idempotencia**).
2. El servidor consulta el precio oficial directamente de la base de datos (garantizando que el importe sea siempre el correcto).
3. Se verifica preventivamente que haya existencias físicas suficientes para cada artículo.
4. Se descuenta el stock en el inventario mediante la RPC atómica `process_stock_outlet`, se asigna el folio numérico oficial secuencial (`stock_outlets.folio`) y se genera el registro inmutable de VENTA en `inventory_logs`.

### Errores comunes y solución:

#### A. Stock insuficiente
- **Mensaje en pantalla:** *"Stock insuficiente para ID [Producto]. Disponible: X, Solicitado: Y"*.
- **Causa:** La cantidad que intenta vender supera las existencias físicas registradas en el catálogo.
- **Acción:** La venta **NO** se procesa y el carrito se mantiene con los productos seleccionados. Ajuste la cantidad al número real de piezas disponibles o retire el artículo del carrito antes de volver a presionar Cobrar.

#### B. Carrito vacío
- **Mensaje en pantalla:** *"El carrito de venta no contiene productos."*
- **Acción:** Seleccione al menos un producto antes de intentar cobrar.

#### C. Fallo temporal de conexión o doble clic
- Si la conexión a internet oscila en el momento exacto del cobro o presiona dos veces el botón, el sistema utiliza su mecanismo de **idempotencia**: no duplicará el cobro ni descontará existencias dos veces. La venta se registrará exactamente una vez.

---

## 8. Módulo Catálogo de Productos (Exclusivo Administrador)

Ubicación en el menú superior: **/admin/productos**

```text
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│  CATÁLOGO DE PRODUCTOS (ADMINISTRACIÓN)                             [ + Nuevo Producto ]          │
│  [ Buscar por nombre o SKU...                                    ]                                │
├───────────────┬──────────────────────────┬──────────┬──────────┬──────────┬───────────┬───────────┤
│ SKU           │ Nombre                   │ Precio   │ Costo    │ Stock    │ Mínimo    │ Acciones  │
├───────────────┼──────────────────────────┼──────────┼──────────┼──────────┼───────────┼───────────┤
│ 7501031311309 │ Cuaderno Profesional 100h│ $35.00   │ $22.50   │ 45.000   │ 10.000    │ [Editar]  │
│ 7501234567890 │ Lápiz Grafito HB #2      │ $5.00    │ $2.10    │ 120.000  │ 20.000    │ [Desact.] │
└───────────────┴──────────────────────────┴──────────┴──────────┴──────────┴───────────┴───────────┘
```

### Consultar y buscar productos
- Ingrese un término en la barra de búsqueda para filtrar instantáneamente por nombre o código SKU.
- Los productos con existencias por debajo del stock mínimo mostrarán un indicador visual de alerta preventiva.

### Crear un nuevo producto
1. Haga clic en el botón **"+ Nuevo Producto"**.
2. Complete los campos del formulario modal:
   - **SKU / Código de Barras:** Código alfanumérico único (puede leerlo directamente con el escáner USB).
   - **Nombre del Producto:** Nombre comercial descriptivo.
   - **Descripción:** Detalles adicionales (opcional).
   - **Precio de Venta:** Precio al público (mayor o igual a 0).
   - **Costo de Compra:** Costo unitario de adquisición para cálculo administrativo de margen (mayor o igual a 0).
   - **Stock Actual:** Cantidad física inicial disponible (entero o decimal en inventario base).
   - **Stock Mínimo de Alerta:** Cantidad límite para aviso de reabastecimiento (por defecto 5).
   - **URL de Imagen:** Enlace a fotografía del producto (opcional).
3. Presione **"Guardar Producto"** (o **"Guardar Cambios"** si edita un artículo existente).

### Editar un producto existente
1. Localice el producto en la tabla y presione el botón **"Editar"**.
2. Modifique los campos necesarios (ej. actualizar precio de venta, costo o existencia física).
3. Presione **"Guardar Cambios"**. Los cambios se aplicarán de inmediato vía la RPC `upsert_product_with_cost`.

### Protección de cambios pendientes en modal
- Si el Administrador realiza modificaciones en el formulario y presiona la tecla `Escape` o hace clic en el fondo oscuro accidentalmente, el sistema detecta el estado con cambios pendientes (*dirty state*) y solicita confirmación antes de descartar la captura:
  > *"Tiene cambios sin guardar. ¿Está seguro de que desea cerrar sin guardar?"*

### Exportación de catálogo a CSV
- En la barra superior de `/admin/productos`, el Administrador dispone del botón **"Exportar a Excel (CSV)"**.
- Al hacer clic, se descarga inmediatamente un archivo `.csv` con todos los productos activos.
- El archivo incluye prefijo UTF-8 BOM (`\uFEFF`) para garantizar la correcta visualización de caracteres especiales y acentos en Microsoft Excel.
- Columnas incluidas: `SKU`, `Nombre`, `Descripción`, `Precio de Venta`, `Stock Actual`, `Stock Mínimo`, `Estado`.
- **Confidencialidad:** Por política de seguridad, los costos de compra (`product_costs`) quedan estrictamente excluidos del archivo exportado.

### Desactivar un producto (Soft Delete)
- Para retirar un producto descontinuado o agotado sin dañar el historial de ventas pasadas, haga clic en el botón **"Desactivar"**.
- El sistema solicitará confirmación mediante diálogo nativo.
- El producto cambiará su estado a inactivo (`is_active = false`) y **dejará de aparecer en la pantalla de Caja del cajero**.
- **Nota importante:** El sistema no elimina físicamente los registros de la base de datos para preservar la trazabilidad contable y auditora.

---

## 9. Gestión Confidencial de Costos de Compra

- Los costos de adquisición registrados en cada producto representan información financiera confidencial del negocio.
- **Acceso protegido:** Únicamente los usuarios con rol de **Administrador** pueden visualizar la columna de costos y modificar su valor dentro del modal de producto.
- Los cajeros nunca verán los costos en su pantalla ni podrán deducir los márgenes comerciales desde la terminal de ventas.

---

## 10. Módulo Historial de Ventas (Exclusivo Administrador)

Ubicación en el menú superior: **/admin/historial**

```text
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│  HISTORIAL DE VENTAS Y DEVOLUCIONES                                                               │
│  Métricas: [Total: 25] [Válidas: 23] [Ingresos Válidos: $1,450.00] [Canceladas: 2]               │
│  Filtros: [Fecha: AAAA-MM-DD] [Desde: ... ] [Hasta: ... ] [ Hoy ] [ Buscar por folio, ID... ]     │
├───────────────┬──────────────────────────┬──────────────┬──────────────┬──────────────┬───────────┤
│ Folio / ID    │ Fecha y Hora             │ Artículos    │ Total Venta  │ Estado       │ Acciones  │
├───────────────┼──────────────────────────┼──────────────┼──────────────┼──────────────┼───────────┤
│ #21           │ 30/08/2026 14:22:10      │ 1 producto   │ $25.00       │ ● Activa     │ [Ver Art.]│
│ c11ced8d...   │                          │              │              │              │ [Devoluc.]│
│ #20           │ 30/08/2026 13:10:05      │ 2 productos  │ $45.00       │ ✕ Cancelada  │ [Ver Art.]│
└───────────────┴──────────────────────────┴──────────────┴──────────────┴──────────────┴───────────┘
```

### Funciones disponibles:
- **Tarjetas de métricas:** Muestra en tiempo real el total de ventas registradas, ventas activas válidas, ingresos consolidados de ventas válidas (excluyendo automáticamente canceladas) y número de cancelaciones.
- **Filtros temporales:** Permite filtrar ventas por fecha específica, rango desde/hasta, o el acceso rápido del día en curso mediante el botón **"Hoy"**.
- **Buscador global:** Permite localizar ventas al instante tecleando el número de folio (ej. `21`), identificador UUID, motivo de cancelación o SKU/nombre de producto contenido.
- **Estado de la venta:**
  - **Activa (Verde):** Venta completada legalmente.
  - **Cancelada (Rojo):** Venta anulada por devolución. Muestra el motivo registrado y fecha de cancelación.
- **Ver artículos:** Al hacer clic en **"Ver Artículos"**, se abre el modal de detalle con el desglose de cada producto vendido, código SKU, cantidad y subtotal, además del folio oficial.

---

## 11. Proceso de Devolución / Cancelación de Venta

Cuando un cliente solicita la devolución de mercancía o se requiere anular una venta errónea, el Administrador debe seguir estos pasos:

1. Ingrese a **/admin/historial**.
2. Localice la venta por su número de folio oficial (ej. `#21`) o código UUID.
3. En la fila de la venta, haga clic en el botón **"Devolución"** (o bien examine primero sus partidas presionando **"Ver Artículos"**).
4. Se abrirá la ventana modal **"Solicitar Devolución / Cancelación"**, donde se indica el folio y el importe a reembolsar. Ingrese obligatoriamente el motivo de la devolución en el campo de texto (ej. *"Devolución de mercancía por cliente"* o *"Corrección de cobro"*).
5. Haga clic en **"Confirmar Devolución"**.
6. **Resultado automático del sistema:**
   - La venta queda marcada como **Cancelada / Devuelta**.
   - Las cantidades de todos los artículos incluidos en la venta se **reintegran atómicamente al stock disponible** en el inventario vía la RPC `cancel_stock_outlet`.
   - Se crea un registro de tipo **`DEVOLUCION`** en la bitácora de auditoría (`inventory_logs`).
7. **Regla de seguridad:** Una venta ya cancelada queda bloqueada permanentemente; el sistema no permite cancelarla por segunda vez.

---

## 12. Módulo de Auditoría Forense (Exclusivo Administrador)

Ubicación en el menú superior: **/admin/auditoria**

```text
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│  BITÁCORA FORENSE DE INVENTARIO                                                                   │
│  Filtro: [ Todos ▼ ]  Buscar: [ Buscar por producto, SKU, folio...                              ] │
├─────────────────────┬──────────────┬────────────────────────┬─────────┬─────────┬────────┬────────┤
│ Fecha y Hora        │ Movimiento   │ Producto / SKU         │ Previo  │ Nuevo   │ Cambio │ Ref.   │
├─────────────────────┼──────────────┼────────────────────────┼─────────┼─────────┼────────┼────────┤
│ 30/08/2026 14:25:00 │ DEVOLUCION   │ Cuaderno Prof. (750..) │ 43.000  │ 45.000  │ +2.000 │ #00104 │
│ 30/08/2026 14:22:10 │ VENTA        │ Cuaderno Prof. (750..) │ 45.000  │ 43.000  │ -2.000 │ #00104 │
│ 30/08/2026 10:00:15 │ REABASTECIM. │ Lápiz Grafito (7501..) │ 20.000  │ 120.000 │+100.000│ Manual │
└─────────────────────┴──────────────┴────────────────────────┴─────────┴─────────┴────────┴────────┘
```

### Propósito y características:
- La pantalla de auditoría es una **consulta inalterable y de solo lectura**. Ningún usuario puede editar, borrar o alterar los registros mostrados.
- Cada fila representa un movimiento físico de inventario disparado por una venta, devolución o ajuste manual en catálogo.

### Tipos de movimiento:
- **`VENTA`:** Descuento automático de existencias por cobro en caja.
- **`DEVOLUCION`:** Incremento automático de existencias por cancelación autorizada de venta.
- **`REABASTECIMIENTO`:** Entrada manual de mercancía registrada al editar un producto en el catálogo aumentando su stock.
- **`AJUSTE_MANUAL`:** Reducción manual de existencias registrada desde el catálogo.
- **`MERMA`:** Registro por pérdida o daño de mercancía.

### Filtros y búsqueda:
- Puede filtrar por tipo de movimiento específico utilizando el selector desplegable.
- Puede escribir en el buscador para filtrar por nombre de producto, SKU o código de folio.

---

## 13. Solución a Situaciones Frecuentes (FAQ)

### 1. No puedo iniciar sesión
- **Causa:** Correo o contraseña mal escritos, o usuario inactivo.
- **Solución:** Verifique mayúsculas y minúsculas. Si olvidó su clave, solicite al Administrador del sistema el restablecimiento de su cuenta.

### 2. Soy cajero y no puedo entrar a Productos, Historial o Auditoría
- **Causa:** El sistema aplica control estricto de roles.
- **Solución:** Estas secciones son exclusivas para Administradores. El sistema redirige automáticamente al cajero a la pantalla de Caja.

### 3. El escáner USB no agrega el producto al disparar
- **Causa 1:** El lector no está enviando la tecla `Enter` al final.
- **Solución 1:** Consulte la guía rápida del fabricante del escáner y lea el código de barras de configuración *"Suffix: Add Enter / CR"*.
- **Causa 2:** El producto no está registrado o su código SKU no coincide exactamente.
- **Solución 2:** Busque el producto manualmente por nombre en el catálogo para comprobar que esté dado de alta y activo.

### 4. Un producto no aparece en la terminal de Caja
- **Causa:** El producto fue desactivado (**Soft Delete**).
- **Solución:** Solicite al Administrador ingresar a `/admin/productos`, buscar el artículo y verificar si está activo.

### 5. Aparece error de stock insuficiente al cobrar
- **Causa:** La cantidad solicitada en el carrito supera las existencias físicas registradas en el sistema.
- **Solución:** Verifique el inventario físico en tienda. Si hay mercancía física que no está registrada en el sistema, el Administrador debe actualizar el stock en el catálogo antes de cobrar.

### 6. La pantalla mostró un error de red durante el cobro
- **Solución:** Vuelva a presionar el botón **"Cobrar Venta"**. Gracias al sistema de idempotencia, el cobro se completará de forma segura sin duplicar el cobro ni descontar dos veces la mercancía.

### 7. No puedo cancelar una venta en el Historial
- **Causa 1:** No tiene sesión de Administrador.
- **Solución 1:** Solo los administradores pueden autorizar devoluciones.
- **Causa 2:** La venta ya fue cancelada previamente.
- **Solución 2:** Las ventas canceladas muestran el estado "Cancelada" y no admiten cancelaciones adicionales.

---

## 14. Ejemplo de Flujo Completo: Turno de Cajero

1. **8:00 AM — Ingreso:** El cajero abre el navegador, entra a `/login`, escribe `cajero@papeleria.com` con su contraseña y presiona *"Iniciar Sesión"*. El sistema lo sitúa en `/caja`.
2. **8:05 AM — Verificación de escáner:** Conecta el lector USB y verifica que la pantalla muestre el indicador verde `● Lector USB Activo`.
3. **8:15 AM — Atención a cliente:**
   - Escanea con el lector un cuaderno (`7501031311309`). El producto aparece en el carrito con cantidad `1` y subtotal `$35.00`.
   - El cliente solicita además 2 pliegos de papel kraft. El cajero busca *"kraft"* en la barra, hace clic en el producto en el catálogo (mostrando existencias disponibles), pulsa el botón **`+`** para incrementar a `2` piezas y el subtotal se actualiza a `$24.00`.
4. **8:16 AM — Cobro:** El cajero revisa el total de `$59.00` y hace clic en **"Cobrar Venta ($59.00)"**.
5. **8:16 AM — Finalización:** El sistema emite la notificación verde de confirmación con el folio oficial asignado (ej. *"¡Venta Registrada Exitosamente! • ID Salida: [UUID]"* y folio secuencial en base de datos), limpia el carrito y queda listo para el siguiente cliente.

---

## 15. Ejemplo de Flujo Completo: Gestión de Administrador

1. **9:00 AM — Ingreso:** El administrador inicia sesión con su cuenta `admin@papeleria.com`.
2. **9:10 AM — Alta de mercancía nueva:** Entra a `/admin/productos`, presiona **"+ Nuevo Producto"**, escanea el código de una caja de plumones, ingresa el nombre, precio de venta `$120.00`, costo de compra `$75.00`, stock inicial `24` piezas y guarda.
3. **11:30 AM — Procesamiento de devolución:** Un cliente regresa a cambiar un artículo. El administrador entra a **/admin/historial**, localiza el folio de la venta, presiona el botón **"Devolución"**, escribe el motivo *"Cliente solicitó cambio de mercancía"* y confirma. El stock se reintegra automáticamente vía `cancel_stock_outlet`.
4. **11:35 AM — Verificación contable:** Entra a `/admin/auditoria` y comprueba que la devolución aparece registrada con fecha, hora exacta, usuario responsable y el ajuste de inventario correspondiente (`DEVOLUCION`).

---

## 16. Buenas Prácticas de Operación

- **Verifique el carrito antes de cobrar:** Confirme con el cliente el número de piezas y el importe total mostrado en pantalla antes de presionar el botón de cobro.
- **Registre motivos claros en devoluciones:** Al cancelar una venta, escriba siempre la causa real (ej. *"Producto dañado"*, *"Error de cobro"*, *"Devolución de cliente"*); esto facilitará la conciliación en la bitácora de auditoría.
- **Mantenga la confidencialidad de sus claves:** No comparta su cuenta ni deje su sesión abierta en equipos desatendidos.
- **Cuide el equipo de escaneo:** Asegúrese de que el cable del lector USB no sufra tirones y que el cristal óptico se mantenga limpio para evitar lecturas fallidas.

---

## 17. Limitaciones Operativas Conocidas y Entorno de Ejecución

1. **Lectores compatibles:** La aplicación está diseñada para lectores USB configurados en emulación de teclado (HID). No se admiten lectores conectados por puerto serial virtual o emulación COM.
2. **Navegador recomendado:** La interfaz y el flujo de venta han sido validados exhaustivamente para **Google Chrome / Chromium**. Se recomienda utilizar este navegador en las terminales de cobro.
3. **Arquitectura Local y Operación Offline:** El sistema opera de manera 100% autónoma sobre PostgreSQL 15 local (puerto 5433 en contenedor Docker / servidor de red local) mediante el pool de conexiones nativo de Node.js y autenticación por cookies de sesión HTTP-only seguras. No requiere conexión a internet ni servicios en la nube para procesar ventas, consultar catálogos ni auditar inventarios.
