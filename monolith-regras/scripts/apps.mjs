import { ID, F, getF, esc, personagens, chat, rolar, escolherPersonagem, confirmar } from "./util.mjs";
import {
  MEDIDAS, estado, usarMedida, consumirArmada, ajustarMarcadas, ajustarPerdicao,
  queimarAlma, encerrarQueima, danoNaQueima, inspiracaoDoMoribundo, nomeQueFica
} from "./medidas.mjs";
import { armarEnfase, rolarEnfaseSolta } from "./enfase.mjs";
import { DESCRICOES } from "./exaustao.mjs";

const { ApplicationV2 } = foundry.applications.api;

export function perdicaoVisivel(actor) {
  return game.user.isGM || (actor.isOwner && game.settings.get(ID, "perdicaoVisivel"));
}

/* =========================================================
 *  Painel de Medidas Desesperadas (um por personagem)
 * ========================================================= */

export class MedidasApp extends ApplicationV2 {
  static instancias = new Map();

  static abrir(actor) {
    let app = this.instancias.get(actor.id);
    if (!app) { app = new this(actor); this.instancias.set(actor.id, app); }
    app.render({ force: true });
    return app;
  }

  static atualizar(actor) {
    const app = this.instancias.get(actor.id);
    if (app?.rendered) app.render();
  }

  constructor(actor, options = {}) {
    super({ ...options, id: `monolith-medidas-${actor.id}` });
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    classes: ["mono", "monolith-app", "monolith-medidas"],
    window: { title: "Medidas Desesperadas", icon: "fas fa-heart-crack", resizable: true },
    position: { width: 400, height: "auto" },
    actions: {
      medida: MedidasApp.#medida,
      consumir: MedidasApp.#consumir,
      marcadas: MedidasApp.#marcadas,
      perdicao: MedidasApp.#perdicao,
      queimar: MedidasApp.#queimar,
      encerrar: MedidasApp.#encerrar,
      danoQueima: MedidasApp.#danoQueima,
      recusar: MedidasApp.#recusar,
      moribundo: MedidasApp.#moribundo,
      nome: MedidasApp.#nome,
      enfase: MedidasApp.#enfase
    }
  };

  get title() { return `Medidas Desesperadas: ${this.actor.name}`; }

  async _renderHTML() {
    const a = this.actor;
    const e = estado(a);
    const gm = game.user.isGM;
    const caixas = [0, 1, 2].map(i => {
      if (i < e.marcadas) return `<span class="fio marcada" data-tooltip="Falha marcada (só o descanso apaga)">✖</span>`;
      if (i < e.falhas) return `<span class="fio comum" data-tooltip="Falha comum">●</span>`;
      return `<span class="fio vazia" data-tooltip="Vazia"></span>`;
    }).join("");

    let situacao = `<span class="tag">PV ${e.hp}/${e.max}</span>`;
    if (e.morto) situacao += `<span class="tag morto">Morto</span>`;
    else if (e.queimando) situacao += `<span class="tag queima">Queimando a Alma</span>`;
    else if (e.morrendo) situacao += `<span class="tag morrendo">Morrendo</span>`;
    else if (e.sangrando) situacao += `<span class="tag sangrando">Sangrando</span>`;
    if (perdicaoVisivel(a)) situacao += `<span class="tag perdicao" data-tooltip="Perdição">Perdição ${e.perdicao}</span>`;

    const abertas = (e.sangrando || e.queimando) && !e.morto;
    const linhas = MEDIDAS.map(m => {
      const pode = abertas && m.custo <= e.livres;
      return `<li class="${pode ? "" : "off"}">
        <button type="button" data-action="medida" data-id="${m.id}" ${pode ? "" : "disabled"}>
          <span class="custo">${"✖".repeat(m.custo)}</span><span class="nome">${m.nome}</span></button>
        <p>${m.texto}</p></li>`;
    }).join("");

    const armadas = e.armadas.length ? `<section><h3>Armadas</h3><ul class="armadas">${e.armadas.map((m, i) =>
      `<li><span>${esc(m.nome)}</span><button type="button" data-action="consumir" data-index="${i}">Usada</button></li>`).join("")}</ul>
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
      <button type="button" data-action="marcadas" data-d="-1">Marcadas −</button>
      <button type="button" data-action="marcadas" data-d="1">Marcadas +</button>
      <button type="button" data-action="perdicao" data-d="-1">Perdição −</button>
      <button type="button" data-action="perdicao" data-d="1">Perdição +</button>
      <button type="button" data-action="enfase">${getF(a, F.enfase, false) ? "Desarmar" : "Armar"} Ênfase</button>
    </div></section>` : "";

    return `<div class="monolith-medidas-body">
      <header class="topo"><img src="${a.img}" alt=""><div><h2>${esc(a.name)}</h2><div class="tags">${situacao}</div></div></header>
      <section class="fio-sec"><h3>O Fio</h3><div class="fio-caixas">${caixas}</div>
        <p class="hint">✖ marcada · ● comum · ${e.livres} vazia(s)</p></section>
      ${morte}
      ${armadas}
      <section><h3>Medidas</h3>${abertas ? "" : `<p class="hint">Abrem quando o personagem está Sangrando (metade dos PV ou menos).</p>`}
        <ul class="lista-medidas">${linhas}</ul></section>
      ${mestre}
    </div>`;
  }

  _replaceHTML(result, content) { content.innerHTML = result; }

  _onClose(options) {
    super._onClose(options);
    MedidasApp.instancias.delete(this.actor.id);
  }

  static async #medida(ev, el) { await usarMedida(this.actor, el.dataset.id); }
  static async #consumir(ev, el) { await consumirArmada(this.actor, Number(el.dataset.index)); }
  static async #marcadas(ev, el) { await ajustarMarcadas(this.actor, Number(el.dataset.d)); }
  static async #perdicao(ev, el) { await ajustarPerdicao(this.actor, Number(el.dataset.d), "ajuste do Mestre"); }
  static async #queimar() { if (await confirmar("Queimar a Alma", "Ganhar 1d4 de Perdição e se levantar com 0 PV?")) await queimarAlma(this.actor); }
  static async #encerrar() { await encerrarQueima(this.actor); }
  static async #danoQueima(ev, el) { await danoNaQueima(this.actor, Number(el.dataset.n)); }
  static async #recusar() { if (await confirmar("Recusar a Morte", "Uma única vez: voltar queimando com 2 falhas no Fio e 1d8 de Perdição?")) await queimarAlma(this.actor, { recusa: true }); }
  static async #moribundo() { await inspiracaoDoMoribundo(this.actor); }
  static async #nome() { await nomeQueFica(this.actor); }
  static async #enfase() { await armarEnfase(this.actor, !getF(this.actor, F.enfase, false)); }
}

/* =========================================================
 *  Painel flutuante de Inspiração (fora da ficha)
 * ========================================================= */

export const HUD = {
  el: null,

  montar() {
    if (!game.settings.get(ID, "mostrarHud")) return this.desmontar();
    if (!this.el) {
      this.el = document.createElement("div");
      this.el.id = "monolith-hud";
      document.body.appendChild(this.el);
      this.el.addEventListener("click", ev => this.clique(ev));
      this.el.addEventListener("contextmenu", ev => this.clique(ev, true));
      this.arrastavel();
    }
    const pos = game.settings.get(ID, "posicaoHud");
    if (pos?.left !== undefined) Object.assign(this.el.style, { left: `${pos.left}px`, top: `${pos.top}px`, bottom: "auto" });
    this.render();
  },

  desmontar() { this.el?.remove(); this.el = null; },

  render() {
    if (!this.el) return;
    const gm = game.user.isGM;
    const recolhido = game.settings.get(ID, "hudRecolhido");
    const linhas = personagens().map(a => {
      const insp = !!a.system.attributes.inspiration;
      const her = getF(a, F.heroica);
      const ex = a.system.attributes.exhaustion ?? 0;
      return `<li data-actor="${a.id}">
        <img src="${a.img}" alt="" data-acao="medidas" data-tooltip="Medidas Desesperadas">
        <span class="nome" data-acao="ficha">${esc(a.name)}</span>
        <button class="insp ${insp ? "on" : ""}" data-acao="inspiracao" data-tooltip="Inspiração ${insp ? "(clique para gastar)" : ""}${gm ? "<br>Mestre: botão direito concede" : ""}"><i class="fa${insp ? "s" : "r"} fa-star"></i></button>
        <span class="her" data-tooltip="Inspiração Heróica: clique para gastar (+1d4)${gm ? "<br>botão direito: +1" : ""}" data-acao="heroica"><i class="fas fa-dice-d6"></i> ${her}</span>
        <button data-acao="dar" data-tooltip="Dar uma Inspiração Heróica a outro personagem" ${her ? "" : "disabled"}><i class="fas fa-hand-holding-heart"></i></button>
        ${ex ? `<span class="ex" data-tooltip="Exaustão ${ex}: ${DESCRICOES[ex] ?? ""}">${ex}</span>` : ""}
      </li>`;
    }).join("");
    this.el.classList.toggle("recolhido", !!recolhido);
    this.el.innerHTML = `
      <header data-arrastar>
        <i class="fas fa-grip-vertical"></i><span>Monolith</span>
        <span class="acoes">
          <a data-acao="enfase" data-tooltip="Rolar com Ênfase"><i class="fas fa-arrows-left-right-to-line"></i></a>
          ${gm ? `<a data-acao="descanso" data-tooltip="Pedir descanso"><i class="fas fa-bed"></i></a>` : ""}
          <a data-acao="recolher" data-tooltip="${recolhido ? "Expandir" : "Recolher"}"><i class="fas fa-${recolhido ? "plus" : "minus"}"></i></a>
        </span>
      </header>
      <ul>${linhas || `<li class="vazio">Nenhum personagem.</li>`}</ul>`;
  },

  async clique(ev, direito = false) {
    const alvo = ev.target.closest("[data-acao]");
    if (!alvo) return;
    if (direito) ev.preventDefault();
    const acao = alvo.dataset.acao;
    const actor = game.actors.get(alvo.closest("[data-actor]")?.dataset.actor);
    switch (acao) {
      case "recolher": return game.settings.set(ID, "hudRecolhido", !game.settings.get(ID, "hudRecolhido")).then(() => this.render());
      case "descanso": return abrirPedidoDeDescanso();
      case "enfase": return rolarEnfaseSolta(game.user.character ?? personagens()[0] ?? null);
      case "ficha": return actor?.sheet.render(true);
      case "medidas": return actor && MedidasApp.abrir(actor);
      case "inspiracao": return direito ? concederInspiracao(actor) : gastarInspiracao(actor);
      case "heroica": return direito ? concederHeroica(actor) : gastarHeroica(actor);
      case "dar": return darHeroica(actor);
    }
  },

  arrastavel() {
    let ini = null;
    this.el.addEventListener("pointerdown", ev => {
      if (!ev.target.closest("[data-arrastar]") || ev.target.closest("[data-acao]")) return;
      const r = this.el.getBoundingClientRect();
      ini = { x: ev.clientX - r.left, y: ev.clientY - r.top };
      this.el.setPointerCapture(ev.pointerId);
    });
    this.el.addEventListener("pointermove", ev => {
      if (!ini) return;
      Object.assign(this.el.style, { left: `${ev.clientX - ini.x}px`, top: `${ev.clientY - ini.y}px`, bottom: "auto" });
    });
    this.el.addEventListener("pointerup", ev => {
      if (!ini) return;
      ini = null;
      const r = this.el.getBoundingClientRect();
      game.settings.set(ID, "posicaoHud", { left: Math.round(r.left), top: Math.round(r.top) });
    });
  }
};

function abrirPedidoDeDescanso() {
  const api = game.modules.get("monolith-resting");
  if (!api?.active) return ui.notifications.warn("Ative o módulo Monolith: Resting Rules para pedir descansos.");
  return api.api?.abrirPedido();
}

/* ---------- Inspiração e Inspiração Heróica ---------- */

export async function concederInspiracao(actor) {
  if (!game.user.isGM || !actor) return;
  if (actor.system.attributes.inspiration) {
    // Já tinha Inspiração guardada: ganha uma Inspiração Heróica no lugar.
    await actor.setFlag(ID, F.heroica, getF(actor, F.heroica) + 1);
    return chat(actor, "Inspiração Heróica", `<b>${esc(actor.name)}</b> já tinha Inspiração e ganha uma <b>Inspiração Heróica</b>.`, { icon: "fa-dice-d6" });
  }
  await actor.update({ "system.attributes.inspiration": true });
  return chat(actor, "Inspiração", `<b>${esc(actor.name)}</b> recebe <b>Inspiração</b>.`, { icon: "fa-star" });
}

async function gastarInspiracao(actor) {
  if (!actor?.isOwner) return;
  if (!actor.system.attributes.inspiration) {
    if (game.user.isGM) return concederInspiracao(actor);
    return ui.notifications.info("Sem Inspiração para gastar.");
  }
  if (!await confirmar("Gastar Inspiração", `${actor.name} gasta a Inspiração: rerrola um d20, suprime um efeito agudo ou a dá a um aliado.`)) return;
  await actor.update({ "system.attributes.inspiration": false });
  return chat(actor, "Inspiração", `<b>${esc(actor.name)}</b> gasta a <b>Inspiração</b>.`, { icon: "fa-star" });
}

export async function concederHeroica(actor, n = 1) {
  if (!game.user.isGM || !actor) return;
  await actor.setFlag(ID, F.heroica, Math.max(0, getF(actor, F.heroica) + n));
  return chat(actor, "Inspiração Heróica", `<b>${esc(actor.name)}</b> ${n > 0 ? "ganha" : "perde"} uma <b>Inspiração Heróica</b> (${getF(actor, F.heroica)}).`, { icon: "fa-dice-d6" });
}

async function gastarHeroica(actor) {
  if (!actor?.isOwner) return;
  const n = getF(actor, F.heroica);
  if (!n) return ui.notifications.info("Sem Inspiração Heróica para gastar.");
  await actor.setFlag(ID, F.heroica, n - 1);
  return rolar("1d4", actor, "Inspiração Heróica: some ao resultado");
}

async function darHeroica(actor) {
  if (!actor?.isOwner) return;
  const n = getF(actor, F.heroica);
  if (!n) return;
  const alvo = await escolherPersonagem("Dar Inspiração Heróica", { excluir: actor.id });
  if (!alvo) return;
  await actor.setFlag(ID, F.heroica, n - 1);
  return rolar("1d4", alvo, `Inspiração Heróica dada por ${actor.name}: ${alvo.name} soma ao resultado agora`);
}

export function registrarBotoesDoChat() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    html.querySelectorAll("[data-monolith-acao='rolarHeroicaRecebida']").forEach(btn => {
      const actor = game.actors.get(btn.dataset.actor);
      if (!actor?.isOwner) { btn.disabled = true; return; }
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        await rolar("1d4", actor, "Inspiração Heróica recebida de quem está morrendo");
      });
    });
  });
}
