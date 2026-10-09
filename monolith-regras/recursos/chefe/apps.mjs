/** Janelas do recurso Barra de Chefe: configuração, chefes da cena e opções de um chefe. */
import {
  PADROES, TEMAS, lista, salvarLista, resolver, marcar, desmarcar, entradaDe, apresentar, focar, testar
} from "./index.mjs";

const { ApplicationV2, DialogV2 } = foundry.applications.api;
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

/* ---------- Configuração ---------- */

// [chave, tipo, extra]
const GRUPOS = [
  ["vida", [["caminhoPV", "texto"], ["caminhoPVMax", "texto"], ["caminhoPVTemp", "texto"], ["feridas", "sim"]]],
  ["aparencia", [["largura", "num", { min: 20, max: 95, step: 1 }], ["altura", "num", { min: 4, max: 30, step: 1 }], ["base", "num", { min: 0, max: 600, step: 2 }],
    ["numeros", "sim"], ["dano", "sim"], ["janelaDano", "num", { min: 0.5, max: 15, step: 0.5 }], ["respeitarOculto", "sim"]]],
  ["efeitos", [["entrada", "sim"], ["rastro", "sim"], ["tremor", "sim"], ["limiarTremor", "num", { min: 1, max: 100, step: 1 }],
    ["sangue", "sim"], ["limiarSangue", "num", { min: 1, max: 99, step: 1 }], ["fases", "sim"], ["fasesPadrao", "texto"],
    ["abate", "sim"], ["textoAbate", "texto"], ["abateNoFim", "sim"], ["ocultarAbatido", "sim"]]],
  ["sons", [["somEntrada", "som"], ["somFase", "som"], ["somAbate", "som"], ["volume", "num", { min: 0, max: 1, step: 0.05 }]]]
];

function campo(ctx, chave, tipo, extra = {}, valor) {
  const id = `mcb-${chave}`;
  const rotulo = `<label for="${id}">${ctx.t(`campo.${chave}`)}</label>`;
  const dica = game.i18n.has(`MONOLITH.chefe.dica.${chave}`) ? `<p class="hint">${ctx.t(`dica.${chave}`)}</p>` : "";
  let entrada;
  if (tipo === "sim") entrada = `<input type="checkbox" id="${id}" name="${chave}" ${valor ? "checked" : ""}>`;
  else if (tipo === "num") entrada = `<input type="number" id="${id}" name="${chave}" value="${esc(valor)}" min="${extra.min}" max="${extra.max}" step="${extra.step}">`;
  else if (tipo === "som") entrada = `<div class="mcb-arquivo"><input type="text" id="${id}" name="${chave}" value="${esc(valor)}" placeholder="${ctx.t("semSom")}">
      <button type="button" data-action="arquivo" data-alvo="${chave}" data-tooltip="${ctx.t("escolher")}"><i class="fa-solid fa-file-audio"></i></button>
      <button type="button" data-action="ouvir" data-alvo="${chave}" data-tooltip="${ctx.t("ouvir")}"><i class="fa-solid fa-play"></i></button></div>`;
  else entrada = `<input type="text" id="${id}" name="${chave}" value="${esc(valor)}">`;
  return `<div class="mcb-campo">${rotulo}${entrada}${dica}</div>`;
}

class JanelaConfig extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "monolith-chefe-config",
    classes: ["mono", "monolith-chefe-janela"],
    tag: "form",
    window: { title: "Barra de Chefe", icon: "fa-solid fa-skull", resizable: true },
    position: { width: 560, height: Math.min(780, window.innerHeight - 80) },
    form: { handler: JanelaConfig.#salvar, closeOnSubmit: true },
    actions: { arquivo: JanelaConfig.#arquivo, ouvir: JanelaConfig.#ouvir, testar: JanelaConfig.#testar, padroes: JanelaConfig.#padroes, chefes: JanelaConfig.#chefes }
  };

  constructor(ctx, opcoes = {}) { super(opcoes); this.ctx = ctx; }

  async _renderHTML() {
    const c = this.ctx;
    const grupos = GRUPOS.map(([g, campos]) => `<fieldset><legend>${c.t(`grupo.${g}`)}</legend>
      ${campos.map(([k, tipo, extra]) => campo(c, k, tipo, extra, this.valores?.[k] ?? c.get(k))).join("")}</fieldset>`).join("");
    return `${grupos}
      <footer class="mcb-rodape">
        <button type="button" data-action="chefes"><i class="fa-solid fa-skull"></i> ${c.t("chefesDaCena")}</button>
        <button type="button" data-action="testar"><i class="fa-solid fa-play"></i> ${c.t("testar")}</button>
        <button type="button" data-action="padroes"><i class="fa-solid fa-rotate-left"></i> ${c.t("padroes")}</button>
        <button type="submit"><i class="fa-solid fa-save"></i> ${c.t("salvar")}</button>
      </footer>`;
  }

  _replaceHTML(result, content) { content.innerHTML = result; }

  static #ler(form) {
    const out = {};
    for (const [k, padrao] of Object.entries(PADROES)) {
      const el = form.elements[k];
      if (!el) continue;
      if (typeof padrao === "boolean") out[k] = el.checked;
      else if (typeof padrao === "number") out[k] = Number.isFinite(Number(el.value)) && el.value !== "" ? Number(el.value) : padrao;
      else out[k] = String(el.value ?? "").trim();
    }
    return out;
  }

  static async #salvar(ev, form) {
    const novos = JanelaConfig.#ler(form);
    for (const [k, v] of Object.entries(novos)) if (this.ctx.get(k) !== v) await this.ctx.set(k, v);
  }

  static #arquivo(ev, el) {
    const input = this.element.elements[el.dataset.alvo];
    const FP = foundry.applications.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    new FP({ type: "audio", current: input.value, callback: (p) => { input.value = p; } }).render(true);
  }

  static #ouvir(ev, el) {
    const src = this.element.elements[el.dataset.alvo]?.value;
    if (!src) return;
    const vol = Number(this.element.elements.volume?.value) || 0.6;
    (foundry.audio?.AudioHelper ?? globalThis.AudioHelper)?.play({ src, volume: vol, autoplay: true, loop: false }, false);
  }

  static #testar() { testar(); }

  static #padroes() {
    this.valores = { ...PADROES };
    this.render();
  }

  static #chefes() { abrirChefes(this.ctx); }

  _onClose(o) { super._onClose(o); this.valores = null; }
}

export function abrirConfig(ctx) {
  const app = foundry.applications.instances.get("monolith-chefe-config") ?? new JanelaConfig(ctx);
  app.render({ force: true });
  return app;
}

/* ---------- Chefes da cena ---------- */

class JanelaChefes extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "monolith-chefe-cena",
    classes: ["mono", "monolith-chefe-janela"],
    window: { title: "Chefes da cena", icon: "fa-solid fa-skull", resizable: true },
    position: { width: 520, height: "auto" },
    actions: {
      adicionar: JanelaChefes.#adicionar, editar: JanelaChefes.#editar, olho: JanelaChefes.#olho, remover: JanelaChefes.#remover,
      focar: JanelaChefes.#focar, apresentar: JanelaChefes.#apresentar, apresentarFocar: JanelaChefes.#apresentarFocar, config: JanelaChefes.#config
    }
  };

  constructor(ctx, opcoes = {}) { super(opcoes); this.ctx = ctx; }

  get scene() { return game.scenes.viewed; }

  get title() { return `${this.ctx.t("chefesDaCena")}${this.scene ? `: ${this.scene.name}` : ""}`; }

  async _renderHTML() {
    const c = this.ctx;
    const scene = this.scene;
    if (!scene) return `<p class="mcb-vazio">${c.t("semCena")}</p>`;
    const itens = lista(scene).map((e) => {
      const r = resolver(e, scene);
      const nome = e.nome || r?.token?.name || r?.actor?.name || c.t("perdido");
      const img = r?.token?.texture?.src || r?.actor?.img || "icons/svg/skull.svg";
      const sub = [e.epiteto, TEMAS[e.tema] ?? ""].filter(Boolean).join(" · ");
      return `<li class="${e.oculto ? "oculto" : ""}" data-id="${e.id}">
        <img src="${esc(img)}" alt="">
        <div class="mcb-txt"><b>${esc(nome)}</b><small>${esc(sub)}</small></div>
        <button type="button" data-action="olho" data-tooltip="${c.t(e.oculto ? "mostrar" : "esconder")}"><i class="fa-solid ${e.oculto ? "fa-eye-slash" : "fa-eye"}"></i></button>
        <button type="button" data-action="focar" data-tooltip="${c.t("focar")}" ${r?.token ? "" : "disabled"}><i class="fa-solid fa-crosshairs"></i></button>
        <button type="button" data-action="editar" data-tooltip="${c.t("editar")}"><i class="fa-solid fa-pen"></i></button>
        <button type="button" data-action="remover" data-tooltip="${c.t("remover")}"><i class="fa-solid fa-trash"></i></button>
      </li>`;
    }).join("");
    return `<ul class="mcb-lista">${itens || `<li class="mcb-vazio">${c.t("nenhum")}</li>`}</ul>
      <p class="hint" style="color:var(--ink-muted);font-size:12px">${c.t("dicaHud")}</p>
      <footer class="mcb-rodape">
        <button type="button" data-action="adicionar"><i class="fa-solid fa-plus"></i> ${c.t("adicionar")}</button>
        <button type="button" data-action="apresentar"><i class="fa-solid fa-bullhorn"></i> ${c.t("apresentar")}</button>
        <button type="button" data-action="apresentarFocar"><i class="fa-solid fa-video"></i> ${c.t("apresentarFocar")}</button>
        <button type="button" data-action="config"><i class="fa-solid fa-sliders"></i></button>
      </footer>`;
  }

  _replaceHTML(result, content) { content.innerHTML = result; }

  #entrada(el) {
    const id = el.closest("[data-id]")?.dataset.id;
    return lista(this.scene).find((e) => e.id === id);
  }

  async #mudar(id, fn) {
    const l = lista(this.scene);
    const i = l.findIndex((e) => e.id === id);
    if (i < 0) return;
    const r = fn(l[i], l, i);
    await salvarLista(this.scene, r === null ? l.filter((_, j) => j !== i) : l);
  }

  static async #adicionar() {
    const sel = canvas.tokens?.controlled ?? [];
    if (!sel.length) return ui.notifications.info(this.ctx.t("selecione"));
    for (const t of sel) if (!entradaDe(t.document)) await marcar(t.document);
  }

  static #editar(ev, el) {
    const e = this.#entrada(el);
    if (!e) return;
    const r = resolver(e, this.scene);
    editarChefe(this.ctx, r?.token, { scene: this.scene, id: e.id });
  }

  static async #olho(ev, el) {
    const e = this.#entrada(el);
    if (e) await this.#mudar(e.id, (x) => { x.oculto = !x.oculto; });
  }

  static async #remover(ev, el) {
    const e = this.#entrada(el);
    if (e) await this.#mudar(e.id, () => null);
  }

  static #focar(ev, el) {
    const e = this.#entrada(el);
    const t = e && resolver(e, this.scene)?.token;
    if (t) focar(t);
  }

  static #apresentar() { apresentar(); }

  static #apresentarFocar() {
    apresentar();
    const e = lista(this.scene).find((x) => !x.oculto && resolver(x, this.scene)?.token);
    if (e) focar(resolver(e, this.scene).token, 1.8);
  }

  static #config() { abrirConfig(this.ctx); }
}

export function abrirChefes(ctx) {
  const app = foundry.applications.instances.get("monolith-chefe-cena") ?? new JanelaChefes(ctx);
  app.render({ force: true });
  return app;
}

Hooks.on("updateScene", (scene) => {
  const app = foundry.applications.instances.get("monolith-chefe-cena");
  if (app?.rendered && scene === game.scenes.viewed) app.render();
});
Hooks.on("canvasReady", () => {
  const app = foundry.applications.instances.get("monolith-chefe-cena");
  if (app?.rendered) app.render();
});

/* ---------- Opções de um chefe (clique direito na caveira do HUD) ---------- */

/**
 * @param ctx
 * @param {TokenDocument|null} token
 * @param {{scene?: Scene, id?: string}} [ref]  entrada já existente (quando o token sumiu ou veio de outro lugar)
 */
export async function editarChefe(ctx, token, ref = {}) {
  if (!game.user.isGM) return;
  const scene = ref.scene ?? token?.parent;
  if (!scene) return;
  const atual = ref.id ? lista(scene).find((e) => e.id === ref.id) : entradaDe(token);
  const e = atual ?? { nome: "", epiteto: "", fases: "", tema: "sangue", ocultarPV: false, ocultarNome: false, oculto: false };
  const nomeBase = token?.name ?? "";
  const temas = Object.entries(TEMAS).map(([k, v]) => `<option value="${k}" ${e.tema === k ? "selected" : ""}>${v}</option>`).join("");
  const linha = (rot, html, dica = "") => `<div class="mcb-campo"><label>${rot}</label>${html}${dica ? `<p class="hint">${dica}</p>` : ""}</div>`;
  const content = `
    ${linha(ctx.t("campo.nome"), `<input type="text" name="nome" value="${esc(e.nome)}" placeholder="${esc(nomeBase)}">`)}
    ${linha(ctx.t("campo.epiteto"), `<input type="text" name="epiteto" value="${esc(e.epiteto)}" placeholder="Senhor das Cinzas">`)}
    ${linha(ctx.t("campo.fasesChefe"), `<input type="text" name="fases" value="${esc(e.fases)}" placeholder="${esc(ctx.get("fasesPadrao") || "50")}">`, ctx.t("dica.fasesChefe"))}
    ${linha(ctx.t("campo.tema"), `<select name="tema">${temas}</select>`)}
    ${linha(ctx.t("campo.ocultarPV"), `<input type="checkbox" name="ocultarPV" ${e.ocultarPV ? "checked" : ""}>`, ctx.t("dica.ocultarPV"))}
    ${linha(ctx.t("campo.ocultarNome"), `<input type="checkbox" name="ocultarNome" ${e.ocultarNome ? "checked" : ""}>`)}
    ${linha(ctx.t("campo.oculto"), `<input type="checkbox" name="oculto" ${e.oculto ? "checked" : ""}>`, ctx.t("dica.oculto"))}`;

  const ler = (btn) => {
    const f = btn.form.elements;
    return { nome: f.nome.value.trim(), epiteto: f.epiteto.value.trim(), fases: f.fases.value.trim(), tema: f.tema.value,
      ocultarPV: f.ocultarPV.checked, ocultarNome: f.ocultarNome.checked, oculto: f.oculto.checked };
  };
  const buttons = [{ action: "salvar", label: ctx.t(atual ? "salvar" : "marcarChefe"), icon: "fa-solid fa-skull", default: true, callback: (ev, btn) => ({ acao: "salvar", dados: ler(btn) }) }];
  if (atual) {
    buttons.push({ action: "apresentar", label: ctx.t("apresentar"), icon: "fa-solid fa-bullhorn", callback: (ev, btn) => ({ acao: "apresentar", dados: ler(btn) }) });
    buttons.push({ action: "remover", label: ctx.t("remover"), icon: "fa-solid fa-trash", callback: () => ({ acao: "remover" }) });
  }

  const r = await DialogV2.wait({
    window: { title: `${ctx.t("opcoesChefe")}${nomeBase ? `: ${nomeBase}` : ""}`, icon: "fa-solid fa-skull" },
    classes: ["mono", "monolith-chefe-janela", "monolith-chefe-dialogo"],
    position: { width: 480 },
    content, buttons, rejectClose: false
  }).catch(() => null);
  if (!r?.acao) return;

  if (r.acao === "remover") {
    if (token && !ref.id) return desmarcar(token);
    return salvarLista(scene, lista(scene).filter((x) => x.id !== atual.id));
  }
  if (atual && (ref.id || !token)) {
    const l = lista(scene);
    const alvo = l.find((x) => x.id === atual.id);
    if (alvo) Object.assign(alvo, r.dados);
    await salvarLista(scene, l);
  } else {
    await marcar(token, r.dados);
  }
  if (r.acao === "apresentar") apresentar(atual?.id);
}
