/**
 * Monolith: Resting Rules. Fome pelo relógio do mundo (o Monolith: Calendário move o worldTime).
 * Cada personagem guarda a hora da última refeição na flag ultimaRefeicao; o Mestre ativo confere a
 * cada updateWorldTime e avisa uma vez por nível (8 h, 16 h, 24 h com o intervalo padrão).
 */
import { avaliarFome, inanicao, TEXTO_FOME, HORA } from "./logica.mjs";
import { itensDe, categoriaDoItem } from "./comida.mjs";

const ID = "monolith-resting";
const esc = (v) => foundry.utils.escapeHTML(String(v ?? ""));

/** Marca a refeição (dono ou Mestre) e zera os avisos de fome. */
export function registrarRefeicao(actor, t = game.time.worldTime) {
  return actor.update({
    [`flags.${ID}.ultimaRefeicao`]: t,
    [`flags.${ID}.fomeNivel`]: 0,
    [`flags.${ID}.fomeDias`]: 0
  });
}

/** Personagens de jogador e, se a opção estiver ligada, NPCs com token ligado na cena ativa. */
export function alvosDeFome() {
  const alvos = new Set(game.actors.filter((a) => a.type === "character" && a.hasPlayerOwner));
  if (game.settings.get(ID, "fomeNPCs")) {
    for (const t of game.scenes?.active?.tokens ?? []) {
      if (t.actorLink && t.actor && ["character", "npc"].includes(t.actor.type)) alvos.add(t.actor);
    }
  }
  return [...alvos];
}

/** Ninguém começa passando fome: quem não tem refeição registrada comeu agora. */
export async function iniciarRefeicoes({ todos = false } = {}) {
  if (!game.users.activeGM?.isSelf) return;
  const agora = game.time.worldTime;
  for (const a of alvosDeFome()) {
    if (todos || a.getFlag(ID, "ultimaRefeicao") === undefined) await registrarRefeicao(a, agora);
  }
}

function destinatarios(actor) {
  if (!game.settings.get(ID, "fomeSussurro")) return [];
  return game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id);
}

function horas(seg) {
  const h = Math.floor(seg / HORA);
  return h >= 48 ? `${Math.floor(h / 24)} dias` : `${h} horas`;
}

let fila = Promise.resolve();
export function verificarFome() {
  fila = fila.then(conferir).catch((err) => console.error(`${ID} | fome`, err));
  return fila;
}

async function conferir() {
  if (!game.users.activeGM?.isSelf || !game.settings.get(ID, "fome")) return;
  const agora = game.time.worldTime;
  const intervalo = game.settings.get(ID, "fomeIntervalo");
  const punir = game.settings.get(ID, "fomeInanicao");
  for (const actor of alvosDeFome()) {
    const ultima = actor.getFlag(ID, "ultimaRefeicao");
    if (ultima === undefined) { await registrarRefeicao(actor, agora); continue; }
    const decorrido = agora - ultima;
    const anterior = actor.getFlag(ID, "fomeNivel") ?? 0;
    const { nivel, avisar } = avaliarFome(decorrido, intervalo, anterior);
    const updates = {};
    if (nivel !== anterior) updates[`flags.${ID}.fomeNivel`] = nivel;

    let exaustao = 0;
    let dias = 0;
    if (punir) {
      const punidos = actor.getFlag(ID, "fomeDias") ?? 0;
      const r = inanicao(decorrido, actor.system.abilities?.con?.mod, punidos);
      dias = r.dias;
      exaustao = r.novos;
      if (r.dias > punidos) updates[`flags.${ID}.fomeDias`] = r.dias;
    }
    if (exaustao) {
      const ex = actor.system.attributes?.exhaustion ?? 0;
      updates["system.attributes.exhaustion"] = Math.min(6, ex + exaustao);
    }
    if (Object.keys(updates).length) await actor.update(updates);

    if (avisar || exaustao) {
      const linhas = [];
      if (avisar) linhas.push(`<p><b>${esc(actor.name)}</b> ${TEXTO_FOME[avisar]}.</p>`);
      if (exaustao) linhas.push(`<p>${dias} dias sem comer: <b>+${exaustao} de Exaustão</b>.</p>`);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        whisper: destinatarios(actor),
        content: `<div class="mono-card mr-fome"><header><i class="fas fa-drumstick-bite"></i> Fome</header><div class="mono-card__body">
          ${linhas.join("")}<p class="mr-fome__hint">Última refeição há ${horas(decorrido)}.</p>
          <div class="mr-fome__botoes"><button type="button" data-monolith-comer="${actor.id}"><i class="fas fa-utensils"></i> Comer agora</button>
          <button type="button" data-monolith-comeu="${actor.id}"><i class="fas fa-check"></i> Já comeu</button></div></div></div>`
      });
    }
  }
}

/** O dono come 1 unidade de comida do inventário. */
export async function comerAgora(actor) {
  const item = itensDe(actor, "comida").sort((a, b) => (b.system.type?.value === "food") - (a.system.type?.value === "food"))[0];
  if (!item) return ui.notifications.warn(`${actor.name} não carrega comida.`);
  const resta = (item.system.quantity ?? 1) - 1;
  if (resta > 0) await item.update({ "system.quantity": resta });
  else await item.delete();
  await registrarRefeicao(actor);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="mono-card"><header><i class="fas fa-utensils"></i> Refeição</header><div class="mono-card__body">
      <p><b>${esc(actor.name)}</b> come ${esc(item.name)}.</p></div></div>`
  });
}

/** Botões dos cartões de fome e da fogueira. */
export function botoesDeFome(message, html, abrirFogueira) {
  html.querySelectorAll("[data-monolith-comer]").forEach((btn) => {
    const actor = game.actors.get(btn.dataset.monolithComer);
    if (!actor?.isOwner) { btn.remove(); return; }
    if (!itensDe(actor, "comida").length) { btn.disabled = true; btn.dataset.tooltip = "Sem comida no inventário"; return; }
    btn.addEventListener("click", async () => { btn.disabled = true; await comerAgora(actor); });
  });
  html.querySelectorAll("[data-monolith-comeu]").forEach((btn) => {
    const actor = game.actors.get(btn.dataset.monolithComeu);
    if (!game.user.isGM || !actor) { btn.remove(); return; }
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      await registrarRefeicao(actor);
      ui.notifications.info(`${actor.name}: refeição registrada.`);
    });
  });
  html.querySelectorAll("[data-monolith-fogueira]").forEach((btn) => btn.addEventListener("click", () => abrirFogueira()));
}

/** Usar um consumível de comida (dnd5e 5.x) conta como refeição. */
export function aoUsarAtividade(activity) {
  const item = activity?.item;
  const actor = item?.actor;
  if (!actor?.isOwner || categoriaDoItem(item) !== "comida") return;
  registrarRefeicao(actor);
}
