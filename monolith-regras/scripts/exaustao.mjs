import { ID, chat } from "./util.mjs";

/**
 * Exaustão de Monolith: 10 níveis, -1 cumulativo em todos os testes de d20 e na CD de magia.
 *  3: desvantagem em testes de habilidade
 *  4: deslocamento reduzido à metade
 *  7: desvantagem em jogadas de ataque e testes de resistência
 *  9: pontos de vida máximos reduzidos à metade
 * 10: morte
 */
export const NIVEIS = 10;

export const DESCRICOES = [
  "Sem exaustão",
  "-1",
  "-2",
  "-3 e desvantagem em testes de habilidade",
  "-4 e deslocamento reduzido à metade",
  "-5",
  "-6",
  "-7 e desvantagem em ataques e testes de resistência",
  "-8",
  "-9 e pontos de vida máximos reduzidos à metade",
  "Morte"
];


export function configurarExaustao() {
  const ex = CONFIG.DND5E.conditionTypes.exhaustion;
  ex.levels = NIVEIS;
  // O dnd5e monta o ícone de cada nível como "<img>-N.svg"; os ícones 1 a 10 vêm com o módulo.
  ex.img = `modules/${ID}/icons/exhaustion.svg`;
  ex.reduction = { rolls: 0, speed: 0 };
  const se = CONFIG.statusEffects.find(s => s.id === "exhaustion");
  if (se) se.img = ex.img;

  // Remove as penalidades de exaustão da regra legada e põe as de Monolith.
  const ce = CONFIG.DND5E.conditionEffects;
  for (const set of Object.values(ce)) {
    for (const k of [...set]) if (/^exhaustion-\d+$/.test(k)) set.delete(k);
  }
  ce.abilityCheckDisadvantage.add("exhaustion-3");
  ce.halfMovement.add("exhaustion-4");
  ce.abilitySaveDisadvantage.add("exhaustion-7");
  ce.attackDisadvantage.add("exhaustion-7");
  ce.halfHealth.add("exhaustion-9");
}

function mudancas(nivel) {
  if (!nivel) return [];
  const ADD = CONST.ACTIVE_EFFECT_MODES.ADD;
  const v = String(-nivel);
  return [
    "system.bonuses.abilities.check",
    "system.bonuses.abilities.save",
    "system.bonuses.mwak.attack",
    "system.bonuses.rwak.attack",
    "system.bonuses.msak.attack",
    "system.bonuses.rsak.attack",
    "system.bonuses.spell.dc"
  ].map(key => ({ key, mode: ADD, value: v, priority: 20 }));
}

function ehExaustao(effect) {
  return effect.id === CONFIG.ActiveEffect.documentClass.ID?.EXHAUSTION || effect.statuses?.has?.("exhaustion");
}

export function registrarExaustao() {
  // Penalidade numérica: grava as mudanças no próprio efeito de exaustão do dnd5e,
  // na mesma operação que muda o nível (sem atualização extra).
  Hooks.on("preCreateActiveEffect", (effect, data) => {
    if (!ehExaustao(effect)) return;
    const nivel = foundry.utils.getProperty(data, "flags.dnd5e.exhaustionLevel") ?? 1;
    effect.updateSource({ changes: mudancas(nivel), description: DESCRICOES[nivel] ?? "" });
  });
  Hooks.on("preUpdateActiveEffect", (effect, changes) => {
    if (!ehExaustao(effect)) return;
    const nivel = foundry.utils.getProperty(changes, "flags.dnd5e.exhaustionLevel");
    if (nivel === undefined) return;
    changes.changes = mudancas(nivel);
    changes.description = DESCRICOES[nivel] ?? "";
  });

  // Nível 7+: desvantagem em jogadas de ataque (o dnd5e não tem chave de efeito para isso).
  Hooks.on("dnd5e.preRollAttackV2", (config) => {
    const actor = config.subject?.actor;
    if ((actor?.system.attributes?.exhaustion ?? 0) >= 7) config.disadvantage = true;
  });

  // Aviso no chat quando o nível muda.
  Hooks.on("updateActor", (actor, changes, options, userId) => {
    if (userId !== game.user.id) return;
    const novo = foundry.utils.getProperty(changes, "system.attributes.exhaustion");
    if (novo === undefined) return;
    const antigo = options.dnd5e?.originalExhaustion;
    if (antigo === novo) return;
    const texto = novo >= NIVEIS
      ? `<b>${actor.name}</b> chegou ao nível ${NIVEIS} de Exaustão. <b>Morte.</b>`
      : `<b>${actor.name}</b> está com Exaustão ${novo}: ${DESCRICOES[novo] ?? ""}.`;
    chat(actor, "Exaustão", texto, { icon: "fa-face-tired" });
  });
}

/** Ajusta a ficha Tidy Clássica, que tem configuração própria de níveis. */
export async function configurarTidyExaustao(api) {
  if (!game.user.isGM) return;
  try {
    const atual = game.settings.get("tidy5e-sheet", "exhaustionConfig");
    if (atual?.type === "specific" && atual.levels === NIVEIS && atual.hints?.[3] === DESCRICOES[3]) return;
    await api.config.exhaustion.useSpecificLevelExhaustion({ totalLevels: NIVEIS, hints: DESCRICOES });
  } catch (err) {
    console.warn(`${ID} | Não foi possível configurar a exaustão da ficha Tidy Clássica.`, err);
  }
}

/** Reaplica as mudanças em atores que já tinham exaustão antes do módulo existir. */
export async function migrarExaustao() {
  if (!game.users.activeGM?.isSelf) return;
  for (const actor of game.actors) {
    const eff = actor.effects.get(CONFIG.ActiveEffect.documentClass.ID?.EXHAUSTION);
    if (!eff) continue;
    const nivel = eff.getFlag("dnd5e", "exhaustionLevel") ?? 1;
    const desejado = mudancas(nivel);
    if (JSON.stringify(eff.changes.map(c => c.key)) !== JSON.stringify(desejado.map(c => c.key))
      || eff.changes[0]?.value !== desejado[0]?.value) {
      await eff.update({ changes: desejado, description: DESCRICOES[nivel] ?? "" });
    }
  }
}
