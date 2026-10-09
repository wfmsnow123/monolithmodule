import { ID, esc, personagens, ajustarRetratos } from "./util.mjs";
import { acaoDoPainel, controlesDoPersonagem, retratoDoPersonagem } from "./apps.mjs";

/* =========================================================
 *  Painel de Inspiração embutido na lista de jogadores
 *  Cada jogador ganha a linha do seu personagem; a barra do topo junta
 *  Ênfase, Descanso e Troca (no lugar dos botões soltos do Item Piles,
 *  do Rest Recovery e do Resting, que ficam escondidos).
 * ========================================================= */

export function registrarListaDeJogadores() {
  Hooks.on("renderPlayers", (app, html) => montar(html instanceof HTMLElement ? html : html?.[0]));
}

/** Redesenha a lista quando um personagem muda (a lista do Foundry só se redesenha sozinha com os usuários). */
export const atualizarLista = foundry.utils.debounce(() => {
  if (game.settings.get(ID, "painelNaLista")) ui.players?.render();
}, 100);

function montar(raiz) {
  if (!raiz) return;
  const ligado = game.settings.get(ID, "painelNaLista");
  raiz.classList.toggle("monolith-jogadores", ligado);
  raiz.classList.toggle("recolhido", ligado && game.settings.get(ID, "hudRecolhido"));
  const ativos = raiz.querySelector("#players-active");
  if (!ligado || !ativos) return;

  ativos.querySelector(".mono-jog-barra")?.remove();
  ativos.prepend(barra());

  const visiveis = new Map(personagens().map(a => [a.id, a]));
  const mostrados = new Set();
  for (const li of raiz.querySelectorAll(".players-list > .player")) {
    const user = game.users.get(li.dataset.userId);
    const actor = user && !user.isGM ? visiveis.get(user.character?.id) : null;
    if (!actor) continue;
    mostrados.add(actor.id);
    // O nome do personagem passa para a linha de baixo; aqui fica só o jogador.
    li.querySelector(".player-name").textContent = user.pronouns ? `${user.name} (${user.pronouns})` : user.name;
    li.append(linha(actor));
  }

  // Personagens sem jogador atribuído entram na parte que expande, junto dos jogadores offline.
  const resto = [...visiveis.values()].filter(a => !mostrados.has(a.id));
  if (resto.length) {
    const li = document.createElement("li");
    li.className = "mono-jog-outros";
    li.innerHTML = `<span class="titulo">Outros personagens</span>`;
    for (const a of resto) li.append(linha(a));
    raiz.querySelector("#players-inactive")?.append(li);
  }
  ajustarRetratos(raiz);
}

function barra() {
  const gm = game.user.isGM;
  const descanso = gm && game.modules.get("monolith-resting")?.active;
  const el = document.createElement("div");
  el.className = "mono-jog-barra";
  el.innerHTML = `
    <span class="titulo">Monolith</span>
    <button type="button" data-acao="enfase" data-tooltip="Rolar com Ênfase"><i class="fas fa-arrows-left-right-to-line"></i></button>
    ${trocaAtiva() ? `<button type="button" data-acao="troca" data-tooltip="Pedir uma troca"><i class="fas fa-handshake"></i></button>` : ""}
    ${descanso ? `<button type="button" data-acao="descanso" data-tooltip="Pedir descanso"><i class="fas fa-bed"></i></button>` : ""}
    <button type="button" data-acao="recolher" data-tooltip="${game.settings.get(ID, "hudRecolhido") ? "Mostrar personagens" : "Esconder personagens"}"><i class="fas fa-${game.settings.get(ID, "hudRecolhido") ? "plus" : "minus"}"></i></button>`;
  el.addEventListener("click", ev => {
    const alvo = ev.target.closest("[data-acao]");
    if (!alvo) return;
    if (alvo.dataset.acao === "recolher") return game.settings.set(ID, "hudRecolhido", !game.settings.get(ID, "hudRecolhido")).then(() => ui.players?.render());
    return acaoDoPainel(alvo.dataset.acao);
  });
  return el;
}

function linha(actor) {
  const el = document.createElement("div");
  el.className = "mono-jog";
  el.dataset.actor = actor.id;
  // Só o primeiro nome cabe ao lado dos botões; o completo fica no tooltip.
  const primeiro = actor.name.trim().split(/[\s,]+/)[0];
  el.innerHTML = `${retratoDoPersonagem(actor)}<span class="nome" data-acao="ficha" data-tooltip="${esc(actor.name)}">${esc(primeiro)}</span>${controlesDoPersonagem(actor)}`;
  // Os cliques nos botões não chegam à linha do jogador (menu de usuário do Foundry, Monk's Active Tiles).
  const clique = (ev, direito) => {
    const alvo = ev.target.closest("[data-acao]");
    if (!alvo) return;
    ev.preventDefault();
    ev.stopPropagation();
    return acaoDoPainel(alvo.dataset.acao, actor, direito);
  };
  el.addEventListener("click", ev => clique(ev, false));
  el.addEventListener("contextmenu", ev => clique(ev, true));
  return el;
}

/** Troca do Item Piles: o embutido no Monolith: Itemizador ou o original. */
function trocaAtiva() {
  if (!game.itempiles?.API?.requestTrade) return false;
  const id = game.modules.get("item-piles")?.active ? "item-piles" : "monolith-itemizador";
  try { return game.settings.get(id, "enableTrading") !== false; }
  catch { return true; }
}
