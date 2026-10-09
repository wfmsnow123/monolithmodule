export const ID = "monolith-perdicao";

export const LIMIARES = [5, 10, 15];
export const MAXIMO = 20;

export const ESTADOS = [
  { min: 0, nome: "Firme", efeito: "Nenhum." },
  { min: 5, nome: "Abalado", efeito: "Você carrega pelo menos uma Marca." },
  { min: 10, nome: "Esgarçado", efeito: "Seus testes de resistência de Perdição são rolados com Ênfase." },
  { min: 15, nome: "À Beira", efeito: "Como Esgarçado. Os entes do véu sentem você, mesmo sem vê-lo." },
  { min: 20, nome: "Perdido", efeito: "O personagem passa às mãos do Mestre e não pode retornar da morte." }
];

export const TIPOS = {
  loucura: "Loucura",
  danacao: "Danação",
  cicatriz: "Cicatriz",
  outra: "Outra"
};

export const HORRORES = {
  comum: { nome: "Comum", ganho: "1" },
  excepcional: { nome: "Excepcional", ganho: "1d4" },
  magnanimo: { nome: "Magnânimo", ganho: "1d8" }
};

const GRAUS = { 5: "Leve", 10: "Moderado", 15: "Severo" };

/* ---------- Leitura ---------- */

export const valor = (actor) => Number(actor?.getFlag(ID, "valor") ?? 0);
export const marcas = (actor) => actor?.getFlag(ID, "marcas") ?? [];
export const ligacao = (actor) => actor?.getFlag(ID, "ligacao") ?? null;
export const piso = (actor) => Math.min(MAXIMO, 5 * marcas(actor).length);
export const estadoDe = (v) => [...ESTADOS].reverse().find((e) => v >= e.min);
export const habilidade = () => game.settings.get(ID, "habilidade") || "san";

export function podeVer(actor) {
  return game.user.isGM || (actor?.isOwner && game.settings.get(ID, "jogadoresVeem"));
}

export const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

/* ---------- Escrita ---------- */

async function cartao(actor, titulo, corpo, icon = "fa-eye") {
  const data = {
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="mono-card"><header><i class="fas ${icon}"></i> ${titulo}</header><div class="mono-card__body">${corpo}</div></div>`
  };
  if (!game.settings.get(ID, "jogadoresVeem")) data.whisper = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
  return ChatMessage.create(data);
}

function novaMarca(actor, limiar) {
  const lig = ligacao(actor);
  const danacao = !!lig?.nome;
  return {
    id: foundry.utils.randomID(),
    tipo: danacao ? "danacao" : "loucura",
    limiar,
    nome: danacao ? `Danação ${GRAUS[limiar] ?? ""} (${lig.forca || lig.nome})`.replace(" ()", "") : "Loucura Duradoura",
    persistente: "",
    agudo: "",
    definida: false
  };
}

/**
 * Define a Perdição respeitando o piso das Marcas. Ao subir por um limiar (5, 10, 15),
 * cria a Marca correspondente (se a opção estiver ligada) e avisa no chat.
 */
export async function definir(actor, novo, { motivo = "", silencioso = false } = {}) {
  if (!actor) return;
  const antigo = valor(actor);
  const lista = [...marcas(actor)];
  let alvo = Math.clamp(Math.round(novo), 0, MAXIMO);

  const novas = [];
  if (alvo > antigo && game.settings.get(ID, "marcaAutomatica")) {
    for (const L of LIMIARES) if (antigo < L && alvo >= L) novas.push(novaMarca(actor, L));
  }
  lista.push(...novas);
  const chao = Math.min(MAXIMO, 5 * lista.length);
  alvo = Math.max(alvo, chao);

  if (alvo === antigo && !novas.length) {
    if (!silencioso && novo < antigo) ui.notifications.info(`${actor.name}: a Perdição já está no piso das Marcas (${chao}).`);
    return antigo;
  }
  await actor.update({ [`flags.${ID}.valor`]: alvo, [`flags.${ID}.marcas`]: lista });

  if (!silencioso) {
    const est = estadoDe(alvo);
    const delta = alvo - antigo;
    let corpo = `<p><b>${esc(actor.name)}</b> ${delta >= 0 ? "ganha" : "perde"} ${Math.abs(delta)} de Perdição${motivo ? ` (${esc(motivo)})` : ""}.</p>
      <p>Perdição <b>${antigo} → ${alvo}</b> · ${est.nome}</p>`;
    if (alvo > novo && delta >= 0 && novo < chao) corpo += `<p class="hint">Subiu até o piso das Marcas (${chao}).</p>`;
    for (const m of novas) corpo += `<p>Limiar ${m.limiar} cruzado: nova Marca de <b>${TIPOS[m.tipo]}</b>. O Mestre define o efeito.</p>`;
    if (alvo >= MAXIMO && antigo < MAXIMO) corpo += ligacao(actor)?.nome
      ? `<p><b>Perdido e Ligado.</b> ${esc(actor.name)} não enlouquece: passa a servir a ${esc(ligacao(actor).nome)}.</p>`
      : `<p><b>Perdido.</b> O personagem passa às mãos do Mestre.</p>`;
    await cartao(actor, "Perdição", corpo, alvo >= MAXIMO ? "fa-eye-slash" : "fa-eye");
  }
  Hooks.callAll("monolithPerdicao.changed", actor, { antigo, novo: alvo, motivo, novas });
  return alvo;
}

export const ajustar = (actor, delta, opts = {}) => definir(actor, valor(actor) + Number(delta || 0), opts);

/** Rola uma fórmula de Perdição (1d4, 1d8...) e soma. */
export async function rolarGanho(actor, formula, motivo = "", { dobrar = false } = {}) {
  const f = dobrar ? `(${formula}) * 2` : String(formula);
  const roll = await new Roll(f).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `Perdição${motivo ? `: ${motivo}` : ""}` },
    { rollMode: game.settings.get(ID, "jogadoresVeem") ? undefined : CONST.DICE_ROLL_MODES.PRIVATE });
  await ajustar(actor, roll.total, { motivo });
  return roll.total;
}

export async function salvarMarcas(actor, lista) {
  const chao = Math.min(MAXIMO, 5 * lista.length);
  const updates = { [`flags.${ID}.marcas`]: lista };
  if (valor(actor) < chao) updates[`flags.${ID}.valor`] = chao;
  await actor.update(updates);
}

export async function adicionarMarca(actor, dados = {}) {
  const m = { ...novaMarca(actor, null), ...dados, id: foundry.utils.randomID() };
  await salvarMarcas(actor, [...marcas(actor), m]);
  return m;
}

export async function removerMarca(actor, id) {
  await salvarMarcas(actor, marcas(actor).filter((m) => m.id !== id));
}

export async function definirLigacao(actor, lig) {
  if (!lig?.nome) return actor.unsetFlag(ID, "ligacao");
  return actor.setFlag(ID, "ligacao", lig);
}

/* ---------- Testes ---------- */

async function salvaguarda(actor, alvo, flavor) {
  const key = habilidade();
  if (CONFIG.DND5E.abilities[key] && actor.system.abilities?.[key]) {
    const rolls = await actor.rollSavingThrow({ ability: key, target: alvo }, {}, { data: { flavor } });
    return rolls?.[0] ?? null;
  }
  // Sem a Lucidez configurada: d20 puro, com Ênfase se couber.
  const formula = valor(actor) >= 10 ? "2d20ef" : "1d20";
  const roll = await new Roll(formula).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor });
  roll.options.target = alvo;
  return roll;
}

const natural = (roll) => roll?.dice?.[0]?.results?.find((r) => r.active)?.result ?? null;

/** Teste de resistência de Perdição contra uma fonte de horror. Aplica o ganho na falha. */
export async function testar(actor, { cd = 12, horror = "comum", fonte = "" } = {}) {
  const h = HORRORES[horror] ?? HORRORES.comum;
  const roll = await salvaguarda(actor, cd, `Teste de resistência de Perdição (CD ${cd})${fonte ? `: ${fonte}` : ""}`);
  if (!roll) return null;
  const nat = natural(roll);
  const sucesso = roll.total >= cd && nat !== 1;
  const motivo = `${fonte || "horror"} ${h.nome.toLowerCase()}`;
  if (nat === 20) {
    await ajustar(actor, -1, { motivo: `20 natural contra ${fonte || "a fonte"}: imune a ela` });
  } else if (!sucesso) {
    await rolarGanho(actor, h.ganho, motivo, { dobrar: nat === 1 });
    if (nat === 1) await cartao(actor, "Loucura Transitória", `<p><b>${esc(actor.name)}</b> tirou 1 natural: o ganho dobrou e sofre uma <b>Loucura Transitória</b> até o fim da cena.</p>`, "fa-brain");
  }
  return { roll, sucesso: sucesso || nat === 20, natural: nat };
}

/** Firmar-se: suprime um efeito agudo até o fim da cena. CD 10 + número de Marcas. */
export async function firmarSe(actor) {
  const cd = 10 + marcas(actor).length;
  const roll = await salvaguarda(actor, cd, `Firmar-se (CD ${cd})`);
  if (!roll) return null;
  const ok = roll.total >= cd;
  await cartao(actor, "Firmar-se", `<p><b>${esc(actor.name)}</b> ${ok ? "se firma: o efeito agudo fica suprimido até o fim da cena." : "não se firma: o efeito agudo se manifesta."}</p>`, ok ? "fa-shield-halved" : "fa-brain");
  return ok;
}

/* ---------- Ênfase nos testes de Perdição a partir de Esgarçado ---------- */

export function registrarModificadorEnfase() {
  const Die = foundry.dice.terms.Die;
  const metodo = "monolithKeepFarthest";
  if (!Die.prototype[metodo]) {
    Die.prototype[metodo] = async function (modifier) {
      if (modifier !== "ef") return false;
      const ativos = this.results.filter((r) => r.active && !r.discarded);
      if (ativos.length < 2) return;
      const dist = (r) => Math.abs(r.result - 10);
      const ordenados = [...ativos].sort((a, b) => dist(b) - dist(a));
      if (dist(ordenados[0]) === dist(ordenados[1]) && ordenados[0].result !== ordenados[1].result) {
        for (const r of ativos) { r.active = false; r.discarded = true; }
        await this.roll();
        return;
      }
      for (const r of ordenados.slice(1)) { r.active = false; r.discarded = true; }
    };
  }
  for (const cls of [Die, CONFIG.Dice.D20Die].filter(Boolean)) if (cls.MODIFIERS) cls.MODIFIERS.ef ??= metodo;
}

export function registrarEnfase() {
  Hooks.on("dnd5e.postD20TestRollConfiguration", (rolls, config) => {
    if (!config.hookNames?.includes("SavingThrow") || config.ability !== habilidade()) return;
    const actor = config.subject;
    if (!(actor instanceof Actor) || valor(actor) < 10) return;
    for (const roll of rolls) {
      const d = roll.d20;
      if (!d || d.modifiers.includes("ef")) continue;
      d.number = 2;
      d.modifiers = d.modifiers.filter((m) => !/^k[hl]?\d*$/i.test(m));
      d.modifiers.push("ef");
      roll.options.monolithEnfase = true;
      roll.resetFormula();
    }
  });
}

/** Retrato 3x4: só ganha zoom (classe "zoom") quando a imagem não é 3x4, para preencher sem cortar as que já são. */
export function ajustarRetratos(raiz) {
  for (const img of raiz.querySelectorAll(".retrato img")) {
    const f = () => { if (img.naturalWidth) img.classList.toggle("zoom", Math.abs(img.naturalWidth / img.naturalHeight - 0.75) > 0.03); };
    if (img.complete) f(); else img.addEventListener("load", f, { once: true });
  }
}
