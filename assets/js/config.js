// Configuración del frontend.
window.CONFIG = {
  API_BASE: 'https://13-218-5-111.sslip.io',   // API FastAPI en AWS (HTTPS); el WebSocket usa wss:// del mismo host
  API_KEY: 'iot-ec2-2026',                      // X-API-Key del servidor: la página entra sola, sin pantalla de login
  ORIGEN: 'WEB-CONTROL',                        // nombre con el que se registran los movimientos
  SALUD_API: '/salud',                          // disponibilidad del servidor de AWS
  SALUD_RDS: '/salud/rds',                      // diagnóstico seguro de Amazon RDS (lo ejecuta el backend)
  REVISAR_CADA_MS: 20000,                       // cada cuánto se revisan API y RDS
};
