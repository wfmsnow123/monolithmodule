/**
 * Recurso "Montaria": porta do Rideable 5.0.5 (Saibot393, MIT; veja LICENSE-ORIGINAL.txt).
 * Montar e cavalgar, agarrar e carregar, seguir, pilotar, efeitos de montaria, botão no HUD,
 * aba no token, macros e ações do Monk's Active Tiles. Ajustado ao movimento do Foundry v13:
 * os cavaleiros andam pelo mesmo caminho e na mesma velocidade da montaria.
 */
import { definirContexto, ID, RECURSO } from "./nucleo/base.mjs";
import { registrarConfiguracoes, migrarCliente, ConfigMontaria, ESQUEMA } from "./configuracao.mjs";
import { ligarCavalgar } from "./nucleo/RidingScript.mjs";
import { ligarMontar } from "./nucleo/MountingScript.mjs";
import { ligarSeguir } from "./nucleo/FollowingScript.mjs";
import { ligarEfeitos } from "./nucleo/EffectManager.mjs";
import { ligarCompat } from "./nucleo/RideableCompatibility.mjs";
import { ligarSocket } from "./nucleo/socket.mjs";
import { ligarApi } from "./nucleo/api.mjs";
import { prepararFormas } from "./nucleo/GeometricUtils.mjs";
import { ligarFicha } from "./ficha.mjs";

const ORIGINAL = "Rideable";

/** Mudanças para trazer as flags do escopo Rideable (só as que ainda não existem no novo). */
function flagsMigradas(ctx, doc, prefixo = "") {
  const antigas = ctx.flagsAntigas(doc, ORIGINAL);
  if (!antigas || typeof antigas !== "object") return null;
  const atuais = (doc?._source?.flags ?? doc?.flags)?.[ID]?.[RECURSO] ?? {};
  const mudancas = {};
  for (const [k, v] of Object.entries(antigas)) {
    if (k in atuais) continue;
    mudancas[`${prefixo}${ctx.caminhoFlag(k)}`] = foundry.utils.deepClone(v);
  }
  return Object.keys(mudancas).length ? mudancas : null;
}

async function migrarItens(ctx, colecao, dono) {
  const updates = [];
  for (const item of colecao) {
    const f = flagsMigradas(ctx, item);
    if (f) updates.push({ _id: item.id, ...f });
  }
  if (!updates.length) return 0;
  if (dono) await dono.updateEmbeddedDocuments("Item", updates);
  else await CONFIG.Item.documentClass.updateDocuments(updates);
  return updates.length;
}

export default {
  id: RECURSO,
  nome: "Montaria",
  descricao: "Montar, carregar e agarrar, seguir e pilotar: tokens que andam juntos pelo mesmo caminho, com configuração em uma janela só.",
  original: [ORIGINAL],
  padrao: true,

  iniciar(ctx) {
    definirContexto(ctx);
    ConfigMontaria.ctx = ctx;
    registrarConfiguracoes(ctx);
    ligarCavalgar();
    ligarMontar();
    ligarSeguir();
    ligarEfeitos();
    ligarCompat();
    ligarFicha();
    ligarApi();
    Hooks.once("ready", () => {
      ligarSocket(ctx);
      prepararFormas();
      migrarCliente(ctx);
    });
  },

  async migrar(ctx) {
    // Configurações do mundo
    const antigas = ctx.configsAntigas(ORIGINAL);
    let configs = 0;
    for (const s of ESQUEMA) {
      if (s.cliente || !(s.k in antigas)) continue;
      let v = antigas[s.k];
      if (s.tipo === Number) v = Number(v);
      else if (s.tipo === Boolean) v = !!v;
      else v = String(v ?? "");
      if (s.tipo === Number && !Number.isFinite(v)) continue;
      if (v === ctx.get(s.k)) continue;
      await ctx.set(s.k, v);
      configs++;
    }

    // Flags: tokens e tiles de todas as cenas, atores (e token protótipo), itens
    let docs = 0;
    for (const scene of game.scenes) {
      for (const [tipo, colecao] of [["Token", scene.tokens], ["Tile", scene.tiles]]) {
        const updates = [];
        for (const doc of colecao) {
          const f = flagsMigradas(ctx, doc);
          if (f) updates.push({ _id: doc.id, ...f });
        }
        if (updates.length) {
          await scene.updateEmbeddedDocuments(tipo, updates, { RidingMovement: true, animate: false });
          docs += updates.length;
        }
      }
      for (const token of scene.tokens) {
        if (!token.actorLink && token.actor) docs += await migrarItens(ctx, token.actor.items, token.actor);
      }
    }
    for (const actor of game.actors) {
      const f = { ...(flagsMigradas(ctx, actor) ?? {}), ...(flagsMigradas(ctx, actor.prototypeToken, "prototypeToken.") ?? {}) };
      if (Object.keys(f).length) { await actor.update(f); docs++; }
      docs += await migrarItens(ctx, actor.items, actor);
    }
    docs += await migrarItens(ctx, game.items, null);

    console.log(`${ID} | montaria: ${configs} configuração(ões) e ${docs} documento(s) trazidos do Rideable`);
    if (configs || docs) ui.notifications.info(`Montaria: configurações e montarias do Rideable trazidas (${docs} documento(s)).`);
  },

  configurar(ctx) {
    new ConfigMontaria(ctx).render({ force: true });
  }
};
