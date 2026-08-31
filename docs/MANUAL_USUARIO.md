# Manual de Usuario — Sistema de Punto de Venta e Inventario

---

## 1. ¿Qué es el sistema?

El **Sistema de Punto de Venta e Inventario** es una aplicación web diseñada para agilizar las operaciones diarias en papelerías y comercios minoristas.

Permite registrar ventas rápidas en mostrador mediante lectores de códigos de barras USB, gestionar artículos vendidos por pieza o por fracción (por ejemplo, metros de papel o listón), controlar las existencias de mercancía en tiempo real, procesar devoluciones y llevar un registro inmutable de auditoría para la supervisión administrativa.

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
- Agregado, modificación de cantidades y eliminación de artículos en el carrito.
- Cobro transaccional de ventas y generación de folios.
- Consulta de existencias y precios de venta al público.
- **Restricciones:** No tiene acceso a los costos de compra ni a los módulos administrativos (`/admin/*`). Si un cajero intenta ingresar a una sección administrativa, el sistema lo devolverá automáticamente a la pantalla de Caja.

### Administrador
- Acceso completo a la terminal de ventas (**Caja / POS**).
- Acceso exclusivo al catálogo de **Productos**, con facultad para crear, editar, fijar precios de venta, consultar/actualizar costos de adquisición confidenciales y desactivar artículos obsoletos (**Soft Delete**).
- Acceso exclusivo al **Historial de Ventas**, con facultad para revisar ventas pasadas y procesar **Cancelaciones / Devoluciones** que restauran el inventario.
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
   - O puede hacer clic directamente en el campo numérico de cantidad y teclear la cifra deseada (ej. `3` piezas o `1.500` metros).
5. **Eliminar un producto del carrito:**
   - Haga clic en el botón con icono de papelera o **`✕`** al final del renglón del producto que desea quitar.
6. **Vaciar todo el carrito:**
   - Si el cliente cancela la compra antes de pagar, haga clic en el botón rojo **"Vaciar"** en la esquina superior del carrito.
7. **Revisar el total:**
   - El sistema calcula y actualiza automáticamente los subtotales por partida y el importe total a cobrar.
8. **Cobrar:**
   - Presione el botón principal **"Cobrar Venta - $[Total]"**.
9. **Confirmar venta:**
   - El sistema procesa la transacción en la base de datos, descuenta el stock de inmediato, limpia el carrito y muestra una notificación en color verde con el folio asignado (ej. *"Venta #104 registrada con éxito"*).

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

## 6. Manejo de Cantidades Fraccionadas

La papelería maneja productos que no se venden por pieza entera, sino por fracciones métricas o decimales (papel por metro, listones, hule cristal, cartulinas fraccionadas, etc.).

### Reglas de captura fraccionada:
- El sistema admite hasta **tres decimales** de precisión (`NUMERIC(10,3)`).
- Ejemplos de uso común:
  - **`1`** = 1 pieza / 1 unidad completa.
  - **`2.500`** = 2 metros y medio de listón.
  - **`0.750`** = Tres cuartos de metro (75 centímetros).
  - **`0.250`** = Un cuarto de metro (25 centímetros).

### Cómo registrar una fracción:
1. Agregue el producto al carrito (ej. "Listón Satinado Azul").
2. Haga clic sobre la caja de cantidad del artículo en el carrito.
3. Escriba `2.5` y presione Enter o haga clic fuera.
4. El sistema calculará el subtotal exacto multiplicando el precio unitario oficial por la fracción ingresada (ej. $10.00 x 2.5 = $25.00).

---

## 7. Proceso de Cobro y Manejo de Errores

### ¿Qué ocurre al presionar "Cobrar Venta"?
1. La aplicación envía la lista de productos al servidor junto con un identificador único de seguridad (**clave de idempotencia**).
2. El servidor consulta el precio oficial directamente de la base de datos (garantizando que el importe sea siempre el correcto).
3. Se verifica que haya existencias físicas suficientes para cada artículo.
4. Se descuenta el stock en el inventario, se guarda el folio de venta y se genera el registro en la bitácora de auditoría.

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
   - **Stock Actual:** Cantidad física inicial disponible (admite decimales).
   - **Stock Mínimo de Alerta:** Cantidad límite para aviso de reabastecimiento (por defecto 5).
   - **URL de Imagen:** Enlace a fotografía del producto (opcional).
3. Presione **"Guardar Producto"**.

### Editar un producto existente
1. Localice el producto en la tabla y presione el botón **"Editar"**.
2. Modifique los campos necesarios (ej. actualizar precio de venta, costo o existencia física).
3. Presione **"Guardar Producto"**. Los cambios se aplicarán de inmediato.

### Desactivar un producto (Soft Delete)
- Para retirar un producto descontinuado o agotado sin dañar el historial de ventas pasadas, haga clic en el botón **"Desactivar"**.
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
│  HISTORIAL DE SALIDAS Y VENTAS                                                                    │
├─────────┬──────────────────────────┬──────────────┬──────────────┬──────────────┬─────────────────┤
│ Folio   │ Fecha y Hora             │ Cajero       │ Total Venta  │ Estado       │ Acciones        │
├─────────┼──────────────────────────┼──────────────┼──────────────┼──────────────┼─────────────────┤
│ #000104 │ 30/08/2026 14:22:10      │ cajero@...   │ $150.00      │ ● Activa     │ [Ver Detalle]   │
│ #000103 │ 30/08/2026 13:10:05      │ admin@...    │ $45.00       │ ✕ Cancelada  │ [Ver Detalle]   │
└─────────┴──────────────────────────┴──────────────┴──────────────┴──────────────┴─────────────────┤
```

### Funciones disponibles:
- **Consulta cronológica:** Muestra las ventas ordenadas desde la más reciente hasta la más antigua.
- **Estado de la venta:**
  - **Activa (Verde):** Venta completada legalmente.
  - **Cancelada (Rojo/Gris):** Venta anulada por devolución. Muestra la fecha de cancelación y el motivo registrado.
- **Ver detalle:** Al hacer clic en **"Ver Detalle"**, se abre una ventana modal con el desglose de cada artículo vendido, código SKU, cantidad y subtotal.

---

## 11. Proceso de Devolución / Cancelación de Venta

Cuando un cliente solicita la devolución de mercancía o se requiere anular una venta errónea, el Administrador debe seguir estos pasos:

1. Ingrese a **/admin/historial**.
2. Localice la venta por su número de folio o fecha y haga clic en **"Ver Detalle"**.
3. En la parte inferior del modal de detalle, haga clic en el botón rojo **"Cancelar Venta / Devolución"**.
4. Se abrirá una ventana de confirmación donde es **obligatorio escribir el motivo** de la devolución (mínimo 3 caracteres, por ejemplo: *"Cliente devolvió mercancía defectuosa"* o *"Error en captura de cantidad"*).
5. Haga clic en **"Confirmar Devolución"**.
6. **Resultado automático del sistema:**
   - La venta queda marcada como **Cancelada**.
   - Las cantidades de todos los artículos incluidos en la venta se **suman nuevamente al stock disponible** en el inventario de forma automática.
   - Se crea un registro de tipo **`DEVOLUCION`** en la bitácora de auditoría.
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
   - El cliente pide `1.5` metros de papel kraft. El cajero busca *"kraft"* en la barra, hace clic en el producto, edita la cantidad en el carrito a `1.5` y el subtotal se ajusta a `$18.00`.
4. **8:16 AM — Cobro:** El cajero revisa el total de `$53.00` y hace clic en **"Cobrar Venta - $53.00"**.
5. **8:16 AM — Finalización:** El sistema emite el mensaje verde *"Venta #000105 registrada con éxito"*, limpia el carrito y queda listo para el siguiente cliente.

---

## 15. Ejemplo de Flujo Completo: Gestión de Administrador

1. **9:00 AM — Ingreso:** El administrador inicia sesión con su cuenta `admin@papeleria.com`.
2. **9:10 AM — Alta de mercancía nueva:** Entra a `/admin/productos`, presiona **"+ Nuevo Producto"**, escanea el código de una caja de plumones, ingresa el nombre, precio de venta `$120.00`, costo de compra `$75.00`, stock inicial `24` piezas y guarda.
3. **11:30 AM — Procesamiento de devolución:** Un cliente regresa a cambiar un artículo. El administrador entra a `/admin/historial`, abre el detalle del folio `#000105`, presiona *"Cancelar Venta / Devolución"*, escribe el motivo *"Cliente solicitó cambio de mercancía"* y confirma. El stock se reintegra automáticamente.
4. **11:35 AM — Verificación contable:** Entra a `/admin/auditoria` y comprueba que la devolución aparece registrada con fecha, hora exacta, usuario responsable y el ajuste de inventario correspondiente.

---

## 16. Buenas Prácticas de Operación

- **Verifique el carrito antes de cobrar:** Confirme con el cliente el número de piezas y el importe total mostrado en pantalla antes de presionar el botón de cobro.
- **Registre motivos claros en devoluciones:** Al cancelar una venta, escriba siempre la causa real (ej. *"Producto dañado"*, *"Error de cobro"*, *"Devolución de cliente"*); esto facilitará la conciliación en la bitácora de auditoría.
- **Mantenga la confidencialidad de sus claves:** No comparta su cuenta ni deje su sesión abierta en equipos desatendidos.
- **Cuide el equipo de escaneo:** Asegúrese de que el cable del lector USB no sufra tirones y que el cristal óptico se mantenga limpio para evitar lecturas fallidas.

---

## 17. Limitaciones Operativas Conocidas

1. **Lectores compatibles:** La aplicación está diseñada para lectores USB configurados en emulación de teclado (HID). No se admiten lectores conectados por puerto serial virtual o emulación COM.
2. **Navegador recomendado:** La interfaz y el flujo de venta han sido validados exhaustivamente para **Google Chrome / Chromium**. Se recomienda utilizar este navegador en las terminales de cobro.
3. **Conectividad a la nube:** El sistema opera enlazado a la base de datos central en la nube; se requiere conexión a internet o red local activa para procesar transacciones y consultar catálogos.
