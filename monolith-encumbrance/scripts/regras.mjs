export const ID = "monolith-encumbrance";
export const ABILIDADES = ["str", "dex", "con", "int", "wis", "cha"];
export const ROTULO_HAB = { str: "FOR", dex: "DES", con: "CON", int: "INT", wis: "SAB", cha: "CAR" };

/**
 * Uma faixa de carga.
 * @typedef {object} Faixa
 * @property {string} id
 * @property {string} nome
 * @property {boolean} ativa
 * @property {number} multiplicador   Limite = multiplicador x Força (x tamanho), na unidade de "unidadeRegra".
 * @property {string} img
 * @property {"nenhum"|"reduzir"|"multiplicar"|"definir"} deslocamentoModo
 * @property {number} deslocamentoValor   Na unidade de distância do mundo (pés ou metros).
 * @property {{ataque: string[], teste: string[], resistencia: string[]}} desvantagem
 * @property {string} efeitosExtras   Uma mudança por linha: chave | modo | valor
 * @property {string} descricao
 */

/** Regra de Monolith: 5x e 10x Força em libras (2,5 kg e 5 kg por ponto de Força com pesos em quilos). */
export function faixasPadrao() {
  return [
    {
      id: "sobrecarregado",
      nome: "Sobrecarregado",
      ativa: true,
      multiplicador: 5,
      img: "systems/dnd5e/icons/svg/statuses/encumbered.svg",
      deslocamentoModo: "reduzir",
      deslocamentoValor: 10,
      desvantagem: { ataque: [], teste: [], resistencia: [] },
      efeitosExtras: "",
      descricao: "Deslocamento reduzido em 3 metros (10 pés)."
    },
    {
      id: "severamente",
      nome: "Severamente Sobrecarregado",
      ativa: true,
      multiplicador: 10,
      img: "systems/dnd5e/icons/svg/statuses/heavily-encumbered.svg",
      deslocamentoModo: "reduzir",
      deslocamentoValor: 20,
      desvantagem: { ataque: ["str", "dex", "con"], teste: ["str", "dex", "con"], resistencia: ["str", "dex", "con"] },
      efeitosExtras: "",
      descricao: "Deslocamento reduzido em 6 metros (20 pés) e desvantagem em ataques, testes de habilidade e testes de resistência de Força, Destreza e Constituição."
    },
    {
      id: "acimaCapacidade",
      nome: "Acima da Capacidade",
      ativa: false,
      multiplicador: 15,
      img: "systems/dnd5e/icons/svg/statuses/exceeding-carrying-capacity.svg",
      deslocamentoModo: "definir",
      deslocamentoValor: 5,
      desvantagem: { ataque: ["str", "dex", "con"], teste: ["str", "dex", "con"], resistencia: ["str", "dex", "con"] },
      efeitosExtras: "",
      descricao: "Mal consegue se mover."
    }
  ];
}

export function registrarConfiguracoes(EditorClass) {
  game.settings.register(ID, "faixas", { scope: "world", config: false, type: Array, default: faixasPadrao() });
  game.settings.register(ID, "unidadeRegra", {
    name: "Unidade dos multiplicadores",
    hint: "Em que unidade os multiplicadores das faixas foram escritos. 'Libras' segue o livro (5 x Força); com pesos em quilos no mundo, o limite vira metade em kg.",
    scope: "world", config: true, type: String, default: "lb",
    choices: { lb: "Libras (regra do livro)", kg: "Quilos (5 x Força = 5 kg por ponto)" },
    onChange: () => recalcularTodos()
  });
  game.settings.register(ID, "pesoEquipado", {
    name: "Peso de itens equipados (x)",
    hint: "Multiplicador do peso de armas, armaduras e itens equipados. 1 = peso normal.",
    scope: "world", config: true, type: Number, default: 1, onChange: () => recalcularTodos()
  });
  game.settings.register(ID, "pesoNaoEquipado", {
    name: "Peso de itens não equipados (x)",
    hint: "Multiplicador do peso de itens carregados mas não equipados. 1 = peso normal.",
    scope: "world", config: true, type: Number, default: 1, onChange: () => recalcularTodos()
  });
  game.settings.register(ID, "usarTamanho", {
    name: "Tamanho e Constituição Poderosa ampliam os limites",
    hint: "Usa o multiplicador de capacidade do tamanho da criatura, como o dnd5e.",
    scope: "world", config: true, type: Boolean, default: true, onChange: () => recalcularTodos()
  });
  game.settings.register(ID, "incluirNpcs", {
    name: "Aplicar também a NPCs",
    scope: "world", config: true, type: Boolean, default: false, onChange: () => recalcularTodos()
  });
  game.settings.registerMenu(ID, "editor", {
    name: "Faixas de carga",
    label: "Editar faixas de carga",
    hint: "Limites, deslocamento, desvantagens e efeitos de cada faixa.",
    icon: "fas fa-weight-hanging",
    type: EditorClass,
    restricted: true
  });
}

export function faixas() {
  const lista = game.settings.get(ID, "faixas");
  return (Array.isArray(lista) ? lista : faixasPadrao()).filter((f) => f && f.ativa !== false);
}

let recalcular = () => {};
export function definirRecalculo(fn) { recalcular = fn; }
export function recalcularTodos() { recalcular(); }
