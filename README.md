# Plataforma Excavadora IoT · CONTROL + MONITOREO (GitHub Pages)

Frontend de la plataforma IoT (Implementación de soluciones IoT): **CONTROL** (práctica 4.1) y **MONITOREO en tiempo real** (práctica 4.2) en el mismo sitio y repositorio.
Es solo el frontend: consume la API FastAPI ya desplegada en AWS ([vehiculo-iot-api](https://github.com/Moy-Gz04/vehiculo-iot-api)) por HTTPS y su canal WebSocket por WSS. No hay backend nuevo ni acceso a MySQL desde el navegador.

- **Página publicada:** https://moy-gz04.github.io/vehiculo-iot-control/ → `#/control` y `#/monitoreo`
- **Copia servida desde el EC2:** https://13-218-5-111.sslip.io/plataforma/ (mismo código, mismo origen que la API)
- **API:** https://13-218-5-111.sslip.io (Swagger en `/docs`)
- **Versión 4.1 respaldada:** etiqueta `v4.1`

## Ampliación 4.2 · MONITOREO

CONTROL se conserva completo (RC, gamepad, joystick, voz, DETENER, DEMO, indicadores, favicon y créditos). Se agregó:

- **Navegación** `CONTROL | MONITOREO` en la cabecera (y un botón *Monitoreo* en la barra del control, útil con el control girado). Rutas con hash: funcionan en la subruta de GitHub Pages, no recargan la página y respetan «atrás». Al salir de CONTROL se suelta el gamepad y, si el joystick estaba en uso, se envía **DETENER**.
- **Tarjeta «Último movimiento»**: nombre, icono, vehículo, fecha y hora reales; código, id del comando, origen y modo cuando el contrato los trae; etiqueta de **fuente** (REST estado RDS · WSS movimiento · WSS paso de DEMO · WSS estado al conectar) y de **procesamiento** (*verificando registro* → *Registrado en el historial de RDS · #id*). Aclara siempre que es lo **reportado**, no lo ejecutado físicamente. Si el WSS se cae, el valor se etiqueta como «último valor conocido».
- **Tabla «Últimos 10 movimientos»** (`#`, Movimiento, Fecha, Hora y, desde tableta, Registro `#id_historial` + origen): solo registros **persistidos** devueltos por `GET /historial`; máximo 10, del más nuevo al más antiguo; estados *Cargando*, *Sin movimientos* y *Error* con *Reintentar*. Las filas nuevas se resaltan. Quitar una fila de la pantalla no borra nada en RDS.
- **Conectividad**: los mismos tres indicadores de la cabecera, en tarjetas con el detalle de cada comprobación, y el botón **Probar reconexión WSS** (Prueba D).
- **Bitácora de sincronización**: registra con hora (ms) cada evento WSS, cada GET con su código, duración e ids, y la correlación *evento ↔ registro #id* (también sale en la consola como `[MONITOREO …]`).

### Flujo REST + WSS

```
GitHub Pages (CONTROL + MONITOREO)
   │  HTTPS/Fetch: GET /vehiculos, /estado, /historial, /salud, /salud/rds · POST de control
   │  WSS: una sola conexión por pestaña, compartida por ambas vistas
   ▼
FastAPI en EC2 (Caddy HTTPS/WSS) ──► Amazon RDS MySQL (vehiculo_iot, procedimientos almacenados)
```

1. **Carga inicial (REST):** al elegir vehículo / abrir MONITOREO → `GET /vehiculos/{id}/estado` y `GET /vehiculos/{id}/historial` en paralelo.
2. **Tiempo real (WSS):** un evento `movimiento` actualiza la tarjeta al instante y **dispara** una sincronización del historial por REST (sin polling). Varios eventos seguidos (joystick) se agrupan en una sola consulta.
3. **Confirmación:** el evento se correlaciona con el registro de RDS (mismo comando y origen, ±5 s). Si aún no aparece, se consulta **una** vez más (1.5 s); si sigue sin aparecer, se indica.
4. **Recuperación:** al reconectar el WSS, al volver a MONITOREO o con *Actualizar*, se vuelve a consultar estado e historial.
5. **DEMO:** `demo_inicio`, `demo_movimiento` (paso n/N) y `demo_fin` / `demo_cancelada` / `demo_error` actualizan la tarjeta y una cinta de progreso, **sin** tocar la tabla. Al terminar se consulta el historial y la bitácora confirma que no cambió (el backend nunca llama a `sp_registrar_historial` en una DEMO).

### Reglas de consistencia

| Riesgo | Cómo se evita |
|---|---|
| Respuesta REST vieja pisa un evento WSS | La tarjeta guarda una *versión WSS*: si llegó un evento mientras la petición estaba en curso, el estado REST se descarta. Además, nunca se reemplaza un dato por otro con marca temporal más antigua. |
| Solicitudes concurrentes / fuera de orden | Una sola sincronización a la vez; las que llegan durante una en curso se agrupan en la siguiente. Cada ciclo lleva número de generación y `AbortController`: al cambiar de vehículo, lo anterior se aborta y se descarta. |
| Eventos duplicados | Clave `evento + timestamp + id_comando`; los repetidos se ignoran. |
| Eventos de otro vehículo | Se valida `id_vehiculo`; se ignoran y se anotan en la bitácora. |
| Filas duplicadas o desordenadas | La tabla se construye solo con la respuesta de la API: sin duplicados por `id_historial`, ordenada por `fecha_hora` y luego `id_historial`, máximo 10. |
| Datos no confiables | Se valida el esquema de cada respuesta y evento, y todo texto se escapa antes de insertarse en el DOM. |

### Fecha y hora

`fecha_hora` y `fecha_actualizacion` llegan de RDS **sin zona** (`2026-11-11T18:43:32`) y están en **UTC** (zona por defecto de Amazon RDS; comprobado: un vehículo creado a las 14:04 hora de México quedó con `fecha_registro` `20:04:11`). Los eventos WSS traen ISO con `+00:00`. Todo se muestra en **America/Mexico_City** y la tarjeta y la tabla indican la zona. Si un dato falta se muestra «Sin dato»; nunca se inventa una marca temporal.

## Estructura

```
vehiculo-iot-control/
├── index.html                    Cabecera (navegación + 3 indicadores), vistas CONTROL y MONITOREO, pie con créditos
├── assets/
│   ├── css/
│   │   ├── app.css               Estilos de CONTROL (4.1)
│   │   └── monitoreo.css         Navegación, MONITOREO (Mobile First) y convivencia con Bootstrap 5
│   └── js/                       Módulos ES6 (type="module")
│       ├── app.js                Punto de entrada: navegación, indicadores, MONITOREO y CONTROL
│       ├── config.js             Configuración compartida: API, WSS, X-API-Key de control, zonas horarias, límites
│       ├── servicios/
│       │   ├── api.js            Cliente REST (Fetch + async/await, timeout, errores) y rutas reales de la API
│       │   ├── socket.js         WebSocket ÚNICO compartido: estados, reconexión progresiva, suscripciones
│       │   └── conectividad.js   Indicadores WSS / API AWS / RDS
│       ├── estado/
│       │   └── vehiculo.js       Vehículo seleccionado (compartido por las dos vistas)
│       ├── vistas/
│       │   ├── navegacion.js     Rutas #/control y #/monitoreo
│       │   ├── control.js        Vista CONTROL (lógica de 4.1, ahora sobre api.js y socket.js)
│       │   └── monitoreo.js      Vista MONITOREO: eventos WSS, correlación y disparo de la sincronización
│       ├── monitoreo/
│       │   ├── ultimo-movimiento.js  Tarjeta del último movimiento
│       │   ├── historial.js          Tabla de 10 movimientos
│       │   ├── sincronizacion.js     Sincronización REST con control de concurrencia
│       │   └── bitacora.js           Bitácora de evidencias
│       └── utilidades/
│           ├── dom.js            $, escape de HTML, avisos, almacenamiento
│           ├── fechas.js         Normalización y formato de fecha/hora
│           └── validacion.js     Validación de eventos y respuestas (contratos reales)
├── .nojekyll
└── README.md
```

## Contratos de AWS usados por MONITOREO

| Uso | Contrato real |
|---|---|
| Último estado | `GET /vehiculos/{id}/estado` → `{ id_vehiculo, vehiculo, id_comando, comando, codigo, conectado, fecha_actualizacion }` · 404 si aún no hay estado |
| Historial | `GET /vehiculos/{id}/historial` → `{ id_vehiculo, limite: 10, total_devueltos, movimientos: [{ id_historial, id_vehiculo, comando, codigo, fecha_hora, origen }] }`, del más reciente al más antiguo, **sin** movimientos de DEMO (`sp_obtener_historial`) |
| Salud API | `GET /salud` → `{ api: "disponible", servicios, timestamp }` |
| Diagnóstico RDS | `GET /salud/rds` → `{ rds: "disponible", latencia_ms }` o **503** `{ rds: "no disponible" }` (el backend ejecuta `SELECT 1`) |
| WebSocket | `wss://13-218-5-111.sslip.io/ws/vehiculos/{id}`; todos los mensajes: `{ evento, id_vehiculo, …, timestamp }` |
| Eventos | `estado_actual` (al conectar, con `fecha_actualizacion` y `demo_en_curso`) · `movimiento` (después del commit de estado + historial; `id_comando, comando, codigo, origen, modo`) · `soltar` / `mantener` (no se guardan) · `demo_inicio`, `demo_movimiento` (`numero, total_movimientos, comando, duracion_ms…`), `demo_fin`, `demo_cancelada`, `demo_error` · `error` · `pong` |

Ejemplo real de `movimiento` (prueba del 2026-11-13):

```json
{"evento":"movimiento","id_vehiculo":1,"id_comando":4,"comando":"GIRAR_DERECHA","codigo":4,"origen":"WEB-CONTROL","modo":"continuo","timestamp":"2026-11-13T15:25:33.211…+00:00"}
```

Se correlacionó con el registro `#3869` del historial (`fecha_hora` 2026-11-13T15:25:33).

Los GET de MONITOREO no requieren clave. El socket no pide autenticación para escuchar; para **mover** por el socket exige la `X-API-Key` dentro del mensaje (igual que los POST).

## Cómo comprobar MONITOREO

| Prueba | Pasos | Qué se debe ver |
|---|---|---|
| A · Carga inicial | DevTools → Network → abrir `#/monitoreo` | `GET …/estado` y `GET …/historial` (200), tarjeta con fecha/hora, 10 filas ordenadas. Con un vehículo sin movimientos: «Sin movimientos». |
| B · Evento en vivo | Conectar un cliente WSS externo (Postman o extensión de Chrome) a `wss://13-218-5-111.sslip.io/ws/vehiculos/1`; desde CONTROL enviar AVANZAR, GIRAR DERECHA y DETENER | El cliente externo recibe los 3 `movimiento`; MONITOREO cambia la tarjeta al instante y la tabla se sincroniza sin recargar (bitácora: evento ↔ `#id`). |
| C · Origen externo y límite | Mandar más de 10 comandos desde otra pestaña o el celular | MONITOREO se actualiza solo; la tabla siempre tiene 10 filas, sin duplicados, la más nueva arriba. |
| D · Reconexión | *Probar reconexión WSS*, o DevTools → Network → Offline y volver | WSS: Desconectado → Reconectando → En línea; la bitácora muestra la nueva carga REST. API y RDS se comprueban aparte (`/salud`, `/salud/rds`). |
| E · DEMO | CONTROL → DEMO → Iniciar | Tarjeta y cinta «paso n/N»; la tabla no cambia y la bitácora lo confirma. Joystick y ALTO siguen funcionando. |

## Acceso

La página **no pide inicio de sesión**: al abrirla toma la `X-API-Key` de `assets/js/config.js`, la valida contra la API y entra directo al selector de control (o al último control usado). Si el servidor no responde o rechaza la clave, muestra el motivo y un botón **Reintentar**. MONITOREO funciona aunque la clave sea rechazada, porque solo lee.

## Modos de control

| Modo | Cómo se usa | Qué envía |
|---|---|---|
| RC Clásico | Un toque | El comando en modo `continuo`; sigue hasta otra orden o **ALTO** |
| Gamepad | Mantener presionado | El comando en modo `mantener` y aviso `mantener` periódico; al soltar, `soltar` |
| **Joystick** | Arrastrar la perilla | Un comando **solo cuando cambia la dirección**; al soltar, regresar a la zona neutral, cancelar el gesto o perder el puntero → **DETENER** |
| Voz | Hablar al robot Demon | Órdenes por voz (heredado del panel de la API) |

### Joystick

- Implementado con **Pointer Events** (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `lostpointercapture`) y `setPointerCapture`: funciona con mouse, pantalla táctil y pluma.
- **Zona neutral** visible (círculo punteado, 30 % del recorrido): dentro de ella no se mueve nada.
- Direcciones: arriba → `AVANZAR`, abajo → `RETROCEDER`, izquierda → `GIRAR_IZQUIERDA`, derecha → `GIRAR_DERECHA` (nombres reales del catálogo del vehículo; si un comando no existe o está inactivo, esa dirección no envía nada).
- No envía por cada píxel: guarda el último comando efectivo y solo manda otro cuando cambia.
- Si la ventana pierde el foco, la pestaña se oculta o se cambia a MONITOREO mientras se arrastra, también se envía DETENER.

## Indicadores de estado (independientes, en ambas vistas)

| Indicador | Cómo se comprueba | Estados |
|---|---|---|
| **WebSocket WSS** | Eventos `open`, `error` y `close` de la única conexión `wss://…/ws/vehiculos/{id}`; reconexión con espera progresiva (0.4 s → 8 s) | En línea · Conectando / Reconectando · Desconectado |
| **Servidor AWS · API** | `GET /salud` cada 20 s, con tiempo límite de 6 s (`AbortController`) | Disponible · Comprobando · No disponible |
| **Amazon RDS** | `GET /salud/rds` (el backend ejecuta `SELECT 1` en RDS), tiempo límite 8 s | Disponible · No disponible · Sin verificar |

Cada indicador usa texto, icono y color (nunca solo color).

- «WebSocket en línea» es la conexión del **navegador** con el servidor WSS; **no** confirma que el vehículo físico esté conectado (eso requerirá heartbeat o telemetría del ESP8266/ESP32).
- «API disponible» significa que respondió la operación de salud; no garantiza que todas las operaciones funcionen ni que el motor se haya movido.
- Si la API no responde, RDS queda en **Sin verificar**: no se le atribuye la caída sin evidencia.

## Integración con la API (CONTROL)

| Uso | Método y ruta |
|---|---|
| Vehículos | `GET /vehiculos` |
| Comandos, estado y DEMO del vehículo | `GET /vehiculos/{id}/detalle` |
| Movimiento individual | `POST /vehiculos/{id}/movimientos` (o la acción `mover` por el WebSocket abierto) |
| Mantener / soltar (gamepad) | `POST /vehiculos/{id}/mantener`, `POST /vehiculos/{id}/soltar` |
| Pasos de una DEMO | `GET /vehiculos/{id}/demos/{id_demo}/movimientos` |
| Iniciar / cancelar DEMO | `POST /vehiculos/{id}/demos/{id_demo}/iniciar`, `POST /vehiculos/{id}/demos/cancelar` |

## Seguridad

- MONITOREO solo hace lecturas (GET y WSS) y no usa la clave.
- La **X-API-Key** de control va en `assets/js/config.js` para que la página entre sin login. Al ser un repositorio y una página públicos, **la clave es visible para cualquiera**: sirve para la demostración de la práctica, no como protección. Si se cambia `API_KEY` en el servidor, hay que actualizarla también en ese archivo.
- No hay credenciales de AWS ni de la base de datos en el repositorio: esas viven solo en el servidor.
- Todo va por **HTTPS** y **WSS** (sin contenido mixto desde GitHub Pages). Bootstrap 5 se carga desde jsDelivr con `integrity` (SRI).
- El backend permite **CORS** solo para `https://moy-gz04.github.io`, métodos `GET`/`POST` y encabezados `Content-Type` y `X-API-Key`. CORS no es autenticación: las operaciones de control siguen exigiendo la clave.
- Los textos que llegan de la API o del WebSocket se validan y se escapan antes de mostrarse.

## Ejecución local

Los módulos ES6 necesitan servirse por HTTP (no con `file://`):

```bash
cd vehiculo-iot-control
py -3 -m http.server 8020
# abrir http://localhost:8020/#/monitoreo
```

La API de AWS solo acepta el origen de GitHub Pages; para probar en local hay dos opciones: levantar la API local con `CORS_ORIGENES=http://localhost:8020` y cambiar `API_BASE` en `assets/js/config.js`, o abrir la copia del EC2 (`/plataforma/`), que es del mismo origen que la API.

## Publicación

- **GitHub Pages** desde la rama `main`, carpeta raíz. Todas las rutas son relativas (`assets/css/…`, `assets/js/…`), así que funciona en la subruta `/vehiculo-iot-control/`.
- **EC2**: la API sirve este mismo repositorio en `/plataforma/` (clonado en `C:\vehiculo_iot_control`; se actualiza con `git pull`).

---
Desarrollado por Juan Moisés Gómez Aispuro · 2026
