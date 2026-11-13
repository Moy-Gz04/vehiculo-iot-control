// Configuración compartida por CONTROL y MONITOREO (un solo lugar para API, WSS y vehículo).
// No contiene credenciales de AWS ni de RDS: esas viven solo en el servidor.
export const CONFIG = Object.freeze({
  API_BASE: 'https://13-218-5-111.sslip.io',   // API FastAPI en AWS (HTTPS); el WebSocket usa wss:// del mismo host
  API_KEY: 'iot-ec2-2026',                      // X-API-Key de CONTROL (pública a propósito, ver README · Seguridad)
  ORIGEN: 'WEB-CONTROL',                        // nombre con el que se registran los movimientos
  SALUD_API: '/salud',                          // disponibilidad del servidor de AWS
  SALUD_RDS: '/salud/rds',                      // diagnóstico seguro de Amazon RDS (lo ejecuta el backend)
  REVISAR_CADA_MS: 20000,                       // cada cuánto se revisan API y RDS
  TIEMPO_LIMITE_MS: 8000,                       // timeout de cada petición REST
  HISTORIAL_MAX: 10,                            // filas de la tabla de MONITOREO
  ZONA_BD: 'UTC',                               // RDS guarda DATETIME sin zona, en UTC (zona por defecto de Amazon RDS)
  ZONA_VISTA: 'America/Mexico_City',            // zona en la que se muestran fecha y hora
});
