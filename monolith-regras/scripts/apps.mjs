import { ID, F, getF, esc, personagens, chat, rolar, escolherPersonagem, confirmar, ajustarRetratos } from "./util.mjs";
import { rolarEnfaseSolta } from "./enfase.mjs";
import { DESCRICOES } from "./exaustao.mjs";

/** Abre as Medidas Desesperadas (módulo próprio) ou, sem ele, a ficha. */
function abrirMedidas(actor) {
  const m = game.modules.get("monolith-medidas");
  if (m?.active && m.api) return m.api.abrir(actor);
  return actor?.sheet.render(true);
}

/* =========================================================
 *  Painel flutuante de Inspiração (fora da ficha)
 * ========================================================= */

export const HUD = {
  el: null,

  montar() {
    // Com o painel embutido na lista de jogadores, o flutuante sai de cena.
    if (!game.settings.get(ID, "mostrarHud") || game.settings.get(ID, "painelNaLista")) return this.desmontar();
    if (!this.el) {
      this.el = document.createElement("div");
      this.el.id = "monolith-hud";
      document.body.appendChild(this.el);
      this.el.addEventListener("click", ev => this.clique(ev));
      this.el.addEventListener("contextmenu", ev => this.clique(ev, true));
      this.arrastavel();
      window.addEventListener("resize", foundry.utils.debounce(() => this.el && this.posicionar(), 200));
    }
    this.posicionar();
    this.render();
  },

  desmontar() { this.el?.remove(); this.el = null; },

  /** O painel fica ancorado pela borda de baixo: cresce para cima e nunca sai da tela. */
  posicionar() {
    const pos = game.settings.get(ID, "posicaoHud") ?? {};
    if (pos.left === undefined) return;
    let bottom = pos.bottom;
    if (bottom === undefined && pos.top !== undefined) bottom = Math.max(0, window.innerHeight - pos.top - 200);
    const left = Math.clamp(pos.left, 0, Math.max(0, window.innerWidth - 120));
    Object.assign(this.el.style, { left: `${left}px`, bottom: `${Math.clamp(bottom ?? 120, 0, Math.max(0, window.innerHeight - 60))}px`, top: "auto" });
  },

  render() {
    if (!this.el) return;
    const gm = game.user.isGM;
    const recolhido = game.settings.get(ID, "hudRecolhido");
    const linhas = personagens().map(a => `<li data-actor="${a.id}">
        ${retratoDoPersonagem(a)}
        <span class="nome" data-acao="ficha">${esc(a.name)}</span>
        ${controlesDoPersonagem(a)}
      </li>`).join("");
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
    ajustarRetratos(this.el);
  },

  async clique(ev, direito = false) {
    const alvo = ev.target.closest("[data-acao]");
    if (!alvo) return;
    if (direito) ev.preventDefault();
    if (alvo.dataset.acao === "recolher") return game.settings.set(ID, "hudRecolhido", !game.settings.get(ID, "hudRecolhido")).then(() => this.render());
    return acaoDoPainel(alvo.dataset.acao, game.actors.get(alvo.closest("[data-actor]")?.dataset.actor), direito);
  },

  arrastavel() {
    let ini = null;
    // Arrasta pelo cabeçalho; guarda a distância até a borda de baixo, para a lista crescer para cima.
    this.el.addEventListener("pointerdown", ev => {
      if (!ev.target.closest("[data-arrastar]") || ev.target.closest("[data-acao]")) return;
      const r = this.el.getBoundingClientRect();
      ini = { x: ev.clientX - r.left, y: r.bottom - ev.clientY };
      this.el.setPointerCapture(ev.pointerId);
    });
    this.el.addEventListener("pointermove", ev => {
      if (!ini) return;
      const left = Math.clamp(ev.clientX - ini.x, 0, window.innerWidth - this.el.offsetWidth);
      const bottom = Math.clamp(window.innerHeight - (ev.clientY + ini.y), 0, window.innerHeight - 40);
      Object.assign(this.el.style, { left: `${left}px`, bottom: `${bottom}px`, top: "auto" });
    });
    this.el.addEventListener("pointerup", ev => {
      if (!ini) return;
      ini = null;
      const r = this.el.getBoundingClientRect();
      game.settings.set(ID, "posicaoHud", { left: Math.round(r.left), bottom: Math.round(window.innerHeight - r.bottom) });
    });
  }
};

/** Ações compartilhadas pelo painel flutuante e pela lista de jogadores. */
export function acaoDoPainel(acao, actor, direito = false) {
  switch (acao) {
    case "descanso": return abrirPedidoDeDescanso();
    case "enfase": return rolarEnfaseSolta(game.user.character ?? personagens()[0] ?? null);
    case "troca": return game.itempiles?.API?.requestTrade();
    case "ficha": return actor?.sheet.render(true);
    case "medidas": return actor && abrirMedidas(actor);
    case "inspiracao": return direito ? concederInspiracao(actor) : gastarInspiracao(actor);
    case "heroica": return direito ? concederHeroica(actor) : gastarHeroica(actor);
    case "dar": return darHeroica(actor);
  }
}

/** Botões de um personagem (Inspiração, Heróica, dar, Exaustão), iguais no painel e na lista. */
export function controlesDoPersonagem(a) {
  const gm = game.user.isGM;
  const insp = !!a.system.attributes.inspiration;
  const her = getF(a, F.heroica);
  const ex = a.system.attributes.exhaustion ?? 0;
  return `<button class="insp ${insp ? "on" : ""}" data-acao="inspiracao" data-tooltip="Inspiração ${insp ? "(clique para gastar)" : ""}${gm ? "<br>Mestre: botão direito concede" : ""}"><i class="fa${insp ? "s" : "r"} fa-star"></i></button>
        <span class="her" data-tooltip="Inspiração Heróica: clique para gastar (+1d4)${gm ? "<br>botão direito: +1" : ""}" data-acao="heroica"><i class="fas fa-dice-d6"></i> ${her}</span>
        <button data-acao="dar" data-tooltip="Dar uma Inspiração Heróica a outro personagem" ${her ? "" : "disabled"}><i class="fas fa-hand-holding-heart"></i></button>
        ${ex ? `<span class="ex" data-tooltip="Exaustão ${ex}: ${DESCRICOES[ex] ?? ""}">${ex}</span>` : ""}`;
}

export function retratoDoPersonagem(a) {
  return `<span class="retrato" data-acao="medidas" data-tooltip="${game.modules.get("monolith-medidas")?.active ? "Medidas Desesperadas" : "Abrir a ficha"}"><img src="${a.img}" alt=""></span>`;
}

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

/** Botão de cartões antigos ("Morrendo, ainda" das versões até a 0.5). */
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
