/**
 * Vantagem, desvantagem e crítico a partir de efeitos (flags do Midi-QOL), condições e modos de rolagem.
 * Os "Lembrete" ajustam as opções da rolagem como o Advantage Reminder fazia; as "Fonte" só juntam os nomes
 * do que causou cada coisa para mostrar na caixinha do diálogo.
 */
import { OPCAO, chaves, mudancasAplicaveis } from "./util.mjs";

/* ---------- Condições: conjuntos extras em CONFIG.DND5E.conditionEffects ---------- */

export const COND = {
  vantAtaque: "mlemAdvantageAttack",
  vantResDes: "mlemAdvantageDexSave",
  desvAtaque: "mlemDisadvantageAttack",
  desvTeste: "mlemDisadvantageAbility",
  desvRes: "mlemDisadvantageSave",
  desvResDes: "mlemDisadvantageDexSave",
  desvFisico: "mlemDisadvantagePhysicalRolls",
  falhaResDes: "mlemFailDexSave",
  falhaResFor: "mlemFailStrSave",
  concedeVantAtaque: "mlemGrantAdvantageAttack",
  concedeCritAdjacente: "mlemGrantAdjacentCritical",
  concedeDesvAtaque: "mlemGrantDisadvantageAttack",
  concedeAdjacente: "mlemGrantAdjacentAttack",
  vantIniciativa: "mlemAdvantageInitiative",
  desvIniciativa: "mlemDisadvantageInitiative"
};

/** Liga as condições do sistema às vantagens e desvantagens (opção "Atualizar condições"). */
export function atualizarCondicoes() {
  const ce = CONFIG.DND5E.conditionEffects;
  ce[COND.vantAtaque] = new Set(["hiding", "invisible"]);
  ce[COND.vantResDes] = new Set(["dodging"]);
  ce[COND.desvAtaque] = new Set(["blinded", "frightened", "poisoned", "prone", "restrained"]);
  ce[COND.desvTeste] = new Set(["frightened", "poisoned"]);
  ce[COND.desvRes] = new Set();
  ce[COND.desvResDes] = new Set(["restrained"]);
  ce[COND.desvFisico] = new Set(["heavilyEncumbered"]);
  ce[COND.falhaResDes] = new Set(["paralyzed", "petrified", "stunned", "unconscious"]);
  ce[COND.falhaResFor] = new Set(["paralyzed", "petrified", "stunned", "unconscious"]);
  ce[COND.concedeVantAtaque] = new Set(["blinded", "paralyzed", "petrified", "restrained", "stunned", "unconscious"]);
  ce[COND.concedeCritAdjacente] = new Set(["paralyzed", "unconscious"]);
  ce[COND.concedeDesvAtaque] = new Set(["dodging", "hidden", "invisible"]);
  // Adjacente: vantagem no ataque; à distância: desvantagem.
  ce[COND.concedeAdjacente] = new Set(["prone"]);

  if (game.settings.get("dnd5e", "rulesVersion") === "legacy") {
    // Exaustão de Monolith (não a de 2014): 3 desvantagem em testes; 7 em ataques e resistências.
    ce[COND.desvTeste].add("exhaustion-3");
    ce[COND.desvRes].add("exhaustion-7");
    ce[COND.desvAtaque].add("exhaustion-7");
  } else {
    ce[COND.vantIniciativa] = new Set(["invisible"]);
    ce[COND.desvIniciativa] = new Set(["incapacitated", "surprised"]);
  }
}

/** Ids das condições (ou níveis de exaustão) do ator que ativam um conjunto. */
function condicoesDoEfeito(actor, chave) {
  const props = CONFIG.DND5E.conditionEffects[chave] ?? new Set();
  const nivel = actor.system.attributes?.exhaustion ?? null;
  const imunes = actor.system.traits?.ci?.value ?? new Set();
  const statuses = actor.statuses ?? new Set();
  return [...props].filter((k) => {
    const l = Number(k.split("-").pop());
    return (statuses.has(k) && !imunes.has(k))
      || (!imunes.has("exhaustion") && nivel !== null && Number.isInteger(l) && nivel >= l);
  });
}

const contagemVazia = () => ({
  override: null,
  advantages: { count: 0, suppressed: false },
  disadvantages: { count: 0, suppressed: false }
});

/* ---------- Acumuladores ---------- */

export class Acumulador {
  constructor(counts) { this.counts = counts; }

  aplicarFlags(flags, vant, desv) {
    this.counts.advantages.count += vant.filter((k) => flags[k]).length;
    this.counts.disadvantages.count += desv.filter((k) => flags[k]).length;
  }

  aplicarCondicoes(actor, vant, desv) {
    if (!actor) return;
    this.counts.advantages.count += vant.flatMap((c) => this.condicao(actor, c)).length;
    this.counts.disadvantages.count += desv.flatMap((c) => this.condicao(actor, c)).length;
  }

  condicao(actor, chave) { return condicoesDoEfeito(actor, chave); }

  /** Efeitos que mexem direto em modos de rolagem (copiado de AdvantageModeField#applyChange). */
  aplicarEfeitosDeModo(actor, caminhos) {
    for (const change of mudancasAplicaveis(actor, (c) => caminhos.includes(c.key))) {
      const delta = Number(change.value);
      const M = CONST.ACTIVE_EFFECT_MODES;
      switch (change.mode) {
        case M.ADD: this._somar(delta, change); break;
        case M.OVERRIDE: this._impor(delta, change); break;
        case M.UPGRADE: this._melhorar(delta, change); break;
        case M.DOWNGRADE: this._piorar(delta, change); break;
      }
    }
  }

  _somar(delta) {
    if (delta === 1) this.counts.advantages.count++;
    else if (delta === -1) this.counts.disadvantages.count++;
  }
  _impor(delta) { if ([-1, 0, 1].includes(delta)) this.counts.override = delta; }
  _melhorar(delta) {
    if (delta !== 1 && delta !== 0) return;
    this.counts.disadvantages.suppressed = true;
    if (delta === 1) this.counts.advantages.count++;
  }
  _piorar(delta) {
    if (delta !== -1 && delta !== 0) return;
    this.counts.advantages.suppressed = true;
    if (delta === -1) this.counts.disadvantages.count++;
  }

  vantagem(rotulo) { if (rotulo) this.counts.advantages.count++; }
  desvantagem(rotulo) { if (rotulo) this.counts.disadvantages.count++; }

  atualizar(options) {
    const modo = dnd5e.dataModels.fields.AdvantageModeField.resolveMode({ _source: {} }, "", this.counts);
    options.advantage = modo === 1;
    options.disadvantage = modo === -1;
  }
}

export class AcumuladorCritico extends Acumulador {
  aplicarFlags(flags, crit, normal) {
    this.counts.critical.count += crit.filter((k) => flags[k]).length;
    this.counts.critical.suppressed ||= normal.some((k) => flags[k]);
  }
  critico(rotulo) { if (rotulo) this.counts.critical.count++; }
  atualizar(options) {
    options.isCritical = this.counts.critical.suppressed ? false : this.counts.critical.count > 0;
  }
}

/* ---------- Lembretes (mudam vantagem/desvantagem/crítico) ---------- */

/** Flags do Midi-QOL no ator, achatadas, só as verdadeiras. */
function flagsMidi(actor) {
  const flat = foundry.utils.flattenObject(actor?.flags?.["midi-qol"] ?? {});
  for (const k of Object.keys(flat)) if (flat[k] !== true) delete flat[k];
  return flat;
}

const FISICAS = ["str", "dex", "con"];

class LembreteBase {
  static Acumulador = Acumulador;

  constructor(actor) {
    this.actor = actor;
    this.flagsAtor = this._flags(actor);
  }

  _flags(actor) { return flagsMidi(actor); }

  get vantagens() { return []; }
  get desvantagens() { return []; }
  get condicoesVant() { return []; }
  get condicoesDesv() { return []; }
  /** Caminhos de modo de rolagem do ator usados na contagem: { caminho: [rótulos] }. */
  get modos() { return {}; }

  atualizarOpcoes(options) {
    const acc = new this.constructor.Acumulador(this._contagemInicial(this.modos, options));
    acc.aplicarFlags(this.flagsAtor, this.vantagens, this.desvantagens);
    acc.aplicarCondicoes(this.actor, this.condicoesVant, this.condicoesDesv);
    this._extra(acc);
    acc.atualizar(options);
  }

  _contagemInicial(modos, options) {
    if (foundry.utils.isEmpty(modos)) {
      const c = contagemVazia();
      if (options.advantage) c.advantages.count++;
      if (options.disadvantage) c.disadvantages.count++;
      return c;
    }
    const caminho = Object.keys(modos)[0];
    return foundry.utils.deepClone(dnd5e.dataModels.fields.AdvantageModeField.getCounts(this.actor, caminho));
  }

  _extra(acc) {}
}

export class LembreteAtaque extends LembreteBase {
  constructor(actor, alvo, activity, distancia) {
    super(actor);
    this.alvo = alvo;
    this.flagsAlvo = this._flags(alvo);
    this.tipo = activity.actionType;
    this.habilidade = activity.ability;
    this.distancia = distancia;
  }

  get vantagens() {
    return ["advantage.all", "advantage.attack.all", `advantage.attack.${this.tipo}`, `advantage.attack.${this.habilidade}`];
  }
  get desvantagens() {
    return ["disadvantage.all", "disadvantage.attack.all", `disadvantage.attack.${this.tipo}`, `disadvantage.attack.${this.habilidade}`];
  }
  get condicoesVant() { return [COND.vantAtaque]; }
  get condicoesDesv() {
    const c = [COND.desvAtaque];
    if (FISICAS.includes(this.habilidade)) c.push(COND.desvFisico);
    return c;
  }

  _extra(acc) {
    acc.aplicarFlags(this.flagsAlvo,
      ["grants.advantage.attack.all", `grants.advantage.attack.${this.tipo}`],
      ["grants.disadvantage.attack.all", `grants.disadvantage.attack.${this.tipo}`]);
    acc.aplicarCondicoes(this.alvo, [COND.concedeVantAtaque], [COND.concedeDesvAtaque]);
    if (this.alvo) {
      const adj = acc.condicao(this.alvo, COND.concedeAdjacente);
      if (adj.length) {
        const fn = this.distancia() <= 5 ? acc.vantagem.bind(acc) : acc.desvantagem.bind(acc);
        adj.forEach((r) => fn(r));
      }
    }
  }
}

class LembreteHabilidadeBase extends LembreteBase {
  constructor(actor, habilidade) {
    super(actor);
    this.habilidade = habilidade;
  }
  get vantagens() { return ["advantage.all", "advantage.ability.all"]; }
  get desvantagens() { return ["disadvantage.all", "disadvantage.ability.all"]; }
  get condicoesDesv() { return FISICAS.includes(this.habilidade) ? [COND.desvFisico] : []; }
}

export class LembreteTeste extends LembreteHabilidadeBase {
  get vantagens() { return super.vantagens.concat(["advantage.ability.check.all", `advantage.ability.check.${this.habilidade}`]); }
  get desvantagens() { return super.desvantagens.concat(["disadvantage.ability.check.all", `disadvantage.ability.check.${this.habilidade}`]); }
  get condicoesDesv() { return super.condicoesDesv.concat(COND.desvTeste); }
  get modosFonte() { return { [`system.abilities.${this.habilidade}.check.roll.mode`]: this._rotuloHab("DND5E.ActionAbil") }; }
  _rotuloHab(tipo) { return [CONFIG.DND5E.abilities[this.habilidade]?.label ?? this.habilidade, tipo]; }
}

export class LembreteResistencia extends LembreteHabilidadeBase {
  constructor(actor, habilidade, activity) {
    super(actor, habilidade);
    this.statuses = this._statuses(activity);
  }

  _statuses(activity) {
    if (!activity?.effects) return [];
    return activity.effects.map((e) => e.effect).filter(Boolean)
      .flatMap((e) => [...(e.statuses ?? []), ...(e.flags?.dnd5e?.riders?.statuses ?? [])]);
  }

  get vantagens() { return super.vantagens.concat(["advantage.ability.save.all", `advantage.ability.save.${this.habilidade}`]); }
  get desvantagens() { return super.desvantagens.concat(["disadvantage.ability.save.all", `disadvantage.ability.save.${this.habilidade}`]); }
  get condicoesVant() { return this.habilidade === "dex" ? [COND.vantResDes] : []; }
  get condicoesDesv() {
    const c = super.condicoesDesv.concat(COND.desvRes);
    if (this.habilidade === "dex") c.push(COND.desvResDes);
    return c;
  }
  get modosFonte() {
    return { [`system.abilities.${this.habilidade}.save.roll.mode`]: [CONFIG.DND5E.abilities[this.habilidade]?.label ?? this.habilidade, "DND5E.ActionSave"] };
  }

  /** Vantagem contra uma condição específica: chave <prefixo>statuses.<status>.save.roll.mode. */
  get modosDeStatus() { return this.statuses.flatMap((s) => chaves(`statuses.${s}.save.roll.mode`)); }

  _extra(acc) {
    super._extra(acc);
    acc.aplicarEfeitosDeModo(this.actor, this.modosDeStatus);
  }
}

export class LembreteConcentracao extends LembreteResistencia {
  get modos() { return { "system.attributes.concentration.roll.mode": ["DND5E.Concentration"] }; }
}

export class LembretePericia extends LembreteTeste {
  constructor(actor, habilidade, pericia, armaduraFurtividade = true) {
    super(actor, habilidade);
    this.pericia = pericia;
    this.armaduraFurtividade = armaduraFurtividade;
  }

  get vantagens() { return super.vantagens.concat(["advantage.skill.all", `advantage.skill.${this.pericia}`]); }
  get desvantagens() { return super.desvantagens.concat(["disadvantage.skill.all", `disadvantage.skill.${this.pericia}`]); }
  get modosFonte() {
    return { ...super.modosFonte, [`system.skills.${this.pericia}.roll.mode`]: [CONFIG.DND5E.skills[this.pericia]?.label ?? this.pericia] };
  }

  _extra(acc) {
    super._extra(acc);
    if (this.armaduraFurtividade && this.pericia === "ste") {
      const item = this.actor.items.find((i) => i.type === "equipment" && i.system.equipped
        && i.system.properties?.has("stealthDisadvantage"));
      acc.desvantagem(item?.link);
    }
  }
}

export class LembreteIniciativa extends LembreteTeste {
  get condicoesVant() { return super.condicoesVant.concat(COND.vantIniciativa); }
  get condicoesDesv() { return super.condicoesDesv.concat(COND.desvIniciativa); }
  get modosFonte() { return {}; }
}

export class LembreteMorte extends LembreteHabilidadeBase {
  constructor(actor) { super(actor, null); }
  get vantagens() { return super.vantagens.concat(["advantage.ability.save.all", "advantage.deathSave"]); }
  get desvantagens() { return super.desvantagens.concat(["disadvantage.ability.save.all", "disadvantage.deathSave"]); }
  get modos() { return { "system.attributes.death.roll.mode": ["DND5E.DeathSave"] }; }
}

export class LembreteCritico extends LembreteBase {
  static Acumulador = AcumuladorCritico;

  constructor(actor, alvo, activity, distancia) {
    super(actor);
    this.alvo = alvo;
    this.flagsAlvo = this._flags(alvo);
    this.tipo = activity.actionType;
    this.distancia = distancia;
    if (alvo) {
      const alcance = foundry.utils.getProperty(alvo, "flags.midi-qol.grants.critical.range") || -Infinity;
      this._ajustarAlcance(distancia, alcance);
    }
  }

  _ajustarAlcance(distancia, alcance) {
    if ("grants.critical.range" in this.flagsAlvo) this.flagsAlvo["grants.critical.range"] = distancia() <= alcance;
  }

  atualizarOpcoes(options) {
    const acc = new this.constructor.Acumulador(this._contagemCritica(options.isCritical));
    acc.aplicarFlags(this.flagsAtor, ["critical.all", `critical.${this.tipo}`], ["noCritical.all", `noCritical.${this.tipo}`]);
    acc.aplicarFlags(this.flagsAlvo,
      ["grants.critical.all", `grants.critical.${this.tipo}`, "grants.critical.range"],
      ["fail.critical.all", `fail.critical.${this.tipo}`]);
    if (this.alvo) {
      const adj = acc.condicao(this.alvo, COND.concedeCritAdjacente);
      if (adj.length && this.distancia() <= 5) adj.forEach((r) => acc.critico(r));
    }
    this._extra(acc);
    acc.atualizar(options);
  }

  _contagemCritica(isCritical) {
    return { critical: { count: isCritical ? 1 : 0, suppressed: false } };
  }
}

/* ---------- Fontes (só os nomes, para a caixinha) ---------- */

/** Troca a contagem por listas de rótulos (links dos efeitos, nomes das condições). */
const Rotulos = (Base) => class extends Base {
  condicao(actor, chave) {
    return super.condicao(actor, chave)
      .map((k) => k.split("-").shift())
      .flatMap((k) => {
        const nomes = actor.appliedEffects.filter((e) => e.statuses.has(k)).map((e) => e.link);
        return nomes.length ? nomes : `&Reference[${k} apply=false]`;
      });
  }
};

class AcumuladorRotulos extends Rotulos(Acumulador) {
  aplicarModos(actor, modos) {
    for (const [chave, rotulos] of Object.entries(modos)) {
      const modo = foundry.utils.getProperty(actor._source, chave);
      const rotulo = [...rotulos, "DND5E.AdvantageMode"].map((l) => game.i18n.localize(l)).join(" ");
      if (modo === 1) this.counts.advantages.labels.push(rotulo);
      else if (modo === -1) this.counts.disadvantages.labels.push(rotulo);
    }
  }

  _somar(delta, change) {
    if (delta === 1) this.counts.advantages.labels.push(change.effect.link);
    else if (delta === -1) this.counts.disadvantages.labels.push(change.effect.link);
  }
  _impor(delta, change) { if ([-1, 0, 1].includes(delta)) this.counts.override = { label: change.effect.link, mode: delta }; }
  _melhorar(delta, change) {
    if (delta !== 1 && delta !== 0) return;
    this.counts.disadvantages.suppressed.push(change.effect.link);
    if (delta === 1) this.counts.advantages.labels.push(change.effect.link);
  }
  _piorar(delta, change) {
    if (delta !== -1 && delta !== 0) return;
    this.counts.advantages.suppressed.push(change.effect.link);
    if (delta === -1) this.counts.disadvantages.labels.push(change.effect.link);
  }

  aplicarFlags(flags, vant, desv) {
    vant.forEach((k) => this.counts.advantages.labels.push(...(flags[k] ?? [])));
    desv.forEach((k) => this.counts.disadvantages.labels.push(...(flags[k] ?? [])));
  }
  aplicarCondicoes(actor, vant, desv) {
    if (!actor) return;
    this.counts.advantages.labels.push(...vant.flatMap((c) => this.condicao(actor, c)));
    this.counts.disadvantages.labels.push(...desv.flatMap((c) => this.condicao(actor, c)));
  }
  vantagem(rotulo) { if (rotulo) this.counts.advantages.labels.push(rotulo); }
  desvantagem(rotulo) { if (rotulo) this.counts.disadvantages.labels.push(rotulo); }

  atualizar(dialog) { foundry.utils.setProperty(dialog, `options.${OPCAO}.fontesVant`, this.counts); }
}

class AcumuladorCriticoRotulos extends Rotulos(AcumuladorCritico) {
  aplicarFlags(flags, crit, normal) {
    crit.forEach((k) => { if (flags[k]) this.counts.critical.labels.push(...flags[k]); });
    normal.forEach((k) => { if (flags[k]) this.counts.critical.suppressed.push(...flags[k]); });
  }
  critico(rotulo) { if (rotulo) this.counts.critical.labels.push(rotulo); }
  atualizar(dialog) { foundry.utils.setProperty(dialog, `options.${OPCAO}.fontesCrit`, this.counts); }
}

const Fonte = (Base) => class extends Base {
  static Acumulador = AcumuladorRotulos;

  /** Flags do Midi-QOL vindas de efeitos: { chave: [links dos efeitos] }. */
  _flags(actor) {
    if (!actor) return {};
    const filtro = (c) => c.key.startsWith("flags.midi-qol.") && ["true", "1"].includes(String(c.value).trim())
      && foundry.utils.getProperty(actor, c.key) === true;
    const out = {};
    for (const c of mudancasAplicaveis(actor, filtro)) (out[c.key.substring(15)] ??= []).push(c.effect.link);
    return out;
  }

  _contagemInicial() {
    return { override: null, advantages: { labels: [], suppressed: [] }, disadvantages: { labels: [], suppressed: [] } };
  }

  _extra(acc) {
    super._extra(acc);
    // Modos de rolagem: os usados na contagem e, só para mostrar, os da habilidade/perícia (ex.: faixa de carga).
    const modos = { ...(this.modosFonte ?? {}), ...this.modos };
    if (foundry.utils.isEmpty(modos)) return;
    acc.aplicarModos(this.actor, modos);
    acc.aplicarEfeitosDeModo(this.actor, Object.keys(modos));
  }
};

export class FonteAtaque extends Fonte(LembreteAtaque) {}
export class FonteResistencia extends Fonte(LembreteResistencia) {}
export class FonteConcentracao extends Fonte(LembreteConcentracao) {}
export class FonteTeste extends Fonte(LembreteTeste) {}
export class FontePericia extends Fonte(LembretePericia) {}
export class FonteMorte extends Fonte(LembreteMorte) {}

export class FonteIniciativa extends Fonte(LembreteIniciativa) {
  _extra(acc) {
    super._extra(acc);
    // Traços especiais do sistema que dão vantagem na iniciativa.
    const flags = ["initiativeAdv"];
    if (game.settings.get("dnd5e", "rulesVersion") === "modern") flags.push("remarkableAthlete");
    for (const f of flags) {
      if (foundry.utils.getProperty(this.actor._source, `flags.dnd5e.${f}`)) acc.vantagem(CONFIG.DND5E.characterFlags[f]?.name);
    }
    const chavesFlag = flags.map((f) => `flags.dnd5e.${f}`);
    for (const e of this.actor.appliedEffects) {
      if (e.changes.some((c) => chavesFlag.includes(c.key))) acc.vantagem(e.link);
    }
  }
}

export class FonteCritico extends Fonte(LembreteCritico) {
  static Acumulador = AcumuladorCriticoRotulos;

  constructor(actor, alvo, activity, distancia, event) {
    super(actor, alvo, activity, distancia);
    this.event = event;
  }

  _ajustarAlcance(distancia, alcance) {
    if ("grants.critical.range" in this.flagsAlvo && distancia() > alcance) delete this.flagsAlvo["grants.critical.range"];
  }

  _contagemCritica() {
    const counts = { critical: { labels: [], suppressed: [] } };
    // O ataque anterior foi crítico? (pelo botão de dano do cartão de chat)
    try {
      const messageId = this.event?.currentTarget?.dataset?.messageId;
      const ataque = messageId ? dnd5e.registry.messages.get(messageId, "attack").pop() : null;
      if (ataque?.rolls[0]?.isCritical) {
        counts.critical.labels.push(game.i18n.format("MONOLITH.lembretes.Fonte.natural", { value: ataque.rolls[0].d20.total }));
      }
    } catch (err) { /* sem cartão de ataque */ }
    return counts;
  }

  _extra(acc) {}
}

/* ---------- Falha automática (resistências de For/Des paralisado etc., ou flags fail.* do Midi) ---------- */

export class FalhaResistencia {
  constructor(actor, habilidade) {
    this.actor = actor;
    this.habilidade = habilidade;
  }

  get chavesFalha() {
    return ["fail.all", "fail.ability.all", "fail.ability.save.all", `fail.ability.save.${this.habilidade}`];
  }

  get condicao() {
    if (this.habilidade === "dex") return COND.falhaResDes;
    if (this.habilidade === "str") return COND.falhaResFor;
  }

  /** Retorna o motivo da falha automática, ou null. */
  motivo() {
    const flags = foundry.utils.flattenObject(this.actor?.flags?.["midi-qol"] ?? {});
    if (this.chavesFalha.some((k) => flags[k])) return "flag";
    const cond = this.condicao;
    if (!cond) return null;
    const ids = condicoesDoEfeito(this.actor, cond);
    return ids.length ? ids : null;
  }
}
