export const ID = "monolith-regras";

export const F = {
  heroica: "heroica",          // número de Inspirações Heróicas
  marcadas: "marcadas",        // falhas marcadas por Medidas Desesperadas (0-3)
  armadas: "armadas",          // Medidas armadas esperando gatilho [{id, nome}]
  enfase: "enfase",            // próxima rolagem de d20 com Ênfase
  queimando: "queimando",      // Queima de Alma ativa
  recusou: "recusouMorte",     // já usou Recusar a Morte
  perdicao: "perdicao",        // trilha de Perdição (0-20)
  ultimaMedida: "ultimaMedida" // "round.turn" da última Medida usada em combate
};

export const getF = (actor, key, fallback = 0) => actor?.getFlag(ID, key) ?? fallback;

export function esc(s) {
  return foundry.utils.escapeHTML(String(s ?? ""));
}

/** Personagens de jogador relevantes para este usuário. */
export function personagens() {
  const list = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner);
  if (game.user.isGM) return list;
  return list.filter(a => a.isOwner);
}

export function hp(actor) {
  const h = actor.system.attributes.hp;
  const max = h.effectiveMax ?? h.max ?? 0;
  return { value: h.value ?? 0, max };
}

export function estaSangrando(actor) {
  const { value, max } = hp(actor);
  return value <= Math.floor(max / 2);
}

export function estaMorto(actor) {
  return actor.statuses?.has("dead");
}

export function falhasMorte(actor) {
  return actor.system.attributes.death?.failure ?? 0;
}

/** Caixas do Fio ainda vazias. */
export function caixasLivres(actor) {
  const marcadas = getF(actor, F.marcadas);
  return Math.max(0, 3 - Math.max(marcadas, falhasMorte(actor)));
}

export async function chat(actor, titulo, corpo, { whisperGM = false, icon = "fa-skull" } = {}) {
  const content = `<div class="monolith-card">
    <header><i class="fas ${icon}"></i> ${titulo}</header>
    <div class="monolith-card-body">${corpo}</div>
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
  const id = await foundry.applications.api.DialogV2.prompt({
    window: { title: titulo },
    content: `<div class="form-group"><label>Personagem</label><select name="alvo">${opts}</select></div>`,
    ok: { label: "Confirmar", callback: (ev, btn) => btn.form.elements.alvo.value }
  }).catch(() => null);
  return id ? game.actors.get(id) : null;
}

export async function confirmar(titulo, texto) {
  return foundry.applications.api.DialogV2.confirm({
    window: { title: titulo }, content: `<p>${texto}</p>`
  }).catch(() => false);
}
