import { ID, F, getF, esc, lista, LEGADOS } from "./config.mjs";

const { DialogV2 } = foundry.applications.api;

export const STATUS_QUEIMA = "monolithQueimando";

/* ---------- Utilidades ---------- */

export function hp(actor) {
  const h = actor.system.attributes.hp;
  return { value: h.value ?? 0, max: h.effectiveMax ?? h.max ?? 0 };
}
const falhasMorte = (actor) => actor.system.attributes.death?.failure ?? 0;
const souGMAtivo = () => game.users.activeGM?.isSelf ?? false;
const perdicao = () => { const m = game.modules.get("monolith-perdicao"); return m?.active ? m.api : null; };
const regras = () => { const m = game.modules.get("monolith-regras"); return m?.active ? m.api : null; };

export async function chat(actor, titulo, corpo, { icon = "fa-skull" } = {}) {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="mono-card"><header><i class="fas ${icon}"></i> ${titulo}</header><div class="mono-card__body">${corpo}</div></div>`
  });
}

async function rolar(formula, actor, flavor) {
  const roll = await new Roll(formula).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor });
  return roll;
}

export async function confirmar(titulo, texto) {
  return DialogV2.confirm({ classes: ["mono"], window: { title: titulo }, content: `<p>${texto}</p>` }).catch(() => false);
}

export async function escolherPersonagem(titulo, { excluir = null } = {}) {
  const opts = game.actors.filter((a) => a.type === "character" && a.hasPlayerOwner && a.id !== excluir)
    .map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
  if (!opts) { ui.notifications.warn("Nenhum outro personagem disponível."); return null; }
  const id = await DialogV2.prompt({ classes: ["mono"], window: { title: titulo },
    content: `<div class="form-group"><label>Personagem</label><select name="alvo">${opts}</select></div>`,
    ok: { label: "Confirmar", callback: (ev, btn) => btn.form.elements.alvo.value }
  }).catch(() => null);
  return id ? game.actors.get(id) : null;
}

/* ---------- Estado ---------- */

export function estado(actor) {
  const { value, max } = hp(actor);
  const marcadas = getF(actor, F.marcadas);
  const falhas = falhasMorte(actor);
  const morto = actor.statuses?.has("dead") ?? false;
  const queimando = !!getF(actor, F.queimando, false);
  const sangrando = value <= Math.floor(max / 2);
  return {
    hp: value, max, sangrando, queimando, morto, marcadas, falhas,
    morrendo: value <= 0 && !morto,
    livres: Math.max(0, 3 - Math.max(marcadas, falhas)),
    armadas: getF(actor, F.armadas, []),
    recusou: !!getF(actor, F.recusou, false),
    abertas: !morto && (queimando || sangrando || !game.settings.get(ID, "exigirSangrando"))
  };
}

export function fioTexto(e) {
  return `O Fio: ${[0, 1, 2].map((i) => (i < e.marcadas ? "✖" : i < e.falhas ? "●" : "○")).join(" ")}`;
}

const marcaDoTurno = () => { const c = game.combat; return c?.started ? `${c.id}.${c.round}.${c.turn}` : null; };

/* ---------- Usar uma Medida ---------- */

export async function usarMedida(actor, medidaId) {
  const m = lista().find((x) => x.id === medidaId);
  if (!m) return;
  const e = estado(actor);
  const custo = Number(m.custo) || 1;
  if (!e.abertas) return ui.notifications.warn("As Medidas Desesperadas só se abrem enquanto você está Sangrando.");
  if (custo > e.livres) return ui.notifications.warn(`Faltam caixas no Fio: ${m.nome} custa ${custo} e restam ${e.livres}.`);
  const turno = marcaDoTurno();
  const regra = game.settings.get(ID, "umaPorTurno");
  if (turno && regra !== "livre" && getF(actor, F.ultimaMedida, null) === turno) {
    if (regra === "bloquear") return ui.notifications.warn("Só uma Medida Desesperada por turno.");
    if (!await confirmar("Medida Desesperada", "Você já usou uma Medida neste turno. Usar outra mesmo assim?")) return;
  }

  // Efeitos que podem ser cancelados vêm antes de marcar o Fio.
  let extra = "";
  if (m.efeito === "espaco") {
    const nivel = await escolherEspaco(actor, Number(m.parametro) || 5, m.nome);
    if (!nivel) return;
    const s = actor.system.spells[`spell${nivel}`];
    await actor.update({ [`system.spells.spell${nivel}.value`]: Math.min(s.max, s.value + 1) });
    extra = `<p>Recuperou um espaço de ${nivel}º círculo.</p>`;
  }

  const updates = {
    [`flags.${ID}.${F.marcadas}`]: Math.min(3, e.marcadas + custo),
    [`flags.${ID}.${F.ultimaMedida}`]: turno
  };
  if (m.armada) updates[`flags.${ID}.${F.armadas}`] = [...e.armadas, { id: m.id, nome: m.nome }];
  // Quem já está a 0 PV (queimando) enche o Fio de verdade.
  if (e.hp <= 0) updates["system.attributes.death.failure"] = Math.min(3, e.falhas + custo);
  await actor.update(updates);

  if (m.efeito === "enfase") {
    if (regras()?.armarEnfase) await regras().armarEnfase(actor, true);
    else extra += `<p class="hint">Ative o Monolith: Regras da Casa para a Ênfase ser aplicada sozinha.</p>`;
  }

  await chat(actor, `Medida Desesperada: ${esc(m.nome)}`,
    `<p><b>${esc(actor.name)}</b> marca ${custo} falha(s) no Fio.</p><p><i>${esc(m.texto)}</i></p>${extra}
     <p class="mm-fio-txt">${fioTexto(estado(actor))}</p>`, { icon: "fa-heart-crack" });

  if (m.efeito === "rolar" && m.parametro) await rolar(m.parametro, actor, `${m.nome}`);
  if (m.efeito === "macro" && m.parametro) {
    const macro = await fromUuid(m.parametro).catch(() => null) ?? game.macros.getName(m.parametro);
    if (macro) await macro.execute({ actor, token: actor.getActiveTokens()[0] ?? null, medida: m });
    else ui.notifications.warn(`${m.nome}: macro não encontrada (${m.parametro}).`);
  }
  Hooks.callAll("monolithMedidas.usada", actor, m);
  await verificarMorte(actor);
}

async function escolherEspaco(actor, maximo, titulo) {
  const opts = [];
  for (let n = 1; n <= Math.min(9, maximo); n++) {
    const s = actor.system.spells?.[`spell${n}`];
    if (s?.max > 0 && s.value < s.max) opts.push(`<option value="${n}">${n}º círculo (${s.value}/${s.max})</option>`);
  }
  if (!opts.length) { ui.notifications.warn(`Nenhum espaço de magia de 1º a ${maximo}º círculo gasto.`); return null; }
  return DialogV2.prompt({ classes: ["mono"], window: { title: titulo },
    content: `<div class="form-group"><label>Espaço</label><select name="n">${opts.join("")}</select></div>`,
    ok: { label: "Recuperar", callback: (ev, btn) => Number(btn.form.elements.n.value) }
  }).catch(() => null);
}

export async function consumirArmada(actor, index) {
  const armadas = [...getF(actor, F.armadas, [])];
  const [m] = armadas.splice(index, 1);
  await actor.setFlag(ID, F.armadas, armadas);
  const def = lista().find((x) => x.id === m?.id);
  if (def?.efeito === "enfase" && regras()?.armarEnfase) await regras().armarEnfase(actor, false);
  if (m) chat(actor, "Medida consumida", `<b>${esc(actor.name)}</b> usou ${esc(m.nome)}.`, { icon: "fa-check" });
}

export async function ajustarMarcadas(actor, delta) {
  await actor.setFlag(ID, F.marcadas, Math.clamp(getF(actor, F.marcadas) + delta, 0, 3));
}

/** Fim de descanso: o Fio perde falhas marcadas e as Medidas armadas expiram. */
export async function aoDescansar(actor, tipo, { sonoInteiro = false } = {}) {
  if (tipo === "folego") return;
  const marcadas = getF(actor, F.marcadas);
  const apagar = tipo === "completo" ? marcadas : sonoInteiro ? 2 : 1;
  await actor.update({ [`flags.${ID}.${F.marcadas}`]: Math.max(0, marcadas - apagar), [`flags.${ID}.${F.armadas}`]: [] });
}

/* ---------- Morte, Queima e Retorno ---------- */

export async function verificarMorte(actor) {
  const e = estado(actor);
  if (e.morto || e.hp > 0) return;
  if (e.falhas < 3 && e.marcadas < 3) return;
  await actor.update({ [`flags.${ID}.${F.queimando}`]: false });
  await statusQueima(actor, false);
  try { await actor.toggleStatusEffect("dead", { active: true, overlay: true }); }
  catch (err) { console.warn(`${ID} | status de morto`, err); }
  await chat(actor, "O Fio se rompeu",
    `<p><b>${esc(actor.name)}</b> morreu.</p>${e.recusou ? "" : "<p>Ainda resta <b>Recusar a Morte</b>, uma única vez.</p>"}
     <p>Se a morte for de vez, abra as Medidas Desesperadas para escolher <b>O Nome que Fica</b>.</p>`, { icon: "fa-skull" });
}

async function ganharPerdicao(actor, formula, motivo) {
  const api = perdicao();
  if (api?.rolarGanho) return api.rolarGanho(actor, formula, motivo);
  const roll = await rolar(formula, actor, `${motivo}: Perdição`);
  return roll.total;
}

export async function queimarAlma(actor, { recusa = false } = {}) {
  const e = estado(actor);
  if (!recusa && !e.morrendo) return ui.notifications.warn("A Queima de Alma começa quando você cai a 0 PV.");
  if (recusa && e.recusou) return ui.notifications.warn(`${actor.name} já recusou a morte uma vez.`);
  const updates = { [`flags.${ID}.${F.queimando}`]: true };
  if (recusa) {
    updates[`flags.${ID}.${F.recusou}`] = true;
    updates["system.attributes.hp.value"] = 0;
    updates["system.attributes.death.failure"] = 2;
    updates["system.attributes.death.success"] = 0;
  }
  await actor.update(updates);
  const ganho = await ganharPerdicao(actor, recusa ? "1d8" : "1d4", recusa ? "Recusar a Morte" : "Queimar a Alma");
  await chat(actor, recusa ? "Recusar a Morte" : "Queimar a Alma",
    `<p><b>${esc(actor.name)}</b> ${recusa ? "recusa a morte e " : ""}queima a alma: levanta com 0 PV e age normalmente.</p>
     <p>Perdição +${ganho}. Cada dano sofrido enche o Fio; no início de cada turno, +1 de Perdição e +1 por falha marcada.</p>`,
    { icon: "fa-fire" });
  try {
    if (recusa) await actor.toggleStatusEffect("dead", { active: false });
    await actor.toggleStatusEffect("unconscious", { active: false });
  } catch (err) { console.warn(`${ID} | status ao queimar`, err); }
  await statusQueima(actor, true);
}

export async function encerrarQueima(actor, { porCura = false } = {}) {
  await actor.update({ [`flags.${ID}.${F.queimando}`]: false });
  await statusQueima(actor, false);
  if (!porCura && hp(actor).value <= 0) await actor.toggleStatusEffect("unconscious", { active: true });
  await chat(actor, "Fim da Queima", porCura
    ? `<b>${esc(actor.name)}</b> recuperou PV. A Queima termina, mas as falhas marcadas continuam no Fio.`
    : `<b>${esc(actor.name)}</b> encerra a Queima e cai Inconsciente, com as falhas que já tem.`, { icon: "fa-fire-flame-simple" });
}

export async function danoNaQueima(actor, falhas = 1) {
  await actor.update({ "system.attributes.death.failure": Math.min(3, falhasMorte(actor) + falhas) });
  await chat(actor, "Queima: dano", `<b>${esc(actor.name)}</b> sofre dano queimando: +${falhas} falha(s). ${fioTexto(estado(actor))}`, { icon: "fa-fire" });
  await verificarMorte(actor);
}

export async function inspiracaoDoMoribundo(actor) {
  const alvo = await escolherPersonagem("Conceder Inspiração Heróica", { excluir: actor.id });
  if (!alvo) return;
  const content = `<div class="mono-card"><header><i class="fas fa-hand-holding-heart"></i> Morrendo, ainda</header>
    <div class="mono-card__body"><p><b>${esc(actor.name)}</b>, morrendo, concede uma <b>Inspiração Heróica</b> a <b>${esc(alvo.name)}</b>.</p>
    <p>Ela precisa ser gasta até o fim do próximo turno de ${esc(alvo.name)}, ou se perde.</p>
    <button type="button" data-monolith-medidas="heroicaRecebida" data-actor="${alvo.id}"><i class="fas fa-dice-d6"></i> Gastar agora (+1d4)</button></div></div>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

export async function nomeQueFica(actor) {
  const alvo = await escolherPersonagem("O Nome que Fica: quem carrega o nome?", { excluir: actor.id });
  if (!alvo) return;
  const opts = Object.entries(LEGADOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  const legado = await DialogV2.prompt({ classes: ["mono"], window: { title: "O Nome que Fica" },
    content: `<div class="form-group"><label>Legado</label><select name="l">${opts}</select></div>
              <div class="form-group"><label>Detalhe</label><input type="text" name="d" placeholder="Ex.: Força, Atletismo, a espada"></div>`,
    ok: { label: "Deixar o legado", callback: (ev, btn) => ({ l: btn.form.elements.l.value, d: btn.form.elements.d.value }) }
  }).catch(() => null);
  if (!legado) return;
  await chat(actor, "O Nome que Fica",
    `<p><b>${esc(alvo.name)}</b> carrega o nome de <b>${esc(actor.name)}</b>.</p>
     <p>Legado: ${LEGADOS[legado.l]}${legado.d ? `: <b>${esc(legado.d)}</b>` : ""}.</p>
     <p><i>Enquanto ${esc(alvo.name)} viver e disser o nome de ${esc(actor.name)} em voz alta, ninguém foi esquecido.</i></p>`,
    { icon: "fa-feather" });
}

/* ---------- Status e ganchos ---------- */

export function registrarStatusQueima() {
  // O dnd5e reconstrói CONFIG.statusEffects no i18nInit a partir de CONFIG.DND5E.statusEffects;
  // o que for empurrado direto no init some. Por isso o status entra pela lista do sistema.
  const dados = { name: "Queimando a Alma", img: `modules/${ID}/icons/queima.svg` };
  if (CONFIG.DND5E?.statusEffects) CONFIG.DND5E.statusEffects[STATUS_QUEIMA] ??= dados;
  Hooks.once("setup", () => {
    if (!CONFIG.statusEffects.some((s) => s.id === STATUS_QUEIMA)) CONFIG.statusEffects.push({ id: STATUS_QUEIMA, _id: "monolithqueimand", ...dados });
  });
}

/** Liga ou desliga o status da Queima sem deixar um erro de status interromper o resto. */
async function statusQueima(actor, ativo) {
  try { await actor.toggleStatusEffect(STATUS_QUEIMA, { active: ativo }); }
  catch (err) { console.warn(`${ID} | status da Queima`, err); }
}

/** Quem deve ver a pergunta: um jogador dono conectado; se não houver, o Mestre ativo. */
function souResponsavel(actor) {
  const jogador = game.users.find((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"));
  return (jogador ?? game.users.activeGM)?.isSelf ?? false;
}

const perguntando = new Set();
/** Oferece Queimar a Alma (morrendo) ou Recusar a Morte (morto, uma vez) ao jogador responsável. */
export async function oferecer(actor, tipo) {
  if (!game.settings.get(ID, "oferecerQueima") || !souResponsavel(actor)) return;
  const chave = `${actor.id}.${tipo}`;
  if (perguntando.has(chave)) return;
  perguntando.add(chave);
  try {
    const e = estado(actor);
    if (tipo === "queimar") {
      if (!e.morrendo || e.queimando) return;
      if (await confirmar("Queimar a Alma", `<b>${esc(actor.name)}</b> caiu a 0 PV. Queimar a Alma? Ganha 1d4 de Perdição e segue de pé, com 0 PV.`)) {
        if (estado(actor).morrendo && !estado(actor).queimando) await queimarAlma(actor);
      }
    } else if (tipo === "recusar") {
      if (!e.morto || e.recusou) return;
      if (await confirmar("Recusar a Morte", `<b>${esc(actor.name)}</b> morreu. Recusar a Morte, uma única vez? Volta queimando com 2 falhas no Fio e 1d8 de Perdição.`)) {
        if (estado(actor).morto && !estado(actor).recusou) await queimarAlma(actor, { recusa: true });
      }
    }
  } finally { perguntando.delete(chave); }
}

export function registrarGanchos() {
  // Ao cair a 0 PV, o Fio já começa com as falhas marcadas; ao se curar, a Queima termina.
  // A pergunta vai para o jogador dono (ou o Mestre), não para quem aplicou o dano.
  // Só na queda (o dnd5e manda o PV anterior em options.dnd5e.hp), não a cada dano já a 0 PV.
  Hooks.on("updateActor", (actor, changes, options) => {
    if (actor.type !== "character") return;
    const novoHp = foundry.utils.getProperty(changes, "system.attributes.hp.value");
    const antes = options?.dnd5e?.hp?.value;
    if (novoHp !== undefined && novoHp <= 0 && (antes === undefined || antes > 0)) setTimeout(() => oferecer(actor, "queimar"), 300);
  });
  Hooks.on("createActiveEffect", (eff) => {
    const actor = eff.parent;
    if (!(actor instanceof Actor) || actor.type !== "character" || !eff.statuses?.has("dead")) return;
    setTimeout(() => oferecer(actor, "recusar"), 300);
  });

  Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (userId !== game.user.id || actor.type !== "character") return;
    const novoHp = foundry.utils.getProperty(changes, "system.attributes.hp.value");
    if (novoHp === undefined) return;
    const e = estado(actor);
    if (novoHp <= 0 && !e.morto) {
      if (e.marcadas > e.falhas) await actor.update({ "system.attributes.death.failure": Math.min(3, e.marcadas) });
      if (e.marcadas >= 3) await verificarMorte(actor);
    } else if (novoHp > 0 && e.queimando) {
      await encerrarQueima(actor, { porCura: true });
    }
  });

  // Morrer por salvaguarda: o dnd5e não aplica o status de morto sozinho.
  Hooks.on("dnd5e.rollDeathSave", (rolls, details) => {
    const actor = details.subject;
    if (!actor?.isOwner) return;
    if (details.updates?.["system.attributes.death.failure"] >= 3) setTimeout(() => verificarMorte(actor), 250);
  });

  // Queimando, não se rola salvaguarda contra a morte.
  Hooks.on("dnd5e.preRollDeathSaveV2", (config) => {
    const actor = config.subject;
    if (actor && getF(actor, F.queimando, false)) {
      ui.notifications.warn(`${actor.name} está queimando a alma e não rola salvaguardas contra a morte.`);
      return false;
    }
  });

  // Dano sofrido queimando enche o Fio.
  Hooks.on("dnd5e.applyDamage", (actor, amount) => {
    if (!actor?.isOwner || amount <= 0 || !getF(actor, F.queimando, false)) return;
    if (game.users.activeGM && !souGMAtivo()) return;
    danoNaQueima(actor, 1);
  });

  // Início do turno de quem queima: +1 de Perdição, +1 por falha marcada.
  Hooks.on("combatTurnChange", (combat) => {
    const actor = combat.combatant?.actor;
    // Morrendo sem queimar: a regra deixa queimar no início de qualquer turno.
    if (actor?.type === "character" && estado(actor).morrendo && !getF(actor, F.queimando, false)) oferecer(actor, "queimar");
    if (!souGMAtivo()) return;
    if (!actor || !getF(actor, F.queimando, false)) return;
    const ganho = 1 + getF(actor, F.marcadas);
    const api = perdicao();
    if (api?.ajustar) api.ajustar(actor, ganho, { motivo: "início do turno queimando a alma" });
    else chat(actor, "Queima", `<b>${esc(actor.name)}</b> ganha ${ganho} de Perdição (início do turno queimando a alma).`, { icon: "fa-fire" });
  });

  // Botão do cartão "Morrendo, ainda".
  Hooks.on("renderChatMessageHTML", (message, html) => {
    html.querySelectorAll("[data-monolith-medidas='heroicaRecebida']").forEach((btn) => {
      const actor = game.actors.get(btn.dataset.actor);
      if (!actor?.isOwner) { btn.disabled = true; return; }
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        await rolar("1d4", actor, "Inspiração Heróica recebida de quem está morrendo");
      });
    });
  });
}
