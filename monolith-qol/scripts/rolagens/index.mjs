/**
 * Rolagens do Mestre: esconde dos jogadores a fórmula e os dados das rolagens públicas do Mestre,
 * some com as rolagens privadas de quem não as recebeu e rola em privado por tokens ocultos.
 * Baseado no Hide GM Rolls 0.15.4 (MIT).
 *
 * Diferenças para a V13: em vez de esconder a mensagem por CSS e embrulhar ChatLog#notify com o
 * libWrapper, a mensagem fica invisível (ChatMessage#visible) e o core não a desenha nem toca o som.
 * O HTML é tratado em renderChatMessageHTML e de novo em dnd5e.renderChatMessage, porque o dnd5e
 * acrescenta crítico, falha e dicas dos dados depois do gancho do core.
 */
import { definirRecurso, ligado, opcao } from "../recursos.mjs";

const op = (k) => opcao("rolagens", k);

/** A mensagem veio do Mestre e quem vê é jogador. */
const doMestreParaJogador = (msg) => !game.user.isGM && !!msg.author?.isGM;

/** Rolagem sussurrada que este usuário não recebeu e não fez. */
function deveSumir(msg) {
  const w = msg.whisper ?? [];
  if (!w.length || w.includes(game.user.id) || msg.author?.id === game.user.id) return false;
  return msg.author?.isGM ? op("ocultarPrivadas") : op("ocultarJogadores");
}

function instalarVisibilidade() {
  const proto = foundry.documents.ChatMessage.prototype;
  const original = Object.getOwnPropertyDescriptor(proto, "visible");
  if (!original?.get) return;
  Object.defineProperty(proto, "visible", {
    configurable: true,
    get() {
      const v = original.get.call(this);
      if (!v || !ligado("rolagens")) return v;
      return !deveSumir(this);
    }
  });
}

/* ---------- Limpeza do HTML ---------- */

function limpar(msg, html) {
  if (!ligado("rolagens") || !doMestreParaJogador(msg) || !(html instanceof HTMLElement)) return;

  if (op("limpar")) {
    html.querySelectorAll(".dice-formula, .dice-tooltip, .dice-tooltip-collapser").forEach((el) => el.remove());
    // secret-roll é a classe do próprio dnd5e para rolagens sem detalhes: tira a seta e o clique.
    html.querySelectorAll(".dice-roll").forEach((el) => el.classList.add("secret-roll", "mqol-rolagem-limpa"));
  }

  if (op("criticos")) {
    for (const total of html.querySelectorAll(".dice-total")) {
      if (!total.matches(".critical, .fumble")) continue;
      total.classList.remove("critical", "fumble");
      // O dnd5e marca crítico e falha crítica com dois ícones; fica um, se houver acerto ou erro.
      const icones = total.querySelector(":scope > .icons");
      if (icones) {
        icones.replaceChildren();
        const ic = total.classList.contains("success") ? "fa-check" : total.classList.contains("failure") ? "fa-xmark" : null;
        if (ic) icones.innerHTML = `<i class="fas ${ic}" inert></i>`;
        else icones.remove();
      }
    }
  }

  if (op("descricao")) {
    // Mesmo efeito do "Ocultar descrições de PdM" do dnd5e (data-concealed), mas para todo cartão
    // do Mestre, e o texto sai do HTML em vez de só ficar escondido.
    for (const cab of html.querySelectorAll(".chat-card .card-header.description")) {
      cab.toggleAttribute("data-concealed", true);
      cab.classList.add("collapsed");
      cab.querySelector(".details")?.replaceChildren();
    }
  }
}

/** Reavalia o chat já desenhado quando o Mestre muda as regras de visibilidade. */
function atualizarChat() {
  if (!ui.chat?.rendered) return;
  const ids = new Set([...document.querySelectorAll(".chat-log .message[data-message-id]")].map((el) => el.dataset.messageId));
  for (const id of ids) {
    const msg = game.messages.get(id);
    if (!msg) continue;
    if (!msg.visible) ui.chat.deleteMessage(id);
    else ui.chat.updateMessage(msg);
  }
}

definirRecurso({
  id: "rolagens",
  icone: "fas fa-dice-d20",
  original: "hide-gm-rolls",
  opcoes: [
    { chave: "limpar", tipo: Boolean, padrao: true, aoMudar: atualizarChat },
    { chave: "criticos", tipo: Boolean, padrao: true, aoMudar: atualizarChat },
    { chave: "dsn", tipo: Boolean, padrao: true },
    { chave: "ocultarPrivadas", tipo: Boolean, padrao: true, aoMudar: atualizarChat },
    { chave: "ocultarJogadores", tipo: Boolean, padrao: false, aoMudar: atualizarChat },
    { chave: "descricao", tipo: Boolean, padrao: false, aoMudar: atualizarChat },
    { chave: "privadaOculto", tipo: Boolean, padrao: false }
  ],
  // sanitize-better-rolls-crit-dmg e sanitize-ready-set-roll-crit-dmg não vêm: os dois módulos não existem na V13 da mesa.
  migracao: {
    "sanitize-rolls": "limpar",
    "sanitize-crit-fail": "criticos",
    "sanitize-dice-so-nice": "dsn",
    "hide-private-rolls": "ocultarPrivadas",
    "hide-player-rolls": "ocultarJogadores",
    "hide-item-description": "descricao",
    "private-hidden-tokens": "privadaOculto"
  },

  iniciar() {
    instalarVisibilidade();
    Hooks.on("renderChatMessageHTML", limpar);
    Hooks.on("dnd5e.renderChatMessage", limpar);

    // Mestre rolando por um token oculto: a mensagem vira privada.
    Hooks.on("preCreateChatMessage", (msg) => {
      if (!ligado("rolagens") || !op("privadaOculto") || !game.user.isGM) return;
      if (msg.whisper?.length) return;
      const { scene, token } = msg.speaker ?? {};
      if (!token) return;
      const doc = game.scenes.get(scene)?.tokens.get(token) ?? globalThis.canvas?.scene?.tokens.get(token);
      if (doc?.hidden) msg.applyRollMode(CONST.DICE_ROLL_MODES.PRIVATE);
    });

    // Dice So Nice!: jogadores não veem os dados 3D das rolagens públicas do Mestre.
    Hooks.on("diceSoNiceRollStart", (messageId, context) => {
      if (!ligado("rolagens") || !op("dsn")) return;
      if (game.user.isGM || (context.user && !context.user.isGM)) return;
      context.blind = true;
    });
  },

  aoAlternar: atualizarChat
});
