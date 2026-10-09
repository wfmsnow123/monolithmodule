import { ID, esc, fonteDe, combustivelDe } from "./config.mjs";

/* ---------- Estado de um item ---------- */

export const aceso = (item) => !!item?.getFlag(ID, "aceso");
export const coberta = (item) => !!item?.getFlag(ID, "coberta");
export const restante = (item) => Number(item?.getFlag(ID, "restante") ?? 0);

export function itensDeLuz(actor) {
  return (actor?.items ?? []).filter((i) => fonteDe(i) && (i.system.quantity ?? 0) > 0);
}

export function tempoTexto(seg) {
  if (!seg || seg <= 0) return "";
  const m = Math.ceil(seg / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m} min`;
}

function aviso(actor, texto, icon = "fa-fire") {
  if (!game.settings.get(ID, "avisos")) return;
  const donos = game.users.filter((u) => actor.testUserPermission(u, "OWNER")).map((u) => u.id);
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: donos,
    content: `<div class="mono-card"><header><i class="fas ${icon}"></i> Luz</header><div class="mono-card__body"><p>${texto}</p></div></div>`
  });
}

/** Acende o item. Tochas e velas começam uma unidade nova se a atual acabou; lanternas gastam combustível. */
export async function acender(item) {
  const f = fonteDe(item);
  const actor = item?.actor;
  if (!f || !actor) return;
  if ((item.system.quantity ?? 0) < 1) return ui.notifications.warn(`${item.name}: não sobrou nenhum.`);
  const updates = { [`flags.${ID}.aceso`]: true };
  if (f.duracao > 0 && restante(item) <= 0) {
    if (f.consumo === "combustivel") {
      const comb = combustivelDe(actor, f);
      if (!comb) return ui.notifications.warn(`${item.name}: sem combustível (${f.combustivel}).`);
      await gastarUm(comb);
      aviso(actor, `<b>${esc(actor.name)}</b> enche ${esc(item.name)} com ${esc(comb.name)}.`, "fa-oil-can");
    }
    updates[`flags.${ID}.restante`] = f.duracao * 60;
  }
  await item.update(updates);
}

export async function apagar(item) {
  await item.update({ [`flags.${ID}.aceso`]: false });
}

export async function alternar(item) {
  return aceso(item) ? apagar(item) : acender(item);
}

/** Lanterna coberta: alterna entre aberta e coberta (só a luz muda). */
export async function alternarCobertura(item) {
  const f = fonteDe(item);
  if (!f?.cobertaBrilho && !f?.cobertaPenumbra) return ui.notifications.info(`${item.name} não tem modo coberto.`);
  await item.update({ [`flags.${ID}.coberta`]: !coberta(item) });
}

async function gastarUm(item) {
  const q = (item.system.quantity ?? 1) - 1;
  if (q <= 0) await item.delete();
  else await item.update({ "system.quantity": q });
}

/* ---------- Luz no token ---------- */

/** Tokens de um ator em todas as cenas (o do próprio token, se for um ator de token, como uma pilha no chão). */
export function tokensDo(actor) {
  if (!actor) return [];
  if (actor.isToken) return actor.token ? [actor.token] : [];
  return game.scenes.contents.flatMap((s) => s.tokens.filter((t) => t.actorLink && t.actorId === actor.id));
}

function fatorDistancia(scene) {
  const u = String(scene?.grid?.units ?? "").toLowerCase().trim();
  return /^(m|mt|mts|metro|metros|meter|meters|metre|metres)\.?$/.test(u) ? 0.3 : 1;
}

/** A luz mais forte entre os itens acesos do ator, já no formato do token. */
export function luzDoAtor(actor, scene) {
  let melhor = null, alcance = -1;
  for (const item of itensDeLuz(actor)) {
    if (!aceso(item)) continue;
    const f = fonteDe(item);
    const cob = coberta(item) && (f.cobertaBrilho || f.cobertaPenumbra);
    const bright = cob ? f.cobertaBrilho : f.brilho;
    const dim = Math.max(bright, cob ? f.cobertaPenumbra : f.penumbra);
    if (dim > alcance) { alcance = dim; melhor = { f, bright, dim }; }
  }
  if (!melhor) return null;
  const k = fatorDistancia(scene);
  const { f } = melhor;
  return {
    bright: Math.round(melhor.bright * k * 10) / 10,
    dim: Math.round(melhor.dim * k * 10) / 10,
    angle: Number(f.angulo) || 360,
    color: f.cor || null,
    alpha: Number(f.alfa ?? 0.4),
    attenuation: 0.5,
    luminosity: 0.5,
    animation: { type: f.animacao || null, speed: 3, intensity: 3, reverse: false }
  };
}

/** Põe no token a luz que o ator carrega, ou devolve a luz que o token tinha antes. */
export async function sincronizarTokens(actor) {
  for (const token of tokensDo(actor)) {
    if (!token.isOwner) continue;
    const luz = luzDoAtor(actor, token.parent);
    const original = token.getFlag(ID, "original");
    if (luz) {
      const updates = { light: luz };
      if (!original) updates[`flags.${ID}.original`] = token.light.toObject ? token.light.toObject() : foundry.utils.deepClone(token.light);
      const atual = token.light;
      const igual = atual.bright === luz.bright && atual.dim === luz.dim && atual.angle === luz.angle && atual.color?.css === luz.color && atual.animation?.type === luz.animation.type;
      if (igual && original) continue;
      await token.update(updates);
    } else if (original) {
      await token.update({ light: original, [`flags.${ID}.-=original`]: null });
    }
  }
}

/* ---------- Queima com o tempo do mundo ---------- */

function atoresComLuz() {
  const lista = [...game.actors];
  for (const s of game.scenes) for (const t of s.tokens) if (!t.actorLink && t.actor) lista.push(t.actor);
  return lista;
}

/** Desconta o tempo que passou das chamas acesas. Roda só no GM ativo. */
export async function queimar(delta) {
  if (!(delta > 0) || !game.settings.get(ID, "queimar")) return;
  for (const actor of atoresComLuz()) {
    for (const item of itensDeLuz(actor)) {
      if (!aceso(item)) continue;
      const f = fonteDe(item);
      if (!(f.duracao > 0)) continue;
      const antes = restante(item) || f.duracao * 60;
      const depois = antes - delta;
      if (depois > 0) {
        await item.update({ [`flags.${ID}.restante`]: depois });
        if (antes > 600 && depois <= 600) aviso(actor, `A chama de ${esc(item.name)} (${esc(actor.name)}) está fraca: uns ${tempoTexto(depois)}.`, "fa-fire-flame-simple");
        continue;
      }
      // Acabou.
      await item.update({ [`flags.${ID}.aceso`]: false, [`flags.${ID}.restante`]: 0, [`flags.${ID}.coberta`]: false });
      if (f.consumo === "item") {
        await gastarUm(item);
        aviso(actor, `${esc(item.name)} de <b>${esc(actor.name)}</b> queimou até o fim e se apagou.`, "fa-fire-flame-curved");
      } else if (f.consumo === "combustivel") {
        aviso(actor, `O combustível de ${esc(item.name)} (<b>${esc(actor.name)}</b>) acabou. A chama se apagou.`, "fa-oil-can");
      } else {
        aviso(actor, `${esc(item.name)} de <b>${esc(actor.name)}</b> se apagou.`, "fa-fire-flame-curved");
      }
    }
  }
}
