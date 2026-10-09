/**
 * Recurso "Visão": porta do Vision 5e 3.1.2 (dev7355608, MIT; veja LICENSE-ORIGINAL.txt).
 * Sentidos do dnd5e viram modos de detecção e de visão no mapa. Os ids dos modos
 * (basicSight, seeAll, feelTremor, hearing, devilsSight...) são os mesmos do original,
 * então os tokens do mundo continuam funcionando sem mexer em nada.
 */
import { iniciarVisao } from "./lib/iniciar.mjs";
import { ConfigVisao } from "./configuracao.mjs";

const ORIGINAL = "vision-5e";
const ICONE_ANTIGO = "modules/vision-5e/icons/inaudible.svg";
const CONFIGS = ["defaultHearingRange", "spectatorMode"];

/** Copia as flags do escopo vision-5e (se houver) para monolith-regras.visao.*. */
function flagsMigradas(ctx, doc) {
  const antigas = ctx.flagsAntigas(doc, ORIGINAL);
  if (!antigas || typeof antigas !== "object") return null;
  const mudancas = {};
  for (const [k, v] of Object.entries(antigas)) {
    if (ctx.getFlag(doc, k) === undefined) mudancas[ctx.caminhoFlag(k)] = foundry.utils.deepClone(v);
  }
  return Object.keys(mudancas).length ? mudancas : null;
}

/** Efeitos de status com o ícone do Inaudível antigo passam a apontar para o ícone do recurso. */
async function trocarIcones(ctx, actor) {
  if (!actor?.effects) return 0;
  const novo = `${ctx.caminho}/icones/inaudivel.svg`;
  const lista = actor.effects.filter((e) => e.img === ICONE_ANTIGO).map((e) => ({ _id: e.id, img: novo }));
  if (lista.length) await actor.updateEmbeddedDocuments("ActiveEffect", lista);
  return lista.length;
}

export default {
  id: "visao",
  nome: "Visão",
  descricao: "Sentidos do dnd5e no mapa: visão no escuro, percepção às cegas, sentido sísmico, visão verdadeira, audição, detectar magia e afins, com alcances tirados da ficha.",
  original: [ORIGINAL],
  padrao: true,

  iniciar(ctx) {
    iniciarVisao(ctx);
  },

  async migrar(ctx) {
    // Configurações do mundo
    const antigas = ctx.configsAntigas(ORIGINAL);
    let recarregar = false;
    for (const k of CONFIGS) {
      if (!(k in antigas)) continue;
      const v = k === "spectatorMode" ? !!antigas[k] : String(antigas[k]);
      if (v === ctx.get(k)) continue;
      await ctx.set(k, v);
      if (k === "defaultHearingRange") recarregar = true;
    }

    // Flags (o original não grava nenhuma, mas copia o que houver por garantia) e ícone do Inaudível
    let icones = 0;
    for (const actor of game.actors) {
      const f = flagsMigradas(ctx, actor);
      if (f) await actor.update(f);
      for (const item of actor.items) {
        const fi = flagsMigradas(ctx, item);
        if (fi) await item.update(fi);
      }
      icones += await trocarIcones(ctx, actor);
    }
    for (const item of game.items) {
      const f = flagsMigradas(ctx, item);
      if (f) await item.update(f);
    }
    for (const scene of game.scenes) {
      for (const token of scene.tokens) {
        const f = flagsMigradas(ctx, token);
        if (f) await token.update(f);
        if (!token.actorLink && token.actor) icones += await trocarIcones(ctx, token.actor);
      }
    }

    if (icones) console.log(`monolith-regras | visao: ${icones} efeito(s) Inaudível com ícone atualizado`);
    if (recarregar) ui.notifications.info("Visão: o alcance de audição do Vision 5e foi trazido. Recarregue o mundo para aplicar.");
  },

  configurar(ctx) {
    new ConfigVisao(ctx).render({ force: true });
  }
};
