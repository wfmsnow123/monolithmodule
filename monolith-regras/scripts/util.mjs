export const ID = "monolith-regras";

// O Fio, as Medidas e a Queima ficam no monolith-medidas; a Perdição no monolith-perdicao.
export const F = {
  heroica: "heroica", // número de Inspirações Heróicas
  enfase: "enfase"    // próxima rolagem de d20 com Ênfase
};

export const getF = (actor, key, fallback = 0) => actor?.getFlag(ID, key) ?? fallback;

export function esc(s) {
  return foundry.utils.escapeHTML(String(s ?? ""));
}

/**
 * Personagens de jogador que aparecem no painel deste usuário. O Mestre vê todos.
 * Jogadores veem os próprios (dono explícito ou personagem atribuído), ou todos, conforme a configuração.
 */
export function personagens() {
  const list = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner);
  if (game.user.isGM) return list;
  if (game.settings.get(ID, "hudJogadores") === "todos") return list;
  const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  return list.filter(a => a.id === game.user.character?.id || (a.ownership?.[game.user.id] ?? 0) >= OWNER);
}

export function hp(actor) {
  const h = actor.system.attributes.hp;
  const max = h.effectiveMax ?? h.max ?? 0;
  return { value: h.value ?? 0, max };
}

export async function chat(actor, titulo, corpo, { whisperGM = false, icon = "fa-skull" } = {}) {
  const content = `<div class="mono-card">
    <header><i class="fas ${icon}"></i> ${titulo}</header>
    <div class="mono-card__body">${corpo}</div>
  </div>`;
  const data = { speaker: ChatMessage.getSpeaker({ actor }), content };
  if (whisperGM) data.whisper = ChatMessage.getWhisperRecipients("GM");
  return ChatMessage.create(data);
}

export async function rolar(formula, actor, flavor) {
  const roll = await new Roll(formula).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor });
  return roll;
}

/** Executa só no cliente do GM ativo (evita duplicação entre clientes). */
export function souGMAtivo() {
  return game.users.activeGM?.isSelf ?? false;
}

export async function escolherPersonagem(titulo, { excluir = null } = {}) {
  const opts = game.actors
    .filter(a => a.type === "character" && a.hasPlayerOwner && a.id !== excluir)
    .map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
  if (!opts) { ui.notifications.warn("Nenhum outro personagem disponível."); return null; }
  const id = await foundry.applications.api.DialogV2.prompt({ classes: ["mono"], window: { title: titulo },
    content: `<div class="form-group"><label>Personagem</label><select name="alvo">${opts}</select></div>`,
    ok: { label: "Confirmar", callback: (ev, btn) => btn.form.elements.alvo.value }
  }).catch(() => null);
  return id ? game.actors.get(id) : null;
}

export async function confirmar(titulo, texto) {
  return foundry.applications.api.DialogV2.confirm({ classes: ["mono"], window: { title: titulo }, content: `<p>${texto}</p>`
  }).catch(() => false);
}

/** Retrato 3x4: só ganha zoom (classe "zoom") quando a imagem não é 3x4, para preencher sem cortar as que já são. */
export function ajustarRetratos(raiz) {
  for (const img of raiz.querySelectorAll(".retrato img")) {
    const f = () => { if (img.naturalWidth) img.classList.toggle("zoom", Math.abs(img.naturalWidth / img.naturalHeight - 0.75) > 0.03); };
    if (img.complete) f(); else img.addEventListener("load", f, { once: true });
  }
}
