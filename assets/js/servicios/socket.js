// Cliente WebSocket (WSS) ÚNICO y compartido por CONTROL y MONITOREO.
// - Una sola conexión por pestaña hacia wss://<api>/ws/vehiculos/{id}; cambiar de vista NO abre otra.
// - Estados: conectando · en_linea · reconectando · desconectado (el indicador depende de la conexión real).
// - Reconexión con espera progresiva (0.4 s, 0.8 s, 1.6 s… hasta 8 s) y aviso de "reconectado" para resincronizar por REST.
// - «En línea» = el NAVEGADOR está conectado al servidor WSS; NO prueba que el vehículo físico esté conectado.
import { rutas } from './api.js';

const oyentesMensaje = new Set();
const oyentesEstado = new Set();
const oyentesApertura = new Set();

let ws = null;
let idVehiculo = null;
let intento = 0;
let ping = null;
let timerReintento = null;
let aperturas = 0;
let estado = { fase: 'desconectado', detalle: 'Sin conexión todavía' };

function fijar(fase, detalle) {
  estado = { fase, detalle, intento };
  oyentesEstado.forEach((f) => { try { f(estado); } catch (e) { console.error(e); } });
}

function cerrarActual() {
  clearInterval(ping); clearTimeout(timerReintento);
  if (!ws) return;
  const viejo = ws; ws = null;
  viejo.onopen = viejo.onmessage = viejo.onerror = viejo.onclose = null;
  try { viejo.close(1000, 'cambio'); } catch { /* ya cerrado */ }
}

function abrir() {
  cerrarActual();
  if (!idVehiculo) return;
  fijar(intento ? 'reconectando' : 'conectando', `Intento ${intento + 1} · ${rutas.ws(idVehiculo)}`);
  const s = new WebSocket(rutas.ws(idVehiculo));
  const v = idVehiculo;
  ws = s;
  s.onopen = () => {
    if (ws !== s) return;
    const reconexion = aperturas > 0;
    aperturas++; intento = 0;
    fijar('en_linea', 'Conexión del navegador con el servidor WSS (no confirma el vehículo físico)');
    ping = setInterval(() => { if (s.readyState === 1) s.send('ping'); }, 10000);
    oyentesApertura.forEach((f) => { try { f({ reconexion, idVehiculo: v }); } catch (e) { console.error(e); } });
  };
  s.onmessage = (ev) => {
    if (ws !== s) return;
    let m; try { m = JSON.parse(ev.data); } catch { return; }       // datos no confiables: si no es JSON se ignora
    oyentesMensaje.forEach((f) => { try { f(m, v); } catch (e) { console.error(e); } });
  };
  s.onerror = () => { if (ws === s) fijar('desconectado', 'Error en la conexión WSS'); };
  s.onclose = (ev) => {
    if (ws !== s) return;
    clearInterval(ping);
    // 4404: el vehículo no existe -> no tiene caso insistir rápido
    const espera = ev.code === 4404 ? 15000 : Math.min(8000, 400 * 2 ** intento);
    intento++;
    fijar('desconectado', `Se cerró la conexión WSS (código ${ev.code}); reintento en ${(espera / 1000).toFixed(1)} s`);
    timerReintento = setTimeout(() => { if (ws === s) abrir(); }, espera);
  };
}

/** Conecta (o reconecta) al canal del vehículo. Si ya está conectado al mismo, no hace nada. */
export function conectar(id) {
  if (id === idVehiculo && ws && ws.readyState <= 1) return;
  idVehiculo = id; intento = 0; aperturas = 0;
  abrir();
}

/** Corta la conexión a propósito (Prueba D) y deja que la reconexión automática actúe. */
export function forzarReconexion() {
  if (!ws) { abrir(); return; }
  try { ws.close(4000, 'prueba de reconexion'); } catch { /* ya cerrado */ }
}

export const abierto = () => !!ws && ws.readyState === 1;
export const estadoActual = () => estado;

/** Envía un objeto JSON por la conexión abierta. Devuelve false si no está abierta. */
export function enviar(obj) {
  if (!abierto()) return false;
  ws.send(JSON.stringify(obj));
  return true;
}

export function alMensaje(f) { oyentesMensaje.add(f); return () => oyentesMensaje.delete(f); }
export function alCambiarEstado(f) { oyentesEstado.add(f); f(estado); return () => oyentesEstado.delete(f); }
/** Se llama en cada apertura; { reconexion:true } cuando ya había estado conectado antes. */
export function alAbrir(f) { oyentesApertura.add(f); return () => oyentesApertura.delete(f); }

// iPhone pausa la pestaña en segundo plano y la red puede ir y venir: al volver, reconecta sin esperar.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && idVehiculo && (!ws || ws.readyState > 1)) { intento = 0; abrir(); }
});
addEventListener('online', () => { if (idVehiculo && (!ws || ws.readyState > 1)) { intento = 0; abrir(); } });
addEventListener('offline', () => { if (ws) fijar('desconectado', 'El dispositivo no tiene red'); });
