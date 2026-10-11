/**
 * Recurso "Editar selecionadas": com várias luzes (ou sons, tiles, paredes, desenhos, notas, tokens) selecionadas,
 * a janela de configuração de uma delas mostra "Aplicar às N selecionadas". Ao salvar, só os campos que mudaram
 * vão para as outras; o resto de cada uma fica como estava, e a posição nunca é copiada.
 * Escrito para Monolith (não usa código do Mass Edit).
 */

/** Tipo de documento → camada do canvas onde ficam os selecionados. */
const CAMADAS = {
  AmbientLight: "lighting",
  AmbientSound: "sounds",
  Tile: "tiles",
  Wall: "walls",
  Drawing: "drawings",
  Note: "notes",
  Token: "tokens"
};

/** Campos que nunca vão para as outras: posição, ligação e identidade. */
const NUNCA = /^(_id|x|y|c|sort|shape\.(x|y)|actorId|actorLink|delta(\.|$)|_stats)(\.|$)/;

let C = null;

/** Os outros documentos selecionados do mesmo tipo e da mesma cena, que este usuário pode editar. */
function outrosSelecionados(doc) {
  const camada = canvas?.[CAMADAS[doc?.documentName]];
  if (!camada || doc.parent !== canvas.scene) return [];
  return camada.controlled.map((p) => p.document).filter((d) => d && d.id !== doc.id && d.canUserModify(game.user, "update"));
}

/** Só o que mudou em relação ao documento antes de salvar, em chaves achatadas. */
function mudancas(antes, envio) {
  const plano = foundry.utils.flattenObject(envio ?? {});
  const out = {};
  for (const [k, v] of Object.entries(plano)) {
    if (NUNCA.test(k)) continue;
    const atual = foundry.utils.getProperty(antes, k);
    if (!foundry.utils.objectsEqual?.(atual, v) && JSON.stringify(atual) !== JSON.stringify(v)) out[k] = v;
  }
  return out;
}

function aoDesenhar(app, html) {
  const doc = app.document;
  if (!doc || !(doc.documentName in CAMADAS)) return;
  const outros = outrosSelecionados(doc);
  app._monolithMassa = outros.map((d) => d.id);
  const raiz = html instanceof HTMLElement ? html : html?.[0];
  const form = raiz?.tagName === "FORM" ? raiz : raiz?.querySelector("form") ?? app.element?.querySelector("form") ?? app.element;
  form?.querySelector(".monolith-massa")?.remove();
  if (!outros.length || !form) return;
  const caixa = document.createElement("label");
  caixa.className = "monolith-massa";
  caixa.innerHTML = `<input type="checkbox" name="monolithMassa" checked> <i class="fas fa-layer-group"></i> ${C.t("aplicar", { n: outros.length })}`;
  caixa.dataset.tooltip = C.t("dica");
  const rodape = form.querySelector(".form-footer, footer");
  if (rodape) rodape.before(caixa);
  else form.append(caixa);
}

/** Depois de salvar o documento aberto, aplica as mesmas mudanças às outras selecionadas. */
async function aplicar(app, antes, envio, form) {
  const ids = app._monolithMassa ?? [];
  if (!ids.length || !form?.querySelector('[name="monolithMassa"]')?.checked) return;
  const doc = app.document;
  const plano = mudancas(antes, envio);
  if (!Object.keys(plano).length) return;
  const cena = doc.parent;
  const existentes = ids.filter((id) => cena.getEmbeddedDocument(doc.documentName, id));
  const updates = existentes.map((id) => ({ _id: id, ...foundry.utils.expandObject(plano) }));
  await cena.updateEmbeddedDocuments(doc.documentName, updates);
  ui.notifications.info(C.t("feito", { n: updates.length, campos: Object.keys(plano).length }));
}

function envolverSalvar() {
  const alvo = "foundry.applications.api.DocumentSheetV2.prototype._processSubmitData";
  const embrulho = async function (wrapped, event, form, submitData, ...rest) {
    const ehDoMapa = this.document && (this.document.documentName in CAMADAS) && this._monolithMassa?.length;
    const antes = ehDoMapa ? this.document.toObject() : null;
    const r = await wrapped(event, form, submitData, ...rest);
    if (ehDoMapa) await aplicar(this, antes, submitData, form).catch((err) => console.error(`${C.ID} | editar selecionadas`, err));
    return r;
  };
  if (globalThis.libWrapper && game.modules.get("lib-wrapper")?.active) {
    libWrapper.register(C.ID, alvo, embrulho, "WRAPPER");
    return;
  }
  const proto = foundry.applications.api.DocumentSheetV2.prototype;
  const original = proto._processSubmitData;
  proto._processSubmitData = function (...args) { return embrulho.call(this, (...a) => original.apply(this, a), ...args); };
}

export default {
  id: "massa",
  nome: "Editar selecionadas",
  descricao: "Com várias luzes, sons, tiles, paredes, desenhos, notas ou tokens selecionados, a configuração de um deles pode ser aplicada a todos: só os campos que você mudar, sem mexer na posição.",
  original: ["multi-token-edit"],
  padrao: true,
  iniciar(ctx) {
    C = ctx;
    Hooks.on("renderDocumentSheetV2", aoDesenhar);
    Hooks.once("ready", envolverSalvar);
  }
};
