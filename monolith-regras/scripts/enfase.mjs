import { ID, F, rolar } from "./util.mjs";

/**
 * Ênfase: role dois d20 e use o resultado mais distante de 10.
 * Empate em distância (ex.: 5 e 15): role um terceiro d20 e use-o.
 * Modificador de dado "ef": /r 2d20ef + 3
 */
export function registrarModificadorEnfase() {
  const Die = foundry.dice.terms.Die;
  const metodo = "monolithKeepFarthest";
  Die.prototype[metodo] = async function (modifier) {
    if (modifier !== "ef") return false;
    const ativos = this.results.filter(r => r.active && !r.discarded);
    if (ativos.length < 2) return;
    const dist = r => Math.abs(r.result - 10);
    const ordenados = [...ativos].sort((a, b) => dist(b) - dist(a));
    const empate = dist(ordenados[0]) === dist(ordenados[1]) && ordenados[0].result !== ordenados[1].result;
    if (empate) {
      for (const r of ativos) { r.active = false; r.discarded = true; }
      await this.roll();
      return;
    }
    for (const r of ordenados.slice(1)) { r.active = false; r.discarded = true; }
  };
  for (const cls of [Die, CONFIG.Dice.D20Die].filter(Boolean)) {
    if (cls.MODIFIERS) cls.MODIFIERS.ef = metodo;
  }
}

/** Aplica Ênfase à próxima rolagem de d20 do ator, se ela estiver armada. */
export function registrarEnfaseNasRolagens() {
  Hooks.on("dnd5e.postD20TestRollConfiguration", (rolls, config) => {
    const s = config.subject;
    const actor = s instanceof Actor ? s : s?.actor;
    if (!actor?.isOwner || !actor.getFlag(ID, F.enfase)) return;
    for (const roll of rolls) {
      const d = roll.d20;
      if (!d) continue;
      d.number = 2;
      d.modifiers = d.modifiers.filter(m => !/^k[hl]?\d*$/i.test(m));
      d.modifiers.push("ef");
      roll.options.monolithEnfase = true;
      roll.resetFormula();
    }
    actor.unsetFlag(ID, F.enfase);
    ui.notifications.info(`${actor.name}: rolagem com Ênfase.`);
  });
}

export async function armarEnfase(actor, ativo = true) {
  if (ativo) await actor.setFlag(ID, F.enfase, true);
  else await actor.unsetFlag(ID, F.enfase);
}

export async function rolarEnfaseSolta(actor, bonus = "") {
  const f = bonus ? `2d20ef + ${bonus}` : "2d20ef";
  return rolar(f, actor, "Rolagem com Ênfase");
}
