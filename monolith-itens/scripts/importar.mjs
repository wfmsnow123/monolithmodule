/**
 * Importa os itens e os cardápios para o mundo, em pastas. Pode rodar de novo: o que já foi importado
 * (achado pela marca flags.monolith-itens.id) é atualizado no lugar, sem duplicar. Itens que o Mestre
 * moveu de pasta ficam onde estão.
 */
import { ID, RAIZ_ITENS, RAIZ_JORNAL } from "./util.mjs";
import { montarItem, montarCardapio } from "./montar.mjs";

export async function carregarDados() {
  const ler = async (arq) => (await fetch(`modules/${ID}/data/${arq}`)).json();
  const [itens, cardapios] = await Promise.all([ler("itens.json"), ler("cardapios.json")]);
  return { itens, cardapios };
}

/** Pasta pelo caminho "A/B/C" sob a raiz, criando o que faltar (o Foundry aceita até 4 níveis). */
async function pasta(tipo, raiz, caminho, cache) {
  const partes = [raiz, ...String(caminho ?? "").split("/").map((p) => p.trim()).filter(Boolean)].slice(0, 4);
  let pai = null, chave = "";
  for (const nome of partes) {
    chave += `/${nome}`;
    if (!cache.has(chave)) {
      let f = game.folders.find((x) => x.type === tipo && x.name === nome && (x.folder?.id ?? null) === (pai?.id ?? null));
      f ??= await Folder.create({ name: nome, type: tipo, folder: pai?.id ?? null, color: pai ? null : "#a3121b", sorting: "a" });
      cache.set(chave, f);
    }
    pai = cache.get(chave);
  }
  return pai;
}

/** Cria ou atualiza documentos (Item ou JournalEntry) pela marca de id. */
async function sincronizar(classe, colecao, entradas, raiz, montar) {
  const cache = new Map();
  const existentes = new Map(colecao.filter((d) => d.getFlag(ID, "id")).map((d) => [d.getFlag(ID, "id"), d]));
  const criar = [], atualizar = [];
  for (const e of entradas) {
    const dados = montar(e);
    const atual = existentes.get(e.id);
    if (atual) {
      // Jornal: o texto do cardápio mora na página.
      if (dados.pages) {
        const pagina = atual.pages.find((p) => p.getFlag(ID, "id") === e.id);
        if (pagina) await pagina.update({ "text.content": dados.pages[0].text.content });
        delete dados.pages;
      }
      atualizar.push({ _id: atual.id, ...dados });
    } else {
      dados.folder = (await pasta(classe.documentName, raiz, e.pasta, cache)).id;
      criar.push(dados);
    }
  }
  if (criar.length) await classe.createDocuments(criar);
  if (atualizar.length) await classe.updateDocuments(atualizar);
  return { criados: criar.length, atualizados: atualizar.length };
}

export async function importar({ itens = true, cardapios = true } = {}) {
  if (!game.user.isGM) return ui.notifications.warn("Só o Mestre importa os itens de Monolith.");
  const dados = await carregarDados();
  const r = {};
  if (itens) r.itens = await sincronizar(Item, game.items, dados.itens, RAIZ_ITENS, montarItem);
  if (cardapios) r.cardapios = await sincronizar(JournalEntry, game.journal, dados.cardapios, RAIZ_JORNAL, montarCardapio);
  await game.settings.set(ID, "importado", true);
  const t = (x, nome) => (x ? `${nome}: ${x.criados} novo(s), ${x.atualizados} atualizado(s)` : "");
  ui.notifications.info(`Monolith: Itens & Miscelânea. ${[t(r.itens, "itens"), t(r.cardapios, "cardápios")].filter(Boolean).join("; ")}.`);
  return r;
}
