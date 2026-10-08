import { ID, faixas } from "./regras.mjs";

const EFFECT_FLAG = "faixa";
const MODOS = { add: 2, adicionar: 2, multiply: 1, multiplicar: 1, override: 5, definir: 5, upgrade: 4, downgrade: 3, custom: 0 };
const MOVIMENTOS = ["walk", "fly", "swim", "climb", "burrow"];

/** Peso carregado, aplicando os multiplicadores de itens equipados e não equipados. */
export function pesoCarregado(actor) {
  const enc = actor.system.attributes?.encumbrance;
  const fEq = Number(game.settings.get(ID, "pesoEquipado")) || 1;
  const fNe = Number(game.settings.get(ID, "pesoNaoEquipado")) || 1;
  if (fEq === 1 && fNe === 1) return enc?.value ?? 0;
  const unidade = game.settings.get("dnd5e", "metricWeightUnits") ? "metric" : "imperial";
  const base = CONFIG.DND5E.encumbrance.baseUnits?.[actor.type] ?? CONFIG.DND5E.encumbrance.baseUnits.default;
  let peso = 0;
  for (const item of actor.items) {
    if (item.container) continue;
    const w = item.system.totalWeightIn?.(base[unidade]) ?? 0;
    peso += w * (item.system.equipped ? fEq : fNe);
  }
  // Moedas: a diferença entre o total do dnd5e e a soma dos itens sem multiplicador.
  const somaItens = actor.items.filter((i) => !i.container).reduce((s, i) => s + (i.system.totalWeightIn?.(base[unidade]) ?? 0), 0);
  peso += Math.max(0, (enc?.value ?? 0) - somaItens);
  return Math.round(peso * 10) / 10;
}

/** Fator de tamanho (e Constituição Poderosa), igual ao dnd5e. */
function fatorTamanho(actor) {
  if (!game.settings.get(ID, "usarTamanho")) return 1;
  const keys = Object.keys(CONFIG.DND5E.actorSizes);
  const i = keys.indexOf(actor.system.traits?.size);
  const k = keys[actor.flags.dnd5e?.powerfulBuild ? Math.min(i + 1, keys.length - 1) : i];
  const cfg = CONFIG.DND5E.actorSizes[k];
  return cfg?.capacityMultiplier ?? cfg?.token ?? 1;
}

/** Limite de uma faixa na unidade de peso do mundo. */
export function limite(actor, faixa) {
  const str = actor.system.abilities?.str?.value ?? 10;
  const metricMundo = game.settings.get("dnd5e", "metricWeightUnits");
  const unidadeRegra = game.settings.get(ID, "unidadeRegra");
  let conv = 1;
  if (unidadeRegra === "lb" && metricMundo) conv = 0.5;
  if (unidadeRegra === "kg" && !metricMundo) conv = 2;
  return Math.round(Number(faixa.multiplicador) * str * fatorTamanho(actor) * conv * 10) / 10;
}

/** Faixa mais alta cujo limite foi ultrapassado (ou null). */
export function faixaAtual(actor) {
  const peso = pesoCarregado(actor);
  const lista = [...faixas()].sort((a, b) => Number(a.multiplicador) - Number(b.multiplicador));
  let atual = null;
  for (const f of lista) if (peso > limite(actor, f)) atual = f;
  return atual;
}

function parseExtras(texto) {
  const out = [];
  for (const linha of String(texto ?? "").split(/\r?\n/)) {
    const t = linha.trim();
    if (!t || t.startsWith("#")) continue;
    const [key, modo, ...resto] = t.split("|").map((x) => x.trim());
    if (!key) continue;
    const mode = MODOS[String(modo ?? "add").toLowerCase()] ?? Number(modo) ?? 2;
    out.push({ key, mode, value: resto.join("|"), priority: 20 });
  }
  return out;
}

export function mudancas(faixa) {
  const c = [];
  const v = Number(faixa.deslocamentoValor) || 0;
  if (faixa.deslocamentoModo === "reduzir" && v) c.push({ key: "system.attributes.movement.bonus", mode: 2, value: String(-v), priority: 20 });
  if (faixa.deslocamentoModo === "multiplicar") for (const m of MOVIMENTOS) c.push({ key: `system.attributes.movement.${m}`, mode: 1, value: String(v), priority: 20 });
  if (faixa.deslocamentoModo === "definir") for (const m of MOVIMENTOS) c.push({ key: `system.attributes.movement.${m}`, mode: 5, value: String(v), priority: 50 });
  const d = faixa.desvantagem ?? {};
  for (const a of d.teste ?? []) c.push({ key: `system.abilities.${a}.check.roll.mode`, mode: 2, value: "-1", priority: 20 });
  for (const a of d.resistencia ?? []) c.push({ key: `system.abilities.${a}.save.roll.mode`, mode: 2, value: "-1", priority: 20 });
  for (const a of d.ataque ?? []) c.push({ key: `flags.${ID}.ataque.${a}`, mode: 5, value: "true", priority: 20 });
  return c.concat(parseExtras(faixa.efeitosExtras));
}

function efeitoGerenciado(actor) {
  return actor.effects.find((e) => e.getFlag(ID, EFFECT_FLAG) !== undefined);
}

/** Cria, troca ou remove o efeito da faixa atual. */
export async function atualizarAtor(actor) {
  if (!actor || !["character", "npc"].includes(actor.type)) return;
  if (actor.type === "npc" && !game.settings.get(ID, "incluirNpcs")) {
    const e = efeitoGerenciado(actor);
    if (e) await e.delete();
    return;
  }
  const faixa = faixaAtual(actor);
  const atual = efeitoGerenciado(actor);
  if (!faixa) {
    if (atual) await atual.delete();
    return;
  }
  const dados = {
    name: faixa.nome,
    img: faixa.img || "icons/svg/anchor.svg",
    description: faixa.descricao || "",
    changes: mudancas(faixa),
    disabled: false,
    flags: { [ID]: { [EFFECT_FLAG]: faixa.id, assinatura: JSON.stringify(faixa) } }
  };
  if (atual) {
    if (atual.getFlag(ID, "assinatura") === dados.flags[ID].assinatura) return;
    await atual.update(dados);
  } else {
    await actor.createEmbeddedDocuments("ActiveEffect", [dados]);
  }
}

/** Desvantagem em ataques: o dnd5e não tem chave de efeito para isso. */
export function registrarDesvantagemDeAtaque() {
  Hooks.on("dnd5e.preRollAttackV2", (config) => {
    const activity = config.subject;
    const actor = activity?.actor;
    const ability = activity?.ability;
    if (ability && actor?.getFlag(ID, `ataque.${ability}`)) config.disadvantage = true;
  });
}
