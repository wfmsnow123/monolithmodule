import { ID } from "./util.mjs";

/**
 * Sobrecarga de Monolith, sobre a carga variante do próprio dnd5e:
 *  - acima de N x Força: sobrecarregado, deslocamento -3 m (10 pés);
 *  - acima de M x Força, até a capacidade: severamente sobrecarregado, -6 m (20 pés) e
 *    desvantagem em ataques, testes de habilidade e testes de resistência de Força, Destreza ou Constituição.
 * O dnd5e já calcula os limites e reduz o deslocamento; este módulo ajusta os multiplicadores e aplica a desvantagem.
 */
const FISICAS = new Set(["str", "dex", "con"]);

/** Com o Monolith: Encumbrance ativo, ele cuida da carga e esta parte fica desligada. */
const ENCUMBRANCE = () => !!game.modules.get("monolith-encumbrance")?.active;

export function registrarConfigSobrecarga() {
  if (ENCUMBRANCE()) return;
  game.settings.register(ID, "sobrecargaAtiva", {
    name: "Sobrecarga: desvantagem quando severamente sobrecarregado",
    hint: "Ataques, testes de habilidade e testes de resistência de Força, Destreza e Constituição ganham desvantagem. Exige a carga variante do dnd5e.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(ID, "sobrecargaLimite1", {
    name: "Sobrecarga: sobrecarregado acima de (x Força)",
    hint: "Em libras na regra original. Com pesos em quilos, o dnd5e usa metade (2,5 kg por ponto de Força para 5 lb). Use 0 para manter o padrão do dnd5e.",
    scope: "world", config: true, type: Number, default: 0, requiresReload: true
  });
  game.settings.register(ID, "sobrecargaLimite2", {
    name: "Sobrecarga: severamente sobrecarregado acima de (x Força)",
    hint: "Mesma unidade do campo anterior. Use 0 para manter o padrão do dnd5e.",
    scope: "world", config: true, type: Number, default: 0, requiresReload: true
  });
}

/** Aplica multiplicadores personalizados (na unidade de peso usada pelo mundo). */
export function aplicarLimitesSobrecarga() {
  if (ENCUMBRANCE()) return;
  const t = CONFIG.DND5E.encumbrance?.threshold;
  if (!t) return;
  const metric = game.settings.get("dnd5e", "metricWeightUnits");
  const unidade = metric ? "metric" : "imperial";
  const l1 = Number(game.settings.get(ID, "sobrecargaLimite1")) || 0;
  const l2 = Number(game.settings.get(ID, "sobrecargaLimite2")) || 0;
  if (l1 > 0) t.encumbered[unidade] = l1;
  if (l2 > 0) t.heavilyEncumbered[unidade] = l2;
}

function severamente(actor) {
  return !!actor?.statuses?.has?.("heavilyEncumbered");
}

function ativo() {
  return game.settings.get(ID, "sobrecargaAtiva") && game.settings.get("dnd5e", "encumbrance") === "variant";
}

export function registrarGanchosSobrecarga() {
  if (ENCUMBRANCE()) return;
  const marcar = (config, actor, ability) => {
    if (!ativo() || !severamente(actor) || !FISICAS.has(ability)) return;
    config.disadvantage = true;
  };

  // Testes de habilidade (incluem perícias, ferramentas e iniciativa) e testes de resistência.
  Hooks.on("dnd5e.preRollAbilityCheckV2", (config) => {
    const actor = config.subject;
    marcar(config, actor, config.ability);
  });
  Hooks.on("dnd5e.preRollSavingThrowV2", (config) => {
    const actor = config.subject;
    marcar(config, actor, config.ability);
  });

  // Jogadas de ataque: a habilidade usada pela atividade de ataque.
  Hooks.on("dnd5e.preRollAttackV2", (config) => {
    const activity = config.subject;
    const actor = activity?.actor;
    const ability = activity?.ability;
    marcar(config, actor, ability);
  });
}

export function avisarCargaVariante() {
  if (ENCUMBRANCE()) return;
  if (!game.user.isGM) return;
  if (game.settings.get(ID, "sobrecargaAtiva") && game.settings.get("dnd5e", "encumbrance") !== "variant") {
    ui.notifications.warn("Monolith: a Sobrecarga precisa da carga variante do dnd5e (Configurações do sistema > Regras de Carga > Variante).");
  }
}
