// Configuración pública del frontend (sin secretos).
// La X-API-Key la escribe el operador en la pantalla de inicio y se guarda solo en su navegador.
window.CONFIG = {
  API_BASE: 'https://13-218-5-111.sslip.io',   // API FastAPI en AWS (HTTPS); el WebSocket usa wss:// del mismo host
  SALUD_API: '/salud',                          // disponibilidad del servidor de AWS
  SALUD_RDS: '/salud/rds',                      // diagnóstico seguro de Amazon RDS (lo ejecuta el backend)
  REVISAR_CADA_MS: 20000,                       // cada cuánto se revisan API y RDS
};
