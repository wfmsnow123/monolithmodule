/**
 * Cálculo da ordem (portado de settings.ts, decorators.ts, getUsage.ts e getTarget.ts do Inventory Sorter),
 * atualizado para o dnd5e 5 (peso em { value, units }, ativação e alvo dentro das atividades).
 */

const NOMES_INVENTARIO = ["name", "weight", "totalWeight", "quantity", "usage"];
const comDirecao = (cols) => cols.flatMap((c) => [`${c}_asc`, `${c}_desc`]);
const lista = (cols, { padrao = false } = {}) => [...(padrao ? ["default"] : []), "none", ...comDirecao(cols)];

/**
 * Categorias de ordenação. `pai` é a categoria cuja escolha vale quando esta está em "default".
 * `antiga` é o prefixo da configuração no módulo original (para migrar).
 */
export const CATEGORIAS = [
  { id: "inventario", grupo: "inventario", antiga: "sortInventoryFallback", tipos: [], escolhas: lista(NOMES_INVENTARIO) },
  { id: "armas", grupo: "inventario", pai: "inventario", antiga: "sortInventoryWeapons", tipos: ["weapon"], escolhas: lista(NOMES_INVENTARIO, { padrao: true }) },
  { id: "equipamento", grupo: "inventario", pai: "inventario", antiga: "sortInventoryEquipment", tipos: ["equipment"], escolhas: lista(NOMES_INVENTARIO, { padrao: true }) },
  { id: "consumiveis", grupo: "inventario", pai: "inventario", antiga: "sortInventoryConsumables", tipos: ["consumable"], escolhas: lista(NOMES_INVENTARIO, { padrao: true }) },
  { id: "ferramentas", grupo: "inventario", pai: "inventario", antiga: "sortInventoryTools", tipos: ["tool"], escolhas: lista(NOMES_INVENTARIO, { padrao: true }) },
  { id: "recipientes", grupo: "inventario", pai: "inventario", antiga: "sortInventoryBackpacks", tipos: ["container", "backpack"], escolhas: lista(NOMES_INVENTARIO, { padrao: true }) },
  { id: "tesouro", grupo: "inventario", pai: "inventario", antiga: "sortInventoryLoot", tipos: ["loot"], escolhas: lista(NOMES_INVENTARIO, { padrao: true }) },
  { id: "caracteristicas", grupo: "caracteristicas", antiga: "sortFeaturesFallback", tipos: [], escolhas: lista(["name"]) },
  { id: "raca", grupo: "caracteristicas", pai: "caracteristicas", antiga: "sortFeaturesRace", tipos: ["race"], escolhas: lista(["name"], { padrao: true }) },
  { id: "antecedente", grupo: "caracteristicas", pai: "caracteristicas", antiga: "sortFeaturesBackground", tipos: ["background"], escolhas: lista(["name"], { padrao: true }) },
  { id: "classe", grupo: "caracteristicas", pai: "caracteristicas", antiga: "sortFeaturesClass", tipos: ["class", "subclass"], escolhas: lista(["name"], { padrao: true }) },
  { id: "habilidades", grupo: "caracteristicas", pai: "caracteristicas", antiga: "sortFeaturesOther", tipos: ["feat"], escolhas: lista(["name", "requirements", "usage"], { padrao: true }) },
  { id: "magias", grupo: "magias", antiga: "sortSpellsFallback", tipos: ["spell"], escolhas: lista(["name", "usage", "school", "target"]) }
];
const POR_ID = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c]));
const POR_TIPO = {};
for (const c of CATEGORIAS) for (const t of c.tipos) POR_TIPO[t] = c;

/** Padrões do original: categorias-base por nome (A-Z) e sem secundária; específicas seguem a base. */
export const ORDEM_PADRAO = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.pai ? { p: "default", s: "default" } : { p: "name_asc", s: "none" }]));

/** Mescla o valor guardado com os padrões e descarta escolhas que não existem. */
export function ordemCompleta(guardada) {
  const out = foundry.utils.deepClone(ORDEM_PADRAO);
  for (const c of CATEGORIAS) {
    const g = guardada?.[c.id];
    if (!g) continue;
    if (c.escolhas.includes(g.p)) out[c.id].p = g.p;
    if (c.escolhas.includes(g.s)) out[c.id].s = g.s;
  }
  return out;
}

const normalizar = (v) => {
  if (!v || v === "none") return null;
  const [coluna, dir] = v.split("_");
  return { coluna, desc: dir === "desc" };
};

/** Primária e secundária efetivas para a categoria (resolve "default"). */
function efetiva(cat, ordem) {
  const r = (lado) => {
    let v = ordem[cat.id]?.[lado];
    if (v === "default" && cat.pai) v = ordem[cat.pai]?.[lado];
    return normalizar(v);
  };
  return [r("p"), r("s")];
}

/** Categoria do item, ou null se o tipo não é ordenado ou se a categoria está toda em ordenação manual. */
export function categoriaDe(item, ordem) {
  const cat = POR_TIPO[item?.type];
  if (!cat) return null;
  const [p, s] = efetiva(cat, ordem);
  return p || s ? cat : null;
}

/* ---------- Valores de cada coluna ---------- */

const peso = (item) => {
  const w = item.system?.weight;
  return Number(typeof w === "object" ? w?.value : w) || 0;
};
const quantidade = (item) => Number(item.system?.quantity ?? 0) || 0;
const primeiraAtividade = (item) => item.system?.activities?.contents?.[0] ?? item.system?.activities?.values?.().next?.().value ?? null;

function uso(item) {
  const atv = primeiraAtividade(item);
  const act = atv?.activation ?? item.system?.activation;
  const tipos = Object.keys(CONFIG.DND5E?.activityActivationTypes ?? CONFIG.DND5E?.abilityActivationTypes ?? {});
  const idx = act?.type ? tipos.indexOf(act.type) : -1;
  return (idx + 1) * 1_000_000 + (Number(act?.value ?? act?.cost) || 0);
}

function alvo(item) {
  const atv = primeiraAtividade(item);
  const ind = Object.keys(CONFIG.DND5E?.individualTargetTypes ?? {});
  const area = Object.keys(CONFIG.DND5E?.areaTargetTypes ?? {});
  const t = atv?.target ?? item.system?.target;
  if (t?.template?.type) return (ind.length + area.indexOf(t.template.type) + 1) * 1_000_000 + (Number(t.template.size) || 0);
  const tipo = t?.affects?.type ?? t?.type ?? "";
  const idx = tipo ? ind.indexOf(tipo) : -1;
  return (idx + 1) * 1_000_000 + (Number(t?.affects?.count ?? t?.value) || 0);
}

function escola(item) {
  const k = item.system?.school ?? "";
  const label = CONFIG.DND5E?.spellSchools?.[k]?.label;
  return label ? game.i18n.localize(label) : k;
}

function valor(item, coluna) {
  switch (coluna) {
    case "name": return item.name ?? "";
    case "quantity": return quantidade(item);
    case "weight": return peso(item);
    case "totalWeight": return peso(item) * quantidade(item);
    case "usage": return uso(item);
    case "target": return alvo(item);
    case "school": return escola(item);
    case "requirements": return item.system?.requirements ?? "";
    default: return "";
  }
}

let _collator = null;
const collator = () => (_collator ??= new Intl.Collator(globalThis.game?.i18n?.lang || undefined, {
  usage: "sort", sensitivity: "base", ignorePunctuation: true, numeric: true
}));
const comparar = (a, b) => (typeof a === "number" && typeof b === "number" ? a - b : collator().compare(String(a), String(b)));

/**
 * Calcula o `sort` alvo de cada item ordenado: Map<id, sort>.
 * Cada tipo recomeça a numeração (como o modo legado do original), e o empate cai no `sort` atual e no id.
 */
export function calcularOrdem(items, ordem) {
  const porTipo = new Map();
  for (const item of items ?? []) {
    const cat = categoriaDe(item, ordem);
    if (!cat) continue;
    if (!porTipo.has(item.type)) porTipo.set(item.type, { cat, itens: [] });
    porTipo.get(item.type).itens.push(item);
  }
  const DENS = globalThis.CONST?.SORT_INTEGER_DENSITY ?? 100000;
  const out = new Map();
  for (const { cat, itens } of porTipo.values()) {
    const chaves = efetiva(cat, ordem).filter(Boolean);
    const dec = itens.map((item) => ({ item, v: chaves.map((k) => valor(item, k.coluna)) }));
    dec.sort((a, b) => {
      for (let i = 0; i < chaves.length; i++) {
        const c = comparar(a.v[i], b.v[i]);
        if (c) return chaves[i].desc ? -c : c;
      }
      return (a.item.sort || 0) - (b.item.sort || 0) || String(a.item.id).localeCompare(String(b.item.id));
    });
    dec.forEach((d, i) => out.set(d.item.id, (i + 1) * DENS));
  }
  return out;
}

export const categoria = (id) => POR_ID[id];
