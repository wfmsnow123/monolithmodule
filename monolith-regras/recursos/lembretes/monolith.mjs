/**
 * Lembretes de Monolith: só leem o estado do ator e avisam na caixinha. Nunca mudam a rolagem
 * (quem aplica Ênfase, exaustão, carga e Perdição são os módulos e scripts de cada regra).
 */
import { OPCAO, configDe, escapar } from "./util.mjs";

const D20 = new Set(["ataque", "teste", "pericia", "resistencia", "concentracao", "morte", "iniciativa"]);

/**
 * @param {Actor} actor
 * @param {object} rolagem  { tipo, habilidade }
 * @returns {{tipo:string, icone:string, rotulo:string, texto:string}[]}
 */
export function lembretesMonolith(actor, { tipo, habilidade } = {}) {
  const out = [];
  if (!actor || !D20.has(tipo)) return out;
  const get = (k) => foundry.utils.getProperty(actor, k);

  // Ênfase armada (monolith-regras): a próxima rolagem de d20 usa dois dados.
  if (get("flags.monolith-regras.enfase")) {
    out.push({ tipo: "enfase", icone: "fas fa-arrows-left-right-to-line", rotulo: "Ênfase armada", texto: "dois d20, vale o mais distante de 10" });
  }

  // Perdição: esgarçado (10+) faz os testes de resistência de Lucidez com Ênfase.
  if (tipo === "resistencia" && game.modules.get("monolith-perdicao")?.active) {
    const lucidez = configDe("monolith-perdicao", "habilidade", "san") || "san";
    if (habilidade === lucidez && Number(get("flags.monolith-perdicao.valor") ?? 0) >= 10) {
      out.push({ tipo: "enfase", icone: "fas fa-brain", rotulo: "Esgarçado", texto: "teste com Ênfase" });
    }
  }

  // Exaustão de Monolith: -1 por nível em todos os testes de d20.
  const exaustao = Number(actor.system?.attributes?.exhaustion ?? 0);
  if (exaustao > 0) {
    out.push({ tipo: "penalidade", icone: "fas fa-face-tired", rotulo: `Exaustão ${exaustao}`, texto: `-${exaustao}` });
  }

  // Faixa de carga (monolith-encumbrance): nome do efeito e desvantagem em ataques pela habilidade.
  const faixa = actor.appliedEffects?.find((e) => foundry.utils.getProperty(e, "flags.monolith-encumbrance.faixa"));
  if (faixa) {
    const desvAtaque = tipo === "ataque" && habilidade && get(`flags.monolith-encumbrance.ataque.${habilidade}`);
    out.push(desvAtaque
      ? { tipo: "desv", icone: "fas fa-weight-hanging", rotulo: "Carga", texto: `${escapar(faixa.name)}: desvantagem no ataque` }
      : { tipo: "info", icone: "fas fa-weight-hanging", rotulo: "Carga", texto: escapar(faixa.name) });
  }

  // Medidas Desesperadas armadas (monolith-medidas), esperando o gatilho de um ataque.
  if (tipo === "ataque" && game.modules.get("monolith-medidas")?.active) {
    const armadas = get("flags.monolith-medidas.armadas") ?? [];
    if (Array.isArray(armadas) && armadas.length) {
      out.push({ tipo: "medida", icone: "fas fa-heart-crack", rotulo: "Medidas armadas", texto: armadas.map((m) => escapar(m?.nome)).join(", ") });
    }
  }
  return out;
}

/** Guarda os lembretes de Monolith nas opções do diálogo. */
export function adicionarMonolith(dialog, actor, rolagem) {
  const lista = lembretesMonolith(actor, rolagem);
  if (lista.length) foundry.utils.setProperty(dialog, `options.${OPCAO}.monolith`, lista);
}
