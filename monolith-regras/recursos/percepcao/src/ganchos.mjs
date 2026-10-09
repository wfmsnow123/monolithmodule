/**
 * Ganchos do recurso Percepção. Os arquivos portados registram ganchos no topo do módulo, como no original.
 * Aqui eles ficam guardados até o recurso ser ligado (iniciar, no "init"): só então vão para o Hooks do Foundry.
 * Os ganchos de "init" rodam na hora, porque o "init" já está acontecendo.
 */
const fila = [];
let ativo = false;

function registrar(tipo, nome, fn) {
	if (ativo) return nome === "init" ? fn() : globalThis.Hooks[tipo](nome, fn);
	fila.push([tipo, nome, fn]);
}

export const Ganchos = {
	on: (nome, fn) => registrar("on", nome, fn),
	once: (nome, fn) => registrar("once", nome, fn),
	off: (...args) => globalThis.Hooks.off(...args),
	call: (...args) => globalThis.Hooks.call(...args),
	callAll: (...args) => globalThis.Hooks.callAll(...args)
};

/** Liga os ganchos guardados. Chamado uma vez, durante o "init". */
export function ativarGanchos() {
	if (ativo) return;
	ativo = true;
	for (const [tipo, nome, fn] of fila.splice(0)) {
		if (nome === "init") {
			try { fn(); } catch (err) { console.error("monolith-regras | percepcao: init", err); }
		}
		else globalThis.Hooks[tipo](nome, fn);
	}
}
