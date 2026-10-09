/**
 * Monolith: traz as configurações que o Item Piles original deixou neste mundo e neste navegador.
 * Os dados das pilhas (flags "item-piles" nos documentos) não precisam de migração; só as configurações,
 * que agora ficam com o id do Itemizador. Roda antes de o Item Piles ler qualquer configuração.
 */
import CONSTANTS from "./constants/constants.js";

const DE = "item-piles.";
const PARA = `${CONSTANTS.MODULE_NAME}.`;
const MARCA = "pilhasMigradas";

export function registrarMigracao() {
	game.settings.register(CONSTANTS.MODULE_NAME, MARCA, { scope: "world", config: false, type: Boolean, default: false });
}

export async function migrarConfiguracoesDoItemPiles() {
	// Configurações do navegador (escopo client): ficam no localStorage com a chave "item-piles.<nome>".
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const chave = localStorage.key(i);
			if (!chave?.startsWith(DE)) continue;
			const nova = PARA + chave.slice(DE.length);
			if (game.settings.settings.has(nova) && localStorage.getItem(nova) === null) localStorage.setItem(nova, localStorage.getItem(chave));
		}
	} catch (err) {
		console.warn(`${CONSTANTS.MODULE_NAME} | pilhas: não deu para ler as configurações antigas do navegador`, err);
	}

	// Configurações do mundo: só o Mestre ativo, uma vez.
	if (!game.users.activeGM?.isSelf || game.settings.get(CONSTANTS.MODULE_NAME, MARCA)) return;
	const mundo = game.settings.storage.get("world");
	let n = 0;
	for (const antiga of mundo.filter((s) => s.key.startsWith(DE))) {
		const nome = antiga.key.slice(DE.length);
		const nova = PARA + nome;
		if (!game.settings.settings.has(nova) || mundo.getSetting(nova)) continue;
		try {
			const bruto = antiga._source.value;
			await game.settings.set(CONSTANTS.MODULE_NAME, nome, typeof bruto === "string" ? JSON.parse(bruto) : bruto);
			n++;
		} catch (err) {
			console.warn(`${CONSTANTS.MODULE_NAME} | pilhas: configuração "${nome}" não migrada`, err);
		}
	}
	await game.settings.set(CONSTANTS.MODULE_NAME, MARCA, true);
	if (n) ui.notifications.info(`Monolith: Itemizador trouxe ${n} configuração(ões) do Item Piles. As pilhas, baús e mercadores dos mapas continuam como estavam.`);
}
