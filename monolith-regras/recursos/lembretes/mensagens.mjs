/**
 * Mensagens escritas em efeitos ativos. A chave diz em que rolagem a mensagem aparece, o valor é o texto
 * (aceita rolagens embutidas, ex.: "Bênção [[/r 1d4]]"). Chaves aceitas, com o prefixo
 * flags.monolith-regras.lembretes. (novo) ou flags.adv-reminder. (antigo):
 *   message.all, message.attack.all|<tipo>|<hab>, message.ability.all, message.ability.check.all|<hab>,
 *   message.ability.save.all|<hab>, message.ability.concentration, message.skill.all|<perícia>,
 *   message.initiative, message.deathSave, message.damage.all|<tipo>
 * e no alvo: grants.message.attack.all|<tipo>|<hab>, grants.message.damage.all|<tipo>.
 */
import { OPCAO, chaves, mudancasAplicaveis } from "./util.mjs";

class MensagemBase {
  constructor(actor, alvo) {
    this.actor = actor;
    this.alvo = alvo;
  }

  get chaves() { return ["message.all"]; }
  get chavesAlvo() { return null; }

  adicionar(dialog) {
    const lista = foundry.utils.getProperty(dialog, `options.${OPCAO}.mensagens`) ?? [];
    const ks = chaves(...this.chaves);
    lista.push(...mudancasAplicaveis(this.actor, (c) => ks.includes(c.key)).map((c) => c.value));
    const ka = this.chavesAlvo;
    if (ka && this.alvo) {
      const kas = chaves(...ka);
      lista.push(...mudancasAplicaveis(this.alvo, (c) => kas.includes(c.key)).map((c) => c.value));
    }
    if (lista.length) foundry.utils.setProperty(dialog, `options.${OPCAO}.mensagens`, lista);
  }
}

export class MensagemAtaque extends MensagemBase {
  constructor(actor, alvo, activity) {
    super(actor, alvo);
    this.tipo = activity.actionType;
    this.habilidade = activity.ability;
  }
  get chaves() {
    return super.chaves.concat("message.attack.all", `message.attack.${this.tipo}`, `message.attack.${this.habilidade}`);
  }
  get chavesAlvo() {
    return ["grants.message.attack.all", `grants.message.attack.${this.tipo}`, `grants.message.attack.${this.habilidade}`];
  }
}

class MensagemHabilidadeBase extends MensagemBase {
  constructor(actor, habilidade) {
    super(actor);
    this.habilidade = habilidade;
  }
  get chaves() { return super.chaves.concat("message.ability.all"); }
}

export class MensagemTeste extends MensagemHabilidadeBase {
  get chaves() { return super.chaves.concat("message.ability.check.all", `message.ability.check.${this.habilidade}`); }
}

export class MensagemResistencia extends MensagemHabilidadeBase {
  get chaves() { return super.chaves.concat("message.ability.save.all", `message.ability.save.${this.habilidade}`); }
}

export class MensagemConcentracao extends MensagemResistencia {
  get chaves() { return super.chaves.concat("message.ability.concentration"); }
}

export class MensagemPericia extends MensagemTeste {
  constructor(actor, habilidade, pericia) {
    super(actor, habilidade);
    this.pericia = pericia;
  }
  get chaves() { return super.chaves.concat("message.skill.all", `message.skill.${this.pericia}`); }
}

export class MensagemIniciativa extends MensagemHabilidadeBase {
  get chaves() { return super.chaves.concat("message.initiative"); }
}

export class MensagemMorte extends MensagemHabilidadeBase {
  constructor(actor) { super(actor, null); }
  get chaves() { return super.chaves.concat("message.ability.save.all", "message.deathSave"); }
}

export class MensagemDano extends MensagemBase {
  constructor(actor, alvo, activity) {
    super(actor, alvo);
    this.tipo = activity.actionType;
  }
  get chaves() { return super.chaves.concat("message.damage.all", `message.damage.${this.tipo}`); }
  get chavesAlvo() { return ["grants.message.damage.all", `grants.message.damage.${this.tipo}`]; }
}

/** Todas as chaves de mensagem (com o prefixo novo), para o DAE listar no editor de efeitos. */
export function todasAsChaves(prefixo) {
  const out = ["message.all", "message.attack.all", "message.ability.all", "message.ability.check.all",
    "message.ability.save.all", "message.ability.concentration", "message.skill.all", "message.initiative",
    "message.deathSave", "message.damage.all", "grants.message.attack.all", "grants.message.damage.all"];
  for (const t of ["mwak", "rwak", "msak", "rsak"]) out.push(`message.attack.${t}`, `grants.message.attack.${t}`);
  for (const t of Object.keys(CONFIG.DND5E.itemActionTypes ?? {})) out.push(`message.damage.${t}`, `grants.message.damage.${t}`);
  for (const a of Object.keys(CONFIG.DND5E.abilities ?? {})) {
    out.push(`message.attack.${a}`, `message.ability.check.${a}`, `message.ability.save.${a}`);
  }
  for (const s of Object.keys(CONFIG.DND5E.skills ?? {})) out.push(`message.skill.${s}`);
  return out.map((k) => prefixo + k);
}
