/**
 * Recurso "Ordenar inventário": porta do Illandril's Inventory Sorter (5e) 3.1.3 (MIT, Joe Spandrusyszyn).
 * Veja LICENSE-ORIGINAL.txt.
 *
 * Diferença principal: o original tinha dois motores. O padrão reordenava o HTML da ficha depois de renderizar
 * (quebra no v13: as fichas são ApplicationV2 e a Tidy é Svelte, que não tolera nós movidos por fora). O "legado"
 * gravava o campo `sort` dos itens. Aqui só existe o segundo, com todas as opções do primeiro: a ordem calculada
 * vai para o `sort` de cada item e qualquer ficha em modo manual (dnd5e e Tidy Clássica, inclusive o conteúdo de
 * recipientes) mostra a lista em ordem. Atores do Item Piles e de compêndios não são tocados.
 */
import { CATEGORIAS, ORDEM_PADRAO, ordemCompleta, calcularOrdem, categoriaDe } from "./ordem.mjs";
import { configurar } from "./config.mjs";

const OPCAO = "monolithInventario"; // marca nas atualizações feitas por nós
let C = null;
const ordenados = new Set();        // atores (uuid) já ordenados nesta sessão
const pendentes = new Map();        // uuid -> timeout

const ehPilha = (actor) => !!(actor?.getFlag?.("item-piles", "data")?.enabled || game.itempiles?.API?.isValidItemPile?.(actor));

/** Este ator pode (e deve) ter a ordem gravada por este usuário? */
function gerenciavel(actor) {
  if (!(actor instanceof Actor) || actor.pack || !actor.isOwner) return false;
  return !ehPilha(actor);
}

const ordem = () => ordemCompleta(C?.get("ordem"));

export async function ordenarAtor(actor) {
  if (!gerenciavel(actor)) return;
  ordenados.add(actor.uuid);
  const alvo = calcularOrdem(actor.items, ordem());
  const updates = [];
  for (const [id, sort] of alvo) {
    const item = actor.items.get(id);
    if (item && item.sort !== sort) updates.push({ _id: id, sort });
  }
  if (!updates.length) return;
  try {
    await actor.updateEmbeddedDocuments("Item", updates, { [OPCAO]: true });
  } catch (err) {
    console.error(`${C.ID} | inventario: falha ao ordenar ${actor.name}`, err);
  }
}

function adiar(actor) {
  if (!actor) return;
  clearTimeout(pendentes.get(actor.uuid));
  pendentes.set(actor.uuid, setTimeout(() => { pendentes.delete(actor.uuid); ordenarAtor(actor); }, 150));
}

const atorDoApp = (app) => {
  const doc = app?.document ?? app?.actor;
  return doc instanceof Actor ? doc : doc instanceof Item ? doc.actor : null;
};

/** Atores das fichas abertas (personagens e recipientes) que este usuário pode gravar. */
function atoresAbertos() {
  const mapa = new Map();
  for (const app of foundry.applications.instances.values()) {
    if (!app.rendered) continue;
    const actor = atorDoApp(app);
    if (actor && gerenciavel(actor)) mapa.set(actor.uuid, actor);
  }
  return [...mapa.values()];
}

export function reordenarAbertos({ todosDosJogadores = false } = {}) {
  ordenados.clear();
  const lista = new Map(atoresAbertos().map((a) => [a.uuid, a]));
  if (todosDosJogadores && game.user.isGM) for (const a of game.actors) if (a.hasPlayerOwner && gerenciavel(a)) lista.set(a.uuid, a);
  for (const a of lista.values()) adiar(a);
}

function aoRenderizar(app) {
  const actor = atorDoApp(app);
  if (!actor || ordenados.has(actor.uuid) || app.isEditable === false) return;
  if (gerenciavel(actor)) adiar(actor);
}

function aoMudarItem(item, userId) {
  if (userId !== game.user.id) return;
  const actor = item?.parent;
  if (actor instanceof Actor && gerenciavel(actor)) adiar(actor);
}

export default {
  id: "inventario",
  nome: "Ordenar inventário",
  descricao: "Ordena os itens da ficha por nome (ou peso, quantidade, uso...) dentro de cada tipo, automaticamente. Funciona na Tidy Clássica e na ficha do dnd5e, inclusive dentro de recipientes. Não mexe nos atores do Item Piles.",
  original: ["illandril-inventory-sorter"],
  padrao: true,

  iniciar(ctx) {
    C = ctx;
    ctx.registrar("ordem", {
      scope: "world", config: false, type: Object, default: foundry.utils.deepClone(ORDEM_PADRAO),
      onChange: () => reordenarAbertos()
    });

    // Fichas: dnd5e e Tidy (ambas ApplicationV2) e a ficha de recipiente.
    Hooks.on("renderActorSheetV2", (app) => aoRenderizar(app));
    Hooks.on("tidy5e-sheet.renderActorSheet", (app) => aoRenderizar(app));
    Hooks.on("renderItemSheetV2", (app) => { if (app.document?.type === "container") aoRenderizar(app); });

    Hooks.on("createItem", (item, _o, userId) => aoMudarItem(item, userId));
    Hooks.on("deleteItem", (item, _o, userId) => aoMudarItem(item, userId));
    Hooks.on("updateItem", (item, _c, options, userId) => { if (!options?.[OPCAO]) aoMudarItem(item, userId); });

    // Arrastar para reordenar à mão: a ordem automática prevalece (como no modo legado do original).
    Hooks.on("preUpdateItem", (item, changes, options) => {
      if (options?.[OPCAO] || changes.sort === undefined) return;
      const actor = item.parent;
      if (!(actor instanceof Actor) || !gerenciavel(actor) || !categoriaDe(item, ordem())) return;
      const alvo = calcularOrdem(actor.items, ordem()).get(item.id);
      if (alvo === undefined) return;
      changes.sort = alvo;
      const outras = Object.keys(changes).filter((k) => k !== "_id" && k !== "sort");
      if (item.sort === alvo && !outras.length) return false;
    });
  },

  async migrar(ctx) {
    const velho = "illandril-inventory-sorter";
    const nova = ordemCompleta(ctx.get("ordem"));
    let mudou = false;
    for (const cat of CATEGORIAS) {
      for (const [lado, sufixo] of [["p", "Primary"], ["s", "Secondary"]]) {
        const v = ctx.configAntiga(velho, `${cat.antiga}${sufixo}`);
        if (typeof v !== "string" || !cat.escolhas.includes(v)) continue;
        nova[cat.id][lado] = v;
        mudou = true;
      }
    }
    // Opção do modo legado: habilidades agrupadas pelo requisito (de onde vieram).
    if (ctx.configAntiga(velho, "sortFeatsByRequirement") === true && nova.habilidades.p === "default") {
      nova.habilidades = { p: "requirements_asc", s: "name_asc" };
      mudou = true;
    }
    if (mudou) await ctx.set("ordem", nova);
  },

  configurar(ctx) { C ??= ctx; return configurar(ctx, { reordenar: reordenarAbertos }); }
};
