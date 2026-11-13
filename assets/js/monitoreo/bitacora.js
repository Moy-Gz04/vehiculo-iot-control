// Bitácora de sincronización: deja visible la correlación REST ↔ WSS ↔ tabla (evidencia 8.5 / 12.6).
// También se copia a la consola (console.info) para capturarla junto con DevTools.
import { esc } from '../utilidades/dom.js';
import { horaMs } from '../utilidades/fechas.js';

const MAX = 14;

export class Bitacora {
  constructor(lista) { this.lista = lista; }

  /** tipo: 'REST' | 'WSS' | 'TABLA' | 'DEMO' | 'AVISO' */
  agregar(tipo, texto) {
    const ahora = new Date();
    console.info(`[MONITOREO ${tipo}] ${horaMs(ahora)} ${texto}`);
    if (!this.lista) return;
    this.lista.querySelector('.vacio')?.remove();
    this.lista.insertAdjacentHTML('afterbegin',
      `<li><time>${horaMs(ahora)}</time><span class="tipo t-${esc(tipo.toLowerCase())}">${esc(tipo)}</span><span class="txt">${esc(texto)}</span></li>`);
    while (this.lista.children.length > MAX) this.lista.lastElementChild.remove();
  }
}
