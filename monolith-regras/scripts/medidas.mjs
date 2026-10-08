import {
  ID, F, getF, esc, chat, rolar, hp, estaSangrando, estaMorto, falhasMorte, caixasLivres,
  souGMAtivo, escolherPersonagem, confirmar
} from "./util.mjs";
import { armarEnfase } from "./enfase.mjs";

export const MEDIDAS = [
  { id: "arrancada", custo: 1, nome: "Arrancada", texto: "Você realiza as ações Disparada e Desengajar imediatamente como ação padrão ou bônus." },
  { id: "teimosia", custo: 1, nome: "Teimosia", texto: "Some +5 a um teste de d20 em que você acabou de falhar." },
  { id: "insistir", custo: 1, nome: "Insistir", texto: "Role novamente uma jogada de ataque que errou. Você deve usar o novo resultado." },
  { id: "apostar", custo: 1, nome: "Apostar", texto: "Seu próximo teste de d20 neste turno será rolado com Ênfase.", armada: true },
  { id: "oficio", custo: 1, nome: "Ofício", texto: "Você realiza uma manobra do Mestre de Batalha, com um d8 de superioridade.", rolar: "1d8" },
  { id: "golpe", custo: 2, nome: "Golpe Selvagem", texto: "Quando uma jogada de ataque sua acertar, todos os dados de dano causam o resultado máximo.", armada: true },
  { id: "arrancadaDesesperada", custo: 2, nome: "Arrancada Desesperada", texto: "Você realiza as ações Disparada e Desengajar imediatamente, como uma ação extra." },
  { id: "martir", custo: 3, nome: "Mártir", texto: "Como reação, criaturas à sua escolha em número igual à sua proficiência ganham resistência a todos os danos até o fim da próxima rodada." },
  { id: "acao", custo: 3, nome: "Ação Desesperada", texto: "Você realiza imediatamente a ação Atacar ou Magia, como uma ação extra." },
  { id: "folegoArcano", custo: 3, nome: "Fôlego Arcano", texto: "Você recupera um espaço de magia gasto, de 1º a 5º círculo." }
];

export const LEGADOS = {
  habilidade: "+2 em um valor de habilidade, até o máximo de 20",
  proficiencia: "uma proficiência em perícia, ferramenta ou arma, aprendida nas próximas sessões",
  sintonia: "sintonização imediata com um item mágico, sem ocupar o limite e ignorando restrições"
};

/* ---------- Estado ---------- */

export function estado(actor) {
  const { value, max } = hp(actor);
  return {
    hp: value, max,
    sangrando: estaSangrando(actor),
    morrendo: value <= 0 && !estaMorto(actor),
    morto: estaMorto(actor),
    queimando: !!getF(actor, F.queimando, false),
    marcadas: getF(actor, F.marcadas),
    falhas: falhasMorte(actor),
    livres: caixasLivres(actor),
    armadas: getF(actor, F.armadas, []),
    perdicao: getF(actor, F.perdicao),
    recusou: !!getF(actor, F.recusou, false)
  };
}

function marcaDoTurno() {
  const c = game.combat;
  return c?.started ? `${c.id}.${c.round}.${c.turn}` : null;
}

/* ---------- Ações ---------- */

export async function usarMedida(actor, medidaId) {
  const m = MEDIDAS.find(x => x.id === medidaId);
  const e = estado(actor);
  if (!m) return;
  if (!e.sangrando && !e.queimando) return ui.notifications.warn("As Medidas Desesperadas só se abrem enquanto você está Sangrando.");
  if (m.custo > e.livres) return ui.notifications.warn(`Faltam caixas no Fio: ${m.nome} custa ${m.custo} e restam ${e.livres}.`);
  const turno = marcaDoTurno();
  if (turno && getF(actor, F.ultimaMedida, null) === turno) {
    const ok = await confirmar("Medida Desesperada", "Você já usou uma Medida neste turno. Usar outra mesmo assim?");
    if (!ok) return;
  }

  let extra = "";
  if (m.id === "folegoArcano") {
    const nivel = await escolherEspaco(actor);
    if (!nivel) return;
    const s = actor.system.spells[`spell${nivel}`];
    await actor.update({ [`system.spells.spell${nivel}.value`]: Math.min(s.max, s.value + 1) });
    extra = `<p>Recuperou um espaço de ${nivel}º círculo.</p>`;
  }

  const updates = {
    [`flags.${ID}.${F.marcadas}`]: e.marcadas + m.custo,
    [`flags.${ID}.${F.ultimaMedida}`]: turno
  };
  if (m.armada) updates[`flags.${ID}.${F.armadas}`] = [...e.armadas, { id: m.id, nome: m.nome }];
  // Quem já está a 0 PV (queimando) enche o Fio de verdade.
  if (e.hp <= 0) updates["system.attributes.death.failure"] = Math.min(3, e.falhas + m.custo);
  await actor.update(updates);
  if (m.id === "apostar") await armarEnfase(actor, true);

  await chat(actor, `Medida Desesperada: ${m.nome}`,
    `<p><b>${esc(actor.name)}</b> marca ${m.custo} falha(s) no Fio.</p><p><i>${m.texto}</i></p>${extra}
     <p class="monolith-fio-txt">${fioTexto(estado(actor))}</p>`, { icon: "fa-heart-crack" });
  if (m.rolar) await rolar(m.rolar, actor, `${m.nome}: dado de superioridade`);
  await verificarMorte(actor);
}

async function escolherEspaco(actor) {
  const opts = [];
  for (let n = 1; n <= 5; n++) {
    const s = actor.system.spells?.[`spell${n}`];
    if (s?.max > 0 && s.value < s.max) opts.push(`<option value="${n}">${n}º círculo (${s.value}/${s.max})</option>`);
  }
  if (!opts.length) { ui.notifications.warn("Nenhum espaço de magia de 1º a 5º círculo gasto."); return null; }
  return foundry.applications.api.DialogV2.prompt({ classes: ["mono"], window: { title: "Fôlego Arcano" },
    content: `<div class="form-group"><label>Espaço</label><select name="n">${opts.join("")}</select></div>`,
    ok: { label: "Recuperar", callback: (ev, btn) => Number(btn.form.elements.n.value) }
  }).catch(() => null);
}

export async function consumirArmada(actor, index) {
  const armadas = [...getF(actor, F.armadas, [])];
  const [m] = armadas.splice(index, 1);
  await actor.setFlag(ID, F.armadas, armadas);
  if (m?.id === "apostar") await armarEnfase(actor, false);
  if (m) chat(actor, "Medida consumida", `<b>${esc(actor.name)}</b> usou ${esc(m.nome)}.`, { icon: "fa-check" });
}

export async function ajustarMarcadas(actor, delta) {
  const v = Math.clamp(getF(actor, F.marcadas) + delta, 0, 3);
  await actor.setFlag(ID, F.marcadas, v);
}

export async function ajustarPerdicao(actor, delta, motivo = "") {
  const v = Math.clamp(getF(actor, F.perdicao) + delta, 0, 20);
  await actor.setFlag(ID, F.perdicao, v);
  if (motivo) chat(actor, "Perdição", `<b>${esc(actor.name)}</b> ${delta >= 0 ? "ganha" : "perde"} ${Math.abs(delta)} de Perdição (${motivo}). Agora: <b>${v}</b>.`, { icon: "fa-eye" });
  if (v >= 20) chat(actor, "Perdido", `<b>${esc(actor.name)}</b> chegou a 20 de Perdição e está <b>Perdido</b>.`, { icon: "fa-eye-slash" });
}

/* ---------- Morte, Queima e Retorno ---------- */

export function fioTexto(e) {
  const caixas = [0, 1, 2].map(i => i < e.marcadas ? "✖" : (i < e.falhas ? "●" : "○")).join(" ");
  return `O Fio: ${caixas}`;
}

export async function verificarMorte(actor) {
  const e = estado(actor);
  if (e.morto) return;
  const cheio = (e.hp <= 0 && e.falhas >= 3) || e.marcadas >= 3 && e.hp <= 0;
  if (!cheio) return;
  await actor.update({ [`flags.${ID}.${F.queimando}`]: false });
  await actor.toggleStatusEffect("dead", { active: true, overlay: true });
  await chat(actor, "O Fio se rompeu",
    `<p><b>${esc(actor.name)}</b> morreu.</p>${e.recusou ? "" : "<p>Ainda resta <b>Recusar a Morte</b>, uma única vez.</p>"}
     <p>Se a morte for de vez, abra as Medidas Desesperadas para escolher <b>O Nome que Fica</b>.</p>`, { icon: "fa-skull" });
}

export async function queimarAlma(actor, { recusa = false } = {}) {
  const e = estado(actor);
  if (!recusa && !e.morrendo) return ui.notifications.warn("A Queima de Alma começa quando você cai a 0 PV.");
  const roll = await rolar(recusa ? "1d8" : "1d4", actor, recusa ? "Recusar a Morte: Perdição" : "Queimar a Alma: Perdição");
  const updates = {
    [`flags.${ID}.${F.queimando}`]: true,
    [`flags.${ID}.${F.perdicao}`]: Math.clamp(e.perdicao + roll.total, 0, 20)
  };
  if (recusa) {
    updates[`flags.${ID}.${F.recusou}`] = true;
    updates["system.attributes.hp.value"] = 0;
    updates["system.attributes.death.failure"] = 2;
    updates["system.attributes.death.success"] = 0;
  }
  await actor.update(updates);
  if (recusa) await actor.toggleStatusEffect("dead", { active: false });
  await actor.toggleStatusEffect("unconscious", { active: false });
  await actor.toggleStatusEffect(STATUS_QUEIMA, { active: true });
  await chat(actor, recusa ? "Recusar a Morte" : "Queimar a Alma",
    `<p><b>${esc(actor.name)}</b> ${recusa ? "recusa a morte e" : ""} queima a alma: levanta com 0 PV e age normalmente.</p>
     <p>Perdição +${roll.total} (agora ${updates[`flags.${ID}.${F.perdicao}`]}). Cada dano sofrido enche o Fio; no início de cada turno, +1 de Perdição e +1 por falha marcada.</p>`,
    { icon: "fa-fire" });
}

export async function encerrarQueima(actor, { porCura = false } = {}) {
  await actor.update({ [`flags.${ID}.${F.queimando}`]: false });
  await actor.toggleStatusEffect(STATUS_QUEIMA, { active: false });
  if (!porCura && hp(actor).value <= 0) await actor.toggleStatusEffect("unconscious", { active: true });
  await chat(actor, "Fim da Queima", porCura
    ? `<b>${esc(actor.name)}</b> recuperou PV. A Queima termina, mas as falhas marcadas continuam no Fio.`
    : `<b>${esc(actor.name)}</b> encerra a Queima e cai Inconsciente, com as falhas que já tem.`, { icon: "fa-fire-flame-simple" });
}

export async function danoNaQueima(actor, falhas = 1) {
  const f = Math.min(3, falhasMorte(actor) + falhas);
  await actor.update({ "system.attributes.death.failure": f });
  await chat(actor, "Queima: dano", `<b>${esc(actor.name)}</b> sofre dano queimando: +${falhas} falha(s). ${fioTexto(estado(actor))}`, { icon: "fa-fire" });
  await verificarMorte(actor);
}

export async function inspiracaoDoMoribundo(actor) {
  const alvo = await escolherPersonagem("Conceder Inspiração Heróica", { excluir: actor.id });
  if (!alvo) return;
  const content = `<div class="mono-card"><header><i class="fas fa-hand-holding-heart"></i> Morrendo, ainda</header>
    <div class="mono-card__body"><p><b>${esc(actor.name)}</b>, morrendo, concede uma <b>Inspiração Heróica</b> a <b>${esc(alvo.name)}</b>.</p>
    <p>Ela precisa ser gasta até o fim do próximo turno de ${esc(alvo.name)}, ou se perde.</p>
    <button type="button" data-monolith-acao="rolarHeroicaRecebida" data-actor="${alvo.id}"><i class="fas fa-dice-d6"></i> Gastar agora (+1d4)</button></div></div>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

export async function nomeQueFica(actor) {
  const alvo = await escolherPersonagem("O Nome que Fica: quem carrega o nome?", { excluir: actor.id });
  if (!alvo) return;
  const opts = Object.entries(LEGADOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  const legado = await foundry.applications.api.DialogV2.prompt({ classes: ["mono"], window: { title: "O Nome que Fica" },
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

export const STATUS_QUEIMA = "monolithQueimando";

export function registrarStatusQueima() {
  CONFIG.statusEffects.push({
    id: STATUS_QUEIMA,
    _id: "monolithqueimand",
    name: "Queimando a Alma",
    img: `modules/${ID}/icons/queima.svg`
  });
}

export function registrarGanchosMedidas() {
  // Ao cair a 0 PV, o Fio já começa com as falhas marcadas; ao se curar, a Queima termina.
  Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (userId !== game.user.id) return;
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
    const f = details.updates?.["system.attributes.death.failure"];
    if (f >= 3) setTimeout(() => verificarMorte(actor), 250);
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
    if (!souGMAtivo() && game.users.activeGM) return;
    danoNaQueima(actor, 1);
  });

  // Início do turno de quem queima: +1 de Perdição, +1 por falha marcada.
  Hooks.on("combatTurnChange", (combat) => {
    if (!souGMAtivo()) return;
    const actor = combat.combatant?.actor;
    if (!actor || !getF(actor, F.queimando, false)) return;
    const ganho = 1 + getF(actor, F.marcadas);
    ajustarPerdicao(actor, ganho, "início do turno queimando a alma");
  });
}
