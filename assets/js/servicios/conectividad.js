// Tres indicadores INDEPENDIENTES, visibles en CONTROL y en MONITOREO:
//  (1) WebSocket WSS del navegador: En línea · Conectando / Reconectando · Desconectado  (eventos reales del socket)
//  (2) Servidor AWS · API:           Disponible · Comprobando · No disponible             (GET /salud, timeout 6 s)
//  (3) Amazon RDS:                   Disponible · No disponible · Sin verificar           (GET /salud/rds: el backend hace SELECT 1)
// Una falla WSS no prueba caída de AWS o RDS; una API sana no garantiza las 21 operaciones.
import { CONFIG } from '../config.js';
import { comprobar } from './api.js';
import * as socket from './socket.js';
import { $$ } from '../utilidades/dom.js';
import { hora } from '../utilidades/fechas.js';

/** Pinta el indicador en todos los lugares donde aparece (barra superior y tarjetas de MONITOREO). */
export function indicador(clave, nivel, texto, detalle = '') {
  $$(`[data-indicador="${clave}"]`).forEach((e) => {
    e.dataset.nivel = nivel; e.title = detalle;
    const t = e.querySelector('.estado-txt'); if (t) t.textContent = texto;
  });
  $$(`[data-indicador-detalle="${clave}"]`).forEach((e) => { e.textContent = detalle; });
  $$(`[data-indicador-hora="${clave}"]`).forEach((e) => { e.textContent = `Revisado ${hora(new Date())}`; });
}

const TEXTO_WS = {
  en_linea: ['ok', 'En línea'], conectando: ['espera', 'Conectando'],
  reconectando: ['espera', 'Reconectando'], desconectado: ['mal', 'Desconectado'],
};

let apiOk = null;
let revisando = false;

async function revisar() {
  if (revisando) return; revisando = true;
  try {
    if (apiOk !== true) indicador('api', 'espera', 'Comprobando', `Consultando ${CONFIG.SALUD_API}`);
    try {
      const { status, cuerpo } = await comprobar(CONFIG.SALUD_API, 6000);
      apiOk = status === 200 && cuerpo?.api === 'disponible';
      indicador('api', apiOk ? 'ok' : 'mal', apiOk ? 'Disponible' : 'No disponible',
        apiOk ? `GET ${CONFIG.SALUD_API} respondió · ${cuerpo.servicios} operaciones documentadas (no confirma que todas funcionen)` : `GET ${CONFIG.SALUD_API} → HTTP ${status}`);
    } catch (e) {
      apiOk = false; indicador('api', 'mal', 'No disponible', `Sin respuesta de ${CONFIG.SALUD_API} (${e.message})`);
    }
    // RDS solo se informa con el diagnóstico del backend; si la API no responde, queda "Sin verificar".
    if (!apiOk) { indicador('rds', 'neutro', 'Sin verificar', 'La API no responde: no se puede consultar el diagnóstico de RDS'); return; }
    try {
      const { status, cuerpo } = await comprobar(CONFIG.SALUD_RDS, 8000);
      if (status === 200 && cuerpo?.rds === 'disponible') indicador('rds', 'ok', 'Disponible', `GET ${CONFIG.SALUD_RDS}: el backend ejecutó SELECT 1 en RDS · ${cuerpo.latencia_ms} ms`);
      else if (status === 503) indicador('rds', 'mal', 'No disponible', 'El backend no pudo consultar Amazon RDS (HTTP 503)');
      else indicador('rds', 'neutro', 'Sin verificar', `Diagnóstico no disponible (HTTP ${status})`);
    } catch { indicador('rds', 'neutro', 'Sin verificar', 'El diagnóstico de RDS no respondió a tiempo'); }
  } finally { revisando = false; }
}

export function iniciarConectividad() {
  socket.alCambiarEstado(({ fase, detalle }) => {
    const [nivel, texto] = TEXTO_WS[fase] || TEXTO_WS.desconectado;
    indicador('ws', nivel, texto, detalle);
  });
  revisar();
  setInterval(revisar, CONFIG.REVISAR_CADA_MS);      // frecuencia moderada (20 s)
  addEventListener('online', revisar);
  addEventListener('offline', () => {
    apiOk = false;
    indicador('api', 'mal', 'No disponible', 'El dispositivo no tiene red');
    indicador('rds', 'neutro', 'Sin verificar', 'Sin red: no se puede consultar el diagnóstico');
  });
  return { revisar };
}
