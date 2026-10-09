export const ID = "monolith-itemizador";

export const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const { DialogV2 } = foundry.applications.api;

/** API do Monolith: Journals, se estiver ativo (temas das páginas). */
function journals() {
  const m = game.modules.get("monolith-journals");
  return m?.active ? m.api : null;
}

/** O documento que um item carrega (ou null, se não for um documento itemizado). */
export const dadosDoc = (item) => item?.getFlag?.(ID, "doc") ?? null;
export const ehDocumento = (item) => !!dadosDoc(item);

/**
 * Cópia do conteúdo das páginas, com o tema de cada uma. É o que o jogador lê:
 * não depende de permissão no jornal, e viaja com o item se ele for trocado de mãos.
 */
export function capturar(journal, paginas = null) {
  const api = journals();
  return journal.pages.contents
    .filter((p) => !paginas?.length || paginas.includes(p.id))
    .sort((a, b) => a.sort - b.sort)
    .map((p) => {
      const tema = api?.temaDe(p) ?? null;
      let html = "";
      if (p.type === "text") html = p.text?.content ?? "";
      else if (p.type === "image") html = `<figure class="mi-figura"><img src="${esc(p.src)}" alt="${esc(p.name)}">${p.image?.caption ? `<figcaption>${esc(p.image.caption)}</figcaption>` : ""}</figure>`;
      else if (p.type === "video") html = `<video controls src="${esc(p.src)}"></video>`;
      else if (p.type === "pdf") html = `<p><a href="${esc(p.src)}" target="_blank" rel="noopener"><i class="fas fa-file-pdf"></i> ${esc(p.name)}</a></p>`;
      return {
        id: p.id, nome: p.name, tipo: p.type, html,
        titulo: (p.title?.show ?? true) && !tema?.semTitulo,
        classes: api ? api.classesDe(tema) : []
      };
    });
}

function pesoPadrao() {
  const metric = game.settings.get("dnd5e", "metricWeightUnits");
  return { value: Number(game.settings.get(ID, "peso")) || 0, units: metric ? "kg" : "lb" };
}

/** Dados de um item novo a partir do jornal. */
export function dadosDoItem(journal, opcoes = {}) {
  const paginas = opcoes.paginas?.length ? opcoes.paginas : null;
  const atividade = foundry.utils.randomID();
  const resumo = opcoes.resumo ? `<p><em>${esc(opcoes.resumo)}</em></p>` : "";
  return {
    name: opcoes.nome || journal.name,
    type: "loot",
    img: opcoes.img || game.settings.get(ID, "imagem"),
    system: {
      type: { value: "documento" },
      quantity: 1,
      weight: { value: Number(opcoes.peso ?? pesoPadrao().value) || 0, units: pesoPadrao().units },
      price: { value: Number(opcoes.preco) || 0, denomination: "gp" },
      description: { value: `${resumo}<p class="mi-dica"><i class="fas fa-book-open"></i> Use o item para ler.</p>` },
      activities: {
        [atividade]: { _id: atividade, type: "utility", name: "Ler", img: "icons/svg/book.svg", activation: { type: "" } }
      }
    },
    flags: {
      [ID]: {
        doc: {
          origem: journal.uuid,
          paginas,
          sincronizar: opcoes.sincronizar !== false,
          conteudo: capturar(journal, paginas),
          atualizado: Date.now()
        }
      }
    }
  };
}

/** Todos os itens (do mundo e dos personagens) que carregam um jornal. */
export function itensDoJornal(journal) {
  const uuid = journal.uuid;
  const lista = game.items.filter((i) => dadosDoc(i)?.origem === uuid);
  for (const a of game.actors) for (const i of a.items) if (dadosDoc(i)?.origem === uuid) lista.push(i);
  return lista;
}

/** Atualiza a cópia do conteúdo nos itens sincronizados com o jornal. */
export async function sincronizar(journal) {
  for (const item of itensDoJornal(journal)) {
    const d = dadosDoc(item);
    if (d.sincronizar === false) continue;
    await item.update({ [`flags.${ID}.doc.conteudo`]: capturar(journal, d.paginas), [`flags.${ID}.doc.atualizado`]: Date.now() }, { monolithItemizador: true });
  }
}

/* ---------- Janela de criação ---------- */

/**
 * Pergunta como o jornal vira item e o cria.
 * @param {JournalEntry} journal
 * @param {{actor?: Actor, paginas?: string[]}} [pre]  Destino e páginas já escolhidos (ex.: ao arrastar).
 */
export async function itemizar(journal, pre = {}) {
  if (!journal) return null;
  const pcs = game.actors.filter((a) => a.type === "character").sort((a, b) => a.name.localeCompare(b.name));
  const destinos = [`<option value="">Itens do mundo (pasta Documentos)</option>`,
    ...pcs.map((a) => `<option value="${a.id}" ${pre.actor?.id === a.id ? "selected" : ""}>${esc(a.name)}</option>`)];
  if (pre.actor && !pcs.includes(pre.actor)) destinos.push(`<option value="${pre.actor.id}" selected>${esc(pre.actor.name)}</option>`);
  const paginas = journal.pages.contents.sort((a, b) => a.sort - b.sort).map((p) =>
    `<label class="mi-pag"><input type="checkbox" name="pag" value="${p.id}" ${!pre.paginas?.length || pre.paginas.includes(p.id) ? "checked" : ""}> ${esc(p.name)} <small>${p.type}</small></label>`).join("");
  const img = game.settings.get(ID, "imagem");
  const unidade = pesoPadrao().units;

  const r = await DialogV2.prompt({
    classes: ["mono", "monolith-itemizador-dialogo"],
    window: { title: `Transformar em item: ${journal.name}`, icon: "fas fa-scroll" },
    position: { width: 520 },
    content: `<div class="mi-form">
      <div class="mi-linha"><img class="mi-img" src="${esc(img)}" alt="" data-mi-img>
        <div class="mi-col">
          <label>Nome <input type="text" name="nome" value="${esc(journal.name)}"></label>
          <label>Imagem <span class="mi-inline"><input type="text" name="img" value="${esc(img)}"><button type="button" data-mi-escolher title="Escolher"><i class="fas fa-file-image"></i></button></span></label>
        </div></div>
      <label>Para <select name="destino">${destinos.join("")}</select></label>
      <div class="mi-linha2"><label>Peso (${unidade}) <input type="number" step="any" min="0" name="peso" value="${pesoPadrao().value}"></label>
        <label>Preço (po) <input type="number" step="any" min="0" name="preco" value="0"></label></div>
      <label>Descrição curta <textarea name="resumo" rows="2" placeholder="O que se vê por fora: um envelope lacrado, um caderno de capa gasta..."></textarea></label>
      <fieldset><legend>Páginas</legend>${paginas || "<p class='hint'>O jornal não tem páginas.</p>"}</fieldset>
      <label class="mi-check"><input type="checkbox" name="sincronizar" checked> Manter sincronizado com o jornal (edições no jornal chegam ao item)</label>
    </div>`,
    render: (ev, dialog) => {
      const el = dialog?.element ?? dialog;
      el.querySelector("[data-mi-escolher]")?.addEventListener("click", () => {
        new foundry.applications.apps.FilePicker.implementation({
          type: "image", current: el.querySelector("[name=img]").value,
          callback: (path) => { el.querySelector("[name=img]").value = path; el.querySelector("[data-mi-img]").src = path; }
        }).render(true);
      });
      el.querySelector("[name=img]")?.addEventListener("change", (e) => { el.querySelector("[data-mi-img]").src = e.target.value; });
    },
    ok: {
      label: "Criar item", icon: "fas fa-check",
      callback: (ev, btn) => {
        const f = btn.form.elements;
        const marcadas = [...btn.form.querySelectorAll("[name=pag]:checked")].map((x) => x.value);
        return { nome: f.nome.value.trim(), img: f.img.value.trim(), destino: f.destino.value, peso: f.peso.value, preco: f.preco.value, resumo: f.resumo.value.trim(), paginas: marcadas, sincronizar: f.sincronizar.checked };
      }
    }
  }).catch(() => null);
  if (!r) return null;
  if (!r.paginas.length && journal.pages.size) return ui.notifications.warn("Escolha ao menos uma página.");

  const dados = dadosDoItem(journal, r);
  let item;
  if (r.destino) {
    const actor = game.actors.get(r.destino);
    [item] = await actor.createEmbeddedDocuments("Item", [dados]);
    ui.notifications.info(`${item.name} entregue a ${actor.name}.`);
  } else {
    dados.folder = (await pastaDocumentos())?.id ?? null;
    item = await Item.implementation.create(dados);
    ui.notifications.info(`${item.name} criado nos Itens do mundo.`);
  }
  return item;
}

async function pastaDocumentos() {
  const nome = "Documentos";
  return game.folders.find((f) => f.type === "Item" && f.name === nome && !f.folder)
    ?? Folder.implementation.create({ name: nome, type: "Item", color: "#5e2b30" });
}
