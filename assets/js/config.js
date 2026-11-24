// Configuración compartida por CONTROL, MONITOREO y ADMINISTRACIÓN (un solo lugar para API, WSS y tiempos).
// 4.3: ya NO contiene la X-API-Key. Cada persona inicia sesión y el navegador solo guarda su token temporal
// (sessionStorage). Credenciales de AWS, RDS y la clave de servicio viven únicamente en el servidor.
export const CONFIG = Object.freeze({
  API_BASE: 'https://13-218-5-111.sslip.io',   // API FastAPI en AWS (HTTPS); el WebSocket usa wss:// del mismo host
  ORIGEN: 'WEB-CONTROL',                        // nombre con el que se registran los movimientos
  SALUD_API: '/salud',                          // disponibilidad del servidor de AWS
  SALUD_RDS: '/salud/rds',                      // diagnóstico seguro de Amazon RDS (lo ejecuta el backend)
  REVISAR_CADA_MS: 20000,                       // cada cuánto se revisan API y RDS
  TIEMPO_LIMITE_MS: 8000,                       // timeout de cada petición REST
  HISTORIAL_MAX: 10,                            // filas de la tabla de MONITOREO
  ZONA_BD: 'UTC',                               // RDS guarda DATETIME sin zona, en UTC (zona por defecto de Amazon RDS)
  ZONA_VISTA: 'America/Mexico_City',            // zona en la que se muestran fecha y hora
});
