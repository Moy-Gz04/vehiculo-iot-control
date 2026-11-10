# Control Excavadora IoT · Frontend (GitHub Pages)

Aplicación web de **CONTROL** del vehículo IoT (Práctica 4.1, Implementación de soluciones IoT).
Es solo el frontend: consume la API FastAPI ya desplegada en AWS ([vehiculo-iot-api](https://github.com/Moy-Gz04/vehiculo-iot-api)) por HTTPS y su canal WebSocket por WSS.

- **Página publicada:** https://moy-gz04.github.io/vehiculo-iot-control/
- **API:** https://13-218-5-111.sslip.io (Swagger en `/docs`)

## Estructura

```
index.html        Pantallas: inicio de sesión, selector de control y control remoto; indicadores y créditos
css/app.css       Estilos (Mobile First, vertical y horizontal); indicadores, joystick y pie
js/config.js      Configuración pública: URL base de la API y rutas de salud (sin secretos)
js/app.js         Lógica: cliente REST, WebSocket, modos de control, joystick, DEMO e indicadores
.nojekyll         GitHub Pages sirve los archivos tal cual
```

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
- No envía por cada píxel: guarda el último comando efectivo y solo manda otro cuando cambia. Ejemplo comprobado: un arrastre de 30 pasos (centro → arriba → derecha → soltar) produjo exactamente 3 órdenes: avanzar, girar a la derecha y detener.
- Si la ventana pierde el foco o la pestaña se oculta mientras se arrastra, también se envía DETENER.

## Indicadores de estado (independientes)

| Indicador | Cómo se comprueba | Estados |
|---|---|---|
| **WebSocket WSS** | Eventos `open`, `error` y `close` de la conexión `wss://…/ws/vehiculos/{id}` que abre la página; reconexión con espera creciente | En línea · Conectando / Reconectando · Desconectado |
| **Servidor AWS · API** | `GET /salud` cada 20 s, con tiempo límite de 6 s (`AbortController`) | Disponible · Comprobando · No disponible |
| **Amazon RDS** | `GET /salud/rds` (el backend ejecuta `SELECT 1` en RDS), tiempo límite 8 s | Disponible · No disponible · Sin verificar |

Cada indicador usa texto, icono y color (nunca solo color). Al pasar el puntero muestra el detalle.

- «WebSocket en línea» es la conexión del **navegador** con el servidor WSS; **no** confirma que el vehículo físico esté conectado.
- «API disponible» significa que respondió la operación de salud; no garantiza que todas las operaciones funcionen ni que el motor se haya movido.
- Si la API no responde, RDS queda en **Sin verificar**: no se le atribuye la caída sin evidencia.

## Integración con la API

| Uso | Método y ruta |
|---|---|
| Salud de la API | `GET /salud` |
| Diagnóstico de RDS | `GET /salud/rds` |
| Vehículos | `GET /vehiculos` |
| Comandos, estado y DEMO del vehículo | `GET /vehiculos/{id}/detalle` |
| Movimiento individual | `POST /vehiculos/{id}/movimientos` (o la acción `mover` por el WebSocket abierto) |
| Mantener / soltar (gamepad) | `POST /vehiculos/{id}/mantener`, `POST /vehiculos/{id}/soltar` |
| Pasos de una DEMO | `GET /vehiculos/{id}/demos/{id_demo}/movimientos` |
| Iniciar / cancelar DEMO | `POST /vehiculos/{id}/demos/{id_demo}/iniciar`, `POST /vehiculos/{id}/demos/cancelar` |
| Historial | `GET /vehiculos/{id}/historial` |
| Eventos en tiempo real | `wss://13-218-5-111.sslip.io/ws/vehiculos/{id}` |

## Seguridad

- No hay claves, tokens ni credenciales en el repositorio. La **X-API-Key** la escribe el operador en la pantalla de inicio y se guarda solo en su navegador (`localStorage`).
- Todo va por **HTTPS** y **WSS** (sin contenido mixto desde GitHub Pages).
- El backend permite **CORS** solo para `https://moy-gz04.github.io`, métodos `GET`/`POST` y encabezados `Content-Type` y `X-API-Key`. CORS no es autenticación: las operaciones de control siguen exigiendo la clave.
- Los textos que llegan de la API se escapan antes de mostrarse en la página.

## Ejecución local

```bash
# 1) API local con CORS para el servidor de prueba
cd C:\vehiculo_iot_api
set CORS_ORIGENES=http://localhost:8020
.venv\Scripts\python -m uvicorn app.main:app --port 8010

# 2) Frontend: cambia API_BASE en js/config.js a http://127.0.0.1:8010 y sirve la carpeta
cd C:\vehiculo_iot_control
python -m http.server 8020
# abrir http://localhost:8020/
```

Para producción, `js/config.js` apunta a `https://13-218-5-111.sslip.io`.

## Publicación

GitHub Pages desde la rama `main`, carpeta raíz. Todas las rutas son relativas (`css/…`, `js/…`), así que funcionan en la subruta `/vehiculo-iot-control/`.

---
Desarrollado por Juan Moisés Gómez Aispuro · 2026
