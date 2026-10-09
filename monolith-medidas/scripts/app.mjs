import { ID, esc, lista, ajustarRetratos } from "./config.mjs";
import {
  estado, usarMedida, consumirArmada, ajustarMarcadas, queimarAlma, encerrarQueima, danoNaQueima,
  inspiracaoDoMoribundo, nomeQueFica, confirmar
} from "./fio.mjs";

const { ApplicationV2 } = foundry.applications.api;

const ROTULO_EFEITO = { enfase: "Ênfase", rolar: "Rola", espaco: "Espaço", macro: "Macro" };

/** Painel de Medidas Desesperadas de um personagem. */
export class MedidasApp extends ApplicationV2 {
  static instancias = new Map();

  static abrir(actor) {
    if (!actor) return;
    let app = this.instancias.get(actor.id);
    if (!app) { app = new this(actor); this.instancias.set(actor.id, app); }
    app.render({ force: true });
    return app;
  }

  static atualizar(actor) {
    const app = this.instancias.get(actor?.id);
    if (app?.rendered) app.render();
  }

  static atualizarTodos() {
    for (const app of this.instancias.values()) if (app.rendered) app.render();
  }

  constructor(actor, options = {}) {
    super({ ...options, id: `monolith-medidas-${actor.id}` });
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    classes: ["mono", "monolith-medidas"],
    window: { title: "Medidas Desesperadas", icon: "fas fa-heart-crack", resizable: true },
    position: { width: 560, height: Math.min(760, window.innerHeight - 100) },
    actions: {
      medida: MedidasApp.#medida,
      consumir: MedidasApp.#consumir,
      marcadas: MedidasApp.#marcadas,
      queimar: MedidasApp.#queimar,
      encerrar: MedidasApp.#encerrar,
      danoQueima: MedidasApp.#danoQueima,
      recusar: MedidasApp.#recusar,
      moribundo: MedidasApp.#moribundo,
      nome: MedidasApp.#nome,
      perdicao: MedidasApp.#perdicao,
      editor: MedidasApp.#editor
    }
  };

  get title() { return `Medidas Desesperadas: ${this.actor.name}`; }

  async _renderHTML() {
    const a = this.actor;
    const e = estado(a);
    const gm = game.user.isGM;

    const caixas = [0, 1, 2].map((i) => {
      if (i < e.marcadas) return `<span class="fio marcada" data-tooltip="Falha marcada: só o descanso apaga">✖</span>`;
      if (i < e.falhas) return `<span class="fio comum" data-tooltip="Falha comum">●</span>`;
      return `<span class="fio vazia" data-tooltip="Vazia"></span>`;
    }).join("");

    let tags = `<span class="tag">PV ${e.hp}/${e.max}</span>`;
    if (e.morto) tags += `<span class="tag morto">Morto</span>`;
    else if (e.queimando) tags += `<span class="tag queima">Queimando a Alma</span>`;
    else if (e.morrendo) tags += `<span class="tag forte">Morrendo</span>`;
    else if (e.sangrando) tags += `<span class="tag forte">Sangrando</span>`;

    const grupos = [1, 2, 3].map((custo) => {
      const itens = lista().filter((m) => (Number(m.custo) || 1) === custo);
      if (!itens.length) return "";
      const cards = itens.map((m) => {
        const pode = e.abertas && custo <= e.livres;
        const selos = [ROTULO_EFEITO[m.efeito], m.armada ? "Armada" : ""].filter(Boolean).map((s) => `<span class="selo">${s}</span>`).join("");
        return `<button type="button" class="medida ${pode ? "" : "off"}" data-action="medida" data-id="${esc(m.id)}" ${pode ? "" : "disabled"}>
          <span class="linha"><span class="nome">${esc(m.nome)}</span>${selos}</span>
          <span class="texto">${esc(m.texto)}</span></button>`;
      }).join("");
      return `<div class="grupo"><div class="custo"><span>${"✖".repeat(custo)}</span> ${custo} falha${custo > 1 ? "s" : ""}</div><div class="cards">${cards}</div></div>`;
    }).join("");

    const armadas = e.armadas.length ? `<section><h3>Armadas</h3><ul class="armadas">${e.armadas.map((m, i) =>
      `<li><span>${esc(m.nome)}</span><button type="button" data-action="consumir" data-index="${i}"><i class="fas fa-check"></i> Usada</button></li>`).join("")}</ul>
      <p class="hint">Expiram ao fim de uma Vigília ou de um Descanso Completo.</p></section>` : "";

    let morte = "";
    if (e.morrendo && !e.queimando) morte += `<button type="button" data-action="queimar"><i class="fas fa-fire"></i> Queimar a Alma</button>
      <button type="button" data-action="moribundo"><i class="fas fa-hand-holding-heart"></i> Conceder Inspiração Heróica</button>`;
    if (e.queimando) morte += `<button type="button" data-action="danoQueima" data-n="1"><i class="fas fa-burst"></i> Dano (+1 falha)</button>
      <button type="button" data-action="danoQueima" data-n="2"><i class="fas fa-explosion"></i> Crítico (+2)</button>
      <button type="button" data-action="encerrar"><i class="fas fa-fire-flame-simple"></i> Encerrar a Queima</button>`;
    if (e.morto && !e.recusou) morte += `<button type="button" data-action="recusar"><i class="fas fa-hand-fist"></i> Recusar a Morte</button>`;
    if (e.morto) morte += `<button type="button" data-action="nome"><i class="fas fa-feather"></i> O Nome que Fica</button>`;
    morte = morte ? `<section class="morte"><h3>Morte</h3><div class="botoes">${morte}</div></section>` : "";

    const mestre = gm ? `<section class="mestre"><h3>Mestre</h3><div class="botoes">
      <button type="button" data-action="marcadas" data-d="-1"><i class="fas fa-minus"></i> Marcada</button>
      <button type="button" data-action="marcadas" data-d="1"><i class="fas fa-plus"></i> Marcada</button>
      <button type="button" data-action="editor"><i class="fas fa-pen-to-square"></i> Editar Medidas</button>
    </div></section>` : "";

    const aviso = e.abertas ? "" : `<p class="aviso"><i class="fas fa-lock"></i> As Medidas se abrem quando o personagem está Sangrando (metade dos PV ou menos).</p>`;

    return `<div class="mm-body">
      <header class="mm-topo">
        <div class="retrato"><img src="${a.img}" alt=""></div>
        <div class="id"><h2>${esc(a.name)}</h2><div class="tags">${tags}</div></div>
        <div class="fio-bloco"><div class="fio-caixas">${caixas}</div><span class="hint">${e.livres} caixa(s) livre(s)</span></div>
      </header>
      ${morte}
      ${armadas}
      <section><h3>Medidas</h3>${aviso}${grupos}</section>
      ${mestre}
    </div>`;
  }

  _replaceHTML(result, content) {
    const scroll = content.scrollTop;
    content.innerHTML = result;
    content.scrollTop = scroll;
    ajustarRetratos(content);
  }

  _onClose(options) {
    super._onClose(options);
    MedidasApp.instancias.delete(this.actor.id);
  }

  static async #medida(ev, el) { await usarMedida(this.actor, el.dataset.id); }
  static async #consumir(ev, el) { await consumirArmada(this.actor, Number(el.dataset.index)); }
  static async #marcadas(ev, el) { await ajustarMarcadas(this.actor, Number(el.dataset.d)); }
  static async #queimar() { if (await confirmar("Queimar a Alma", "Ganhar 1d4 de Perdição e se levantar com 0 PV?")) await queimarAlma(this.actor); }
  static async #encerrar() { await encerrarQueima(this.actor); }
  static async #danoQueima(ev, el) { await danoNaQueima(this.actor, Number(el.dataset.n)); }
  static async #recusar() { if (await confirmar("Recusar a Morte", "Uma única vez: voltar queimando com 2 falhas no Fio e 1d8 de Perdição?")) await queimarAlma(this.actor, { recusa: true }); }
  static async #moribundo() { await inspiracaoDoMoribundo(this.actor); }
  static async #nome() { await nomeQueFica(this.actor); }
  static #perdicao() { game.modules.get("monolith-perdicao")?.api?.abrir(this.actor); }
  static #editor() { game.modules.get(ID).api.abrirEditor(); }
}

