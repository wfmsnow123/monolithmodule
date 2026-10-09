/**
 * No Vision 5e original, várias partes se registravam no Hooks.once("init") quando o script carregava.
 * Aqui o recurso só começa dentro do "init", então essas partes entram numa fila que o iniciar() executa.
 */
const fila = [];

export const aoIniciar = (fn) => { fila.push(fn); };

export function executarFila() {
    while (fila.length) fila.shift()();
}
