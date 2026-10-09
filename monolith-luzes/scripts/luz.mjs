import { ID, esc, fonteDe, combustivelDe, disponivel, fonteAvulsa, gastaAoAcender, ehMagia } from "./config.mjs";
import { tempoTexto, passarTempo } from "./calculo.mjs";
import { tokenDaMao, acenderNaMao } from "./chao.mjs";

export { tempoTexto };

/* ---------- Estado de um item ---------- */

export const aceso = (item) => !!item?.getFlag(ID, "aceso");
export const coberta = (item) => !!item?.getFlag(ID, "coberta");
export const restante = (item) => Number(item?.getFlag(ID, "restante") ?? 0);

export function itensDeLuz(actor) {
  return (actor?.items ?? []).filter(disponivel);
}

/** Objetos que um token leva junto (largados no chão e ligados a ele). Cada um: {chave, item, aceso, restante, coberta, origem}. */
export function carregadas(token) {
  const l = token?.getFlag?.(ID, "carregadas") ?? token?.flags?.[ID]?.carregadas;
  return Array.isArray(l) ? l : [];
}

export function aviso(actor, texto, icon = "fa-fire") {
  if (!game.settings.get(ID, "avisos")) return;
  const donos = game.users.filter((u) => (actor ? actor.testUserPermission(u, "OWNER") : u.isGM)).map((u) => u.id);
  ChatMessage.create({
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : { alias: "Luz" },
    whisper: donos,
    content: `<div class="mono-card"><header><i class="fas ${icon}"></i> Luz</header><div class="mono-card__body"><p>${texto}</p></div></div>`
  });
}

export async function gastarUm(item) {
  const q = (item.system.quantity ?? 1) - 1;
  if (q <= 0) await item.delete();
  else await item.update({ "system.quantity": q });
}

/**
 * Prepara a queima ao acender: com tempo sobrando, segue; sem tempo, começa uma unidade nova
 * (lanternas gastam combustível de `actor`, conforme a configuração de quem acende).
 * @returns {Promise<{restante:number}|{erro:string}>}
 */
export async function abastecer(f, rest, actor, user, nome) {
  if (!(f.duracao > 0) || rest > 0) return { restante: rest };
  if (f.consumo === "combustivel" && gastaAoAcender(user)) {
    const comb = combustivelDe(actor, f);
    if (!comb) return { erro: `${nome}: sem combustível (${f.combustivel}).` };
    await gastarUm(comb);
    aviso(actor, `<b>${esc(actor.name)}</b> enche ${esc(nome)} com ${esc(comb.name)}.`, "fa-oil-can");
  }
  return { restante: f.duracao * 60 };
}

/**
 * Acende o item. Magias acendem na ficha. Objetos (tocha, vela, lanterna) não ficam acesos no inventário:
 * uma unidade vai acesa para a mão do token na cena (carregada junto). Tochas e velas começam uma unidade
 * nova se a atual acabou; lanternas gastam combustível.
 */
export async function acender(item, user = game.user) {
  const f = fonteDe(item);
  const actor = item?.actor;
  if (!f || !actor) return;
  if (!ehMagia(item) && (item.system.quantity ?? 0) < 1) return ui.notifications.warn(`${item.name}: não sobrou nenhum.`);
  if (!disponivel(item)) return ui.notifications.warn(`${item.name}: equipe antes de acender.`);
  if (!ehMagia(item)) {
    const token = tokenDaMao(actor);
    if (!token) return ui.notifications.warn(`${item.name}: ponha o token de ${actor.name} na cena para acender.`);
    return acenderNaMao(token, item, user);
  }
  const r = await abastecer(f, restante(item), actor, user, item.name);
  if (r.erro) return ui.notifications.warn(r.erro);
  await item.update({ [`flags.${ID}.aceso`]: true, [`flags.${ID}.restante`]: r.restante });
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

export const temCobertura = (f) => !!(f?.cobertaBrilho || f?.cobertaPenumbra);

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

/** Alcance de uma fonte (aberta ou coberta), em pés. */
function alcances(f, cob) {
  const c = cob && temCobertura(f);
  const bright = c ? f.cobertaBrilho : f.brilho;
  return { bright, dim: Math.max(bright, c ? f.cobertaPenumbra : f.penumbra) };
}

/** Dados de luz do Foundry para uma fonte, já convertidos para a unidade da cena. */
export function luzDaFonte(f, cob, scene) {
  const { bright, dim } = alcances(f, cob);
  const k = fatorDistancia(scene);
  return {
    bright: Math.round(bright * k * 10) / 10,
    dim: Math.round(dim * k * 10) / 10,
    angle: Number(f.angulo) || 360,
    color: f.cor || null,
    alpha: Number(f.alfa ?? 0.4),
    attenuation: 0.5,
    luminosity: 0.5,
    animation: { type: f.animacao || null, speed: 3, intensity: 3, reverse: false }
  };
}

/** A mais forte entre [fonte, coberta]. */
function maisForte(candidatas, scene) {
  let melhor = null, alcance = -1;
  for (const [f, cob] of candidatas) {
    const { dim } = alcances(f, cob);
    if (dim > alcance) { alcance = dim; melhor = [f, cob]; }
  }
  return melhor ? luzDaFonte(melhor[0], melhor[1], scene) : null;
}

/** A luz mais forte entre os itens acesos do ator, já no formato do token. */
export function luzDoAtor(actor, scene) {
  return maisForte(itensDeLuz(actor).filter(aceso).map((i) => [fonteDe(i), coberta(i)]), scene);
}

/** Itens acesos do ator, objetos que o token leva junto e a luz avulsa: vale a mais forte. */
export function luzDoToken(token) {
  const c = itensDeLuz(token.actor).filter(aceso).map((i) => [fonteDe(i), coberta(i)]);
  for (const e of carregadas(token)) {
    const f = e.aceso && fonteDe(e.item);
    if (f) c.push([f, e.coberta]);
  }
  if (token.getFlag(ID, "avulsa")) c.push([fonteAvulsa(), false]);
  return maisForte(c, token.parent);
}

/** Põe no token a luz que ele carrega, ou devolve a luz que tinha antes. */
export async function sincronizarToken(token) {
  if (!token?.isOwner) return;
  const luz = luzDoToken(token);
  const original = token.getFlag(ID, "original");
  if (luz) {
    const updates = { light: luz };
    if (!original) updates[`flags.${ID}.original`] = token.light.toObject ? token.light.toObject() : foundry.utils.deepClone(token.light);
    const atual = token.light;
    const igual = atual.bright === luz.bright && atual.dim === luz.dim && atual.angle === luz.angle && atual.color?.css === luz.color && atual.animation?.type === luz.animation.type && atual.alpha === luz.alpha;
    if (igual && original) return;
    await token.update(updates);
  } else if (original) {
    await token.update({ light: original, [`flags.${ID}.-=original`]: null });
  }
}

export async function sincronizarTokens(actor) {
  for (const token of tokensDo(actor)) await sincronizarToken(token);
}

/* ---------- Queima com o tempo do mundo ---------- */

function atoresComLuz() {
  const l = [...game.actors];
  for (const s of game.scenes) for (const t of s.tokens) if (!t.actorLink && t.actor) l.push(t.actor);
  return l;
}

/** Mensagem de quando acaba, conforme o que se gasta. */
export function textoFim(f, nome, dono) {
  const de = dono ? ` (<b>${esc(dono)}</b>)` : "";
  if (f.tipo === "magia") return [`A magia ${esc(nome)}${de} terminou.`, "fa-wand-sparkles"];
  if (f.consumo === "item") return [`${esc(nome)}${de} queimou até o fim e se apagou.`, "fa-fire-flame-curved"];
  if (f.consumo === "combustivel") return [`O combustível de ${esc(nome)}${de} acabou. A chama se apagou.`, "fa-oil-can"];
  return [`${esc(nome)}${de} se apagou.`, "fa-fire-flame-curved"];
}

/** Desconta o tempo que passou das chamas acesas nos inventários. Roda só no GM ativo. */
export async function queimar(delta) {
  if (!(delta > 0) || !game.settings.get(ID, "queimar")) return;
  for (const actor of atoresComLuz()) {
    for (const item of itensDeLuz(actor)) {
      if (!aceso(item)) continue;
      const f = fonteDe(item);
      if (!(f.duracao > 0)) continue;
      const t = passarTempo(restante(item), f.duracao, delta);
      if (!t.acabou) {
        await item.update({ [`flags.${ID}.restante`]: t.depois });
        if (t.fraca) aviso(actor, `A chama de ${esc(item.name)} (${esc(actor.name)}) está fraca: uns ${tempoTexto(t.depois)}.`, "fa-fire-flame-simple");
        continue;
      }
      // Acabou.
      await item.update({ [`flags.${ID}.aceso`]: false, [`flags.${ID}.restante`]: 0, [`flags.${ID}.coberta`]: false });
      if (f.consumo === "item" && !ehMagia(item)) await gastarUm(item);
      aviso(actor, ...textoFim(f, item.name, actor.name));
    }
  }
}
