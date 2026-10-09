/**
 * Recurso "Percepção": porte do Perceptive 5.0.19 (Saibot393, MIT) para o Regras da Casa.
 * Espiar pela fechadura, portas que giram e deslizam, furtividade e detecção (Percepção x Furtividade),
 * Percepção ativa persistente, seguir tokens, canais de visão, pings e a aba nas fichas de parede, token, peça e cena.
 *
 * O código portado fica em src/ (mesma estrutura do original). Os ganchos dele só entram no Foundry
 * quando o recurso é ligado (ver src/ganchos.mjs).
 */
import { ativarGanchos } from "./src/ganchos.mjs";
import { setContexto, cOriginal } from "./src/utils/PerceptiveUtils.mjs";
// Mesma ordem dos esmodules do módulo original
import "./src/helpers/WallslayerHandler.mjs";
import "./src/helpers/PerceptiveMouseHandler.mjs";
import "./src/helpers/PerceptiveRollHandler.mjs";
import "./src/helpers/PerceptiveFlags.mjs";
import "./src/helpers/PerceptivePopups.mjs";
import "./src/helpers/CustomPings.mjs";
import "./src/PeekingScript.mjs";
import "./src/DoorMovingScript.mjs";
import "./src/StalkingScript.mjs";
import "./src/SpottingScript.mjs";
import "./src/VisionChannelsScript.mjs";
import "./src/helpers/SocketHandler.mjs";
import "./src/helpers/MacroHooks.mjs";
import "./src/helpers/WallTabInserter.mjs";
import "./src/settings/PerceptiveSheetSettings.mjs";
import "./src/compatibility/PerceptiveCompatibility.mjs";
import "./src/compatibility/APIHandler.mjs";
import "./src/helpers/VisionChannelsHelper.mjs";
import "./src/helpers/BasicPatches.mjs";
import "./src/helpers/EffectManager.mjs";
import { CONFIGS, registrarConfiguracoes, prepararConfiguracoes } from "./configuracoes.mjs";
import { ConfigPercepcao, classeDoMenu } from "./janela.mjs";

const NOVO = "flags.monolith-regras.percepcao";

export default {
	id: "percepcao",
	nome: "Percepção",
	descricao: "Espiar pela fechadura, portas que giram e deslizam, furtividade e detecção (Percepção contra Furtividade), canais de visão e câmera que segue o token.",
	original: [cOriginal],
	padrao: true,

	iniciar(ctx) {
		setContexto(ctx);
		registrarConfiguracoes(ctx);
		ctx.registrarMenu("menu", {
			name: "Percepção",
			label: "Configurar a Percepção",
			hint: "Espiar, portas, furtividade e detecção, canais de visão e as preferências de cada jogador, numa janela só.",
			icon: "fa-solid fa-eye",
			type: classeDoMenu(ctx),
			restricted: false
		});
		ativarGanchos();
		Hooks.once("ready", () => prepararConfiguracoes(ctx));
	},

	configurar(ctx) {
		new ConfigPercepcao(ctx).render(true);
	},

	async migrar(ctx) {
		await migrarConfiguracoes(ctx);
		await migrarFlags(ctx);
	}
};

/* ---------- Migração do Perceptive ---------- */

async function migrarConfiguracoes(ctx) {
	const antigas = ctx.configsAntigas(cOriginal);
	let n = 0;
	for (const c of CONFIGS) {
		if ((c.escopo ?? "world") !== "world" || !(c.chave in antigas)) continue;
		let valor = antigas[c.chave];
		// formato antigo da iluminação: [Penumbra, Plena] vira [Escuridão, Penumbra, Plena]
		if (c.chave === "IlluminationPDCModifier" && Array.isArray(valor) && valor.length === 2) valor = [0, Number(valor[0]), Number(valor[1])];
		if (foundry.utils.objectsEqual({ v: valor }, { v: ctx.get(c.chave) })) continue;
		try {
			await ctx.set(c.chave, valor);
			n++;
		} catch (err) {
			console.warn(`monolith-regras | percepcao: configuração ${c.chave} não migrada`, err);
		}
	}
	console.log(`monolith-regras | percepcao: ${n} configurações do Perceptive migradas`);
}

/** Troca "flags.perceptive." por "flags.monolith-regras.percepcao." nas mudanças de efeitos ativos. */
function mudancasMigradas(efeito) {
	const changes = efeito._source?.changes ?? efeito.changes ?? [];
	if (!changes.some((m) => String(m.key ?? "").startsWith(`flags.${cOriginal}.`))) return null;
	return changes.map((m) => ({ ...m, key: String(m.key).replace(`flags.${cOriginal}.`, `${NOVO}.`) }));
}

/** Update de um documento: flags antigas copiadas para o escopo novo (as antigas ficam, para poder voltar ao módulo original). */
function updateDe(ctx, doc) {
	const antigas = ctx.flagsAntigas(doc, cOriginal);
	const upd = { _id: doc.id };
	let mudou = false;
	if (antigas && Object.keys(antigas).length) {
		const atuais = doc._source?.flags?.["monolith-regras"]?.percepcao ?? {};
		upd[NOVO] = foundry.utils.mergeObject(foundry.utils.deepClone(antigas), atuais, { inplace: false });
		mudou = true;
	}
	if (doc.documentName === "ActiveEffect") {
		const changes = mudancasMigradas(doc);
		if (changes) { upd.changes = changes; mudou = true; }
	}
	return mudou ? upd : null;
}

async function atualizarColecao(ctx, pai, nome, colecao) {
	const docs = colecao?.contents ?? [...(colecao ?? [])];
	const updates = docs.map((d) => updateDe(ctx, d)).filter(Boolean);
	if (!updates.length) return 0;
	// PerceptiveChange: os ganchos de parede não recriam paredes auxiliares durante a migração
	await pai.updateEmbeddedDocuments(nome, updates, { PerceptiveChange: true });
	return updates.length;
}

async function atualizarDoc(ctx, doc) {
	const upd = updateDe(ctx, doc);
	if (!upd) return 0;
	delete upd._id;
	await doc.update(upd);
	return 1;
}

async function migrarAtor(ctx, ator) {
	let n = await atualizarDoc(ctx, ator);
	n += await atualizarColecao(ctx, ator, "ActiveEffect", ator.effects);
	n += await atualizarColecao(ctx, ator, "Item", ator.items);
	for (const item of ator.items) n += await atualizarColecao(ctx, item, "ActiveEffect", item.effects);
	const proto = ctx.flagsAntigas(ator.prototypeToken, cOriginal);
	if (proto && Object.keys(proto).length) {
		await ator.update({ [`prototypeToken.${NOVO}`]: foundry.utils.deepClone(proto) });
		n++;
	}
	return n;
}

async function migrarFlags(ctx) {
	let n = 0;
	for (const cena of game.scenes) {
		try {
			n += await atualizarDoc(ctx, cena);
			n += await atualizarColecao(ctx, cena, "Wall", cena.walls);
			n += await atualizarColecao(ctx, cena, "Token", cena.tokens);
			n += await atualizarColecao(ctx, cena, "Tile", cena.tiles);
			// atores sintéticos (tokens não vinculados) com efeitos próprios
			for (const token of cena.tokens) {
				if (token.actorLink || !token.actor) continue;
				n += await atualizarColecao(ctx, token.actor, "ActiveEffect", token.actor.effects);
			}
		} catch (err) {
			console.warn(`monolith-regras | percepcao: cena ${cena.name} não migrada por inteiro`, err);
		}
	}
	for (const ator of game.actors) {
		try { n += await migrarAtor(ctx, ator); }
		catch (err) { console.warn(`monolith-regras | percepcao: ator ${ator.name} não migrado por inteiro`, err); }
	}
	for (const item of game.items) {
		try {
			n += await atualizarDoc(ctx, item);
			n += await atualizarColecao(ctx, item, "ActiveEffect", item.effects);
		}
		catch (err) { console.warn(`monolith-regras | percepcao: item ${item.name} não migrado por inteiro`, err); }
	}
	console.log(`monolith-regras | percepcao: ${n} documentos com flags do Perceptive migrados`);
	if (n) ui.notifications?.info(`Percepção: dados do Perceptive trazidos para o Regras da Casa (${n} documentos).`);
}
