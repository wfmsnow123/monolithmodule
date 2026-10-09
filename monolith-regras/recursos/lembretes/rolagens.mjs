/**
 * Ganchos do rolador do dnd5e (só o rolador padrão: sem Midi-QOL nem Ready Set Roll) e a caixinha de
 * lembretes dentro dos diálogos de configuração de rolagem.
 */
import {
  FalhaResistencia, FonteAtaque, FonteConcentracao, FonteCritico, FonteIniciativa, FonteMorte, FontePericia,
  FonteResistencia, FonteTeste, LembreteAtaque, LembreteConcentracao, LembreteCritico, LembreteIniciativa,
  LembreteMorte, LembretePericia, LembreteResistencia, LembreteTeste
} from "./regras.mjs";
import {
  MensagemAtaque, MensagemConcentracao, MensagemDano, MensagemIniciativa, MensagemMorte, MensagemPericia,
  MensagemResistencia, MensagemTeste
} from "./mensagens.mjs";
import { adicionarMonolith } from "./monolith.mjs";
import { OPCAO, alvo, distanciaAteAlvo, escapar, estado } from "./util.mjs";

const t = (k, dados) => (dados ? game.i18n.format(`MONOLITH.lembretes.${k}`, dados) : game.i18n.localize(`MONOLITH.lembretes.${k}`));
const PROCESSADO = "monolith-lembretes-processado";

/** A rolagem pula o diálogo? (cópia de D20Roll.applyKeybindings) */
function pulando({ event }, dialog = {}) {
  if (dialog.configure !== undefined) return !dialog.configure;
  const k = (acao) => dnd5e.utils.areKeysPressed(event, acao);
  return k("skipDialogNormal") || k("skipDialogAdvantage") || k("skipDialogDisadvantage");
}

/** Marca a configuração como já tratada (as resistências passam por vários ganchos, ex.: concentração). */
function jaTratado(config) {
  if (config[PROCESSADO]) return true;
  config[PROCESSADO] = true;
  return false;
}

/** Ação que gerou o teste de resistência (botão do cartão de chat), se houver. */
function atividadeDoCartao(config) {
  const id = config.event?.currentTarget?.dataset?.messageId;
  try { return id ? game.messages.get(id)?.getAssociatedActivity() : undefined; } catch { return undefined; }
}

export function registrarRolagens({ armaduraFurtividade }) {
  Hooks.on("dnd5e.preRollAttackV2", (config, dialog, message) => {
    if (pulando(config, dialog)) return;
    const activity = config.subject;
    const actor = activity?.actor;
    if (!actor) return;
    const tgt = alvo();
    const dist = distanciaAteAlvo(message?.data?.speaker);
    new MensagemAtaque(actor, tgt, activity).adicionar(dialog);
    if (estado.mostrarFontes) new FonteAtaque(actor, tgt, activity, dist).atualizarOpcoes(dialog);
    if (estado.monolith) adicionarMonolith(dialog, actor, { tipo: "ataque", habilidade: activity.ability });
    new LembreteAtaque(actor, tgt, activity, dist).atualizarOpcoes(config.rolls[0].options);
  });

  Hooks.on("dnd5e.preRollSavingThrowV2", (config, dialog, message) => {
    if (jaTratado(config)) return;
    const actor = config.subject;
    const hab = config.ability;
    const motivo = new FalhaResistencia(actor, hab).motivo();
    if (motivo) {
      falhaAutomatica(actor, hab, motivo, message).catch((err) => console.error("monolith-regras | lembretes: falha automática", err));
      return false;
    }
    if (pulando(config, dialog)) return;
    const activity = atividadeDoCartao(config);
    new MensagemResistencia(actor, hab).adicionar(dialog);
    if (estado.mostrarFontes) new FonteResistencia(actor, hab, activity).atualizarOpcoes(dialog);
    if (estado.monolith) adicionarMonolith(dialog, actor, { tipo: "resistencia", habilidade: hab });
    new LembreteResistencia(actor, hab, activity).atualizarOpcoes(config.rolls[0].options);
  });

  Hooks.on("dnd5e.preRollConcentrationV2", (config, dialog) => {
    if (jaTratado(config) || pulando(config, dialog)) return;
    const actor = config.subject;
    const hab = config.ability;
    new MensagemConcentracao(actor, hab).adicionar(dialog);
    if (estado.mostrarFontes) new FonteConcentracao(actor, hab).atualizarOpcoes(dialog);
    if (estado.monolith) adicionarMonolith(dialog, actor, { tipo: "concentracao", habilidade: hab });
    new LembreteConcentracao(actor, hab).atualizarOpcoes(config.rolls[0].options);
  });

  Hooks.on("dnd5e.preRollAbilityCheckV2", (config, dialog) => {
    if (jaTratado(config) || pulando(config, dialog)) return;
    const actor = config.subject;
    const hab = config.ability;
    new MensagemTeste(actor, hab).adicionar(dialog);
    if (estado.mostrarFontes) new FonteTeste(actor, hab).atualizarOpcoes(dialog);
    if (estado.monolith) adicionarMonolith(dialog, actor, { tipo: "teste", habilidade: hab });
    new LembreteTeste(actor, hab).atualizarOpcoes(config.rolls[0].options);
  });

  Hooks.on("dnd5e.preRollSkillV2", (config, dialog) => {
    if (jaTratado(config) || pulando(config, dialog)) return;
    const actor = config.subject;
    const hab = config.ability;
    const pericia = config.skill;
    new MensagemPericia(actor, hab, pericia).adicionar(dialog);
    if (estado.mostrarFontes) new FontePericia(actor, hab, pericia, true).atualizarOpcoes(dialog);
    if (estado.monolith) adicionarMonolith(dialog, actor, { tipo: "pericia", habilidade: hab });
    new LembretePericia(actor, hab, pericia, armaduraFurtividade).atualizarOpcoes(config.rolls[0].options);
  });

  Hooks.on("dnd5e.preRollInitiativeDialogV2", (config, dialog) => {
    if (jaTratado(config) || pulando(config, dialog)) return;
    const actor = config.subject;
    const hab = actor.system.attributes?.init?.ability || CONFIG.DND5E.defaultAbilities.initiative;
    new MensagemIniciativa(actor, hab).adicionar(dialog);
    if (estado.mostrarFontes) new FonteIniciativa(actor, hab).atualizarOpcoes(dialog);
    if (estado.monolith) adicionarMonolith(dialog, actor, { tipo: "iniciativa", habilidade: hab });
    new LembreteIniciativa(actor, hab).atualizarOpcoes(config.rolls[0].options);
  });

  Hooks.on("dnd5e.preRollDeathSaveV2", (config, dialog) => {
    if (jaTratado(config) || pulando(config, dialog)) return;
    const actor = config.subject;
    new MensagemMorte(actor).adicionar(dialog);
    if (estado.mostrarFontes) new FonteMorte(actor).atualizarOpcoes(dialog);
    if (estado.monolith) adicionarMonolith(dialog, actor, { tipo: "morte" });
    new LembreteMorte(actor).atualizarOpcoes(config.rolls[0].options);
  });

  Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
    if (pulando(config, dialog)) return;
    const activity = config.subject;
    // Enriquecedor de dano/cura não tem atividade.
    if (!activity?.actor) return;
    const tgt = alvo();
    const dist = distanciaAteAlvo(message?.data?.speaker);
    new MensagemDano(activity.actor, tgt, activity).adicionar(dialog);
    if (estado.mostrarFontes) new FonteCritico(activity.actor, tgt, activity, dist, config.event).atualizarOpcoes(dialog);
    new LembreteCritico(activity.actor, tgt, activity, dist).atualizarOpcoes(config);
    // Contorno de https://github.com/foundryvtt/dnd5e/issues/5455
    foundry.utils.setProperty(dialog, "options.defaultButton", config.isCritical ? "critical" : "normal");
  });

  Hooks.on("renderRollConfigurationDialog", renderizar);
}

/* ---------- Falha automática ---------- */

async function falhaAutomatica(actor, hab, motivo, message) {
  const habilidade = CONFIG.DND5E.abilities[hab]?.label ?? hab;
  const causa = Array.isArray(motivo)
    ? motivo.map((s) => CONFIG.DND5E.conditionTypes[s]?.name ?? CONFIG.statusEffects.find((e) => e.id === s)?.name ?? s)
      .map((n) => game.i18n.localize(n)).join(", ")
    : t("FalhaPorEfeito");
  const content = `<div class="mono-card mlem-falha"><header><i class="fas fa-skull"></i> ${t("FalhaAutomatica")}</header>
    <div class="mono-card__body"><p>${t("FalhaTexto", { nome: escapar(actor.name), habilidade: escapar(habilidade) })}</p>
    <p class="mlem-falha-causa">${escapar(causa)}</p></div></div>`;
  const dados = foundry.utils.mergeObject({ author: game.user.id, content }, message?.data ?? {}, { inplace: false });
  ChatMessage.applyRollMode(dados, message?.rollMode ?? game.settings.get("core", "rollMode"));
  return ChatMessage.create(dados);
}

/* ---------- A caixinha no diálogo ---------- */

/** Monta as linhas de fonte (vantagem, desvantagem, crítico) a partir do que os ganchos guardaram. */
function linhasDeFonte(opt) {
  const out = [];
  const add = (tipo, icone, rotulo, rotulos) => {
    if (rotulos?.length) out.push({ tipo, icone, rotulo, texto: rotulos.join(", ") });
  };
  const v = opt.fontesVant;
  if (v) {
    if (v.override) {
      const m = v.override.mode;
      if (m === 1) add("vant", "fas fa-angles-up", t("Fonte.vantagemImposta"), [v.override.label]);
      else if (m === 0) add("info", "fas fa-minus", t("Fonte.normalImposta"), [v.override.label]);
      else if (m === -1) add("desv", "fas fa-angles-down", t("Fonte.desvantagemImposta"), [v.override.label]);
    } else {
      if (v.advantages?.suppressed?.length) add("anulada", "fas fa-circle-xmark", t("Fonte.vantagemAnulada"), v.advantages.suppressed);
      else add("vant", "fas fa-angle-up", t("Fonte.vantagem"), v.advantages?.labels);
      if (v.disadvantages?.suppressed?.length) add("anulada", "fas fa-circle-xmark", t("Fonte.desvantagemAnulada"), v.disadvantages.suppressed);
      else add("desv", "fas fa-angle-down", t("Fonte.desvantagem"), v.disadvantages?.labels);
    }
  }
  const c = opt.fontesCrit;
  if (c) {
    if (c.critical?.suppressed?.length) add("anulada", "fas fa-circle-xmark", t("Fonte.criticoAnulado"), c.critical.suppressed);
    else add("crit", "fas fa-burst", t("Fonte.critico"), c.critical?.labels);
  }
  return out;
}

const linha = ({ tipo, icone, rotulo, texto }) =>
  `<li class="mlem-item" data-tipo="${tipo}"><i class="${icone}"></i><span class="mlem-rotulo">${escapar(rotulo)}</span><span class="mlem-texto">${texto}</span></li>`;

/** HTML da caixinha (antes de enriquecer), ou "" se não houver nada a mostrar. */
export function montarCaixa(opt = {}) {
  const fontes = linhasDeFonte(opt);
  const monolith = opt.monolith ?? [];
  const mensagens = opt.mensagens ?? [];
  if (!fontes.length && !monolith.length && !mensagens.length) return "";
  return `<fieldset class="mlem-caixa">
    <legend>${t("Titulo")}</legend>
    <ul class="mlem-lista">
      ${fontes.map(linha).join("")}
      ${monolith.map(linha).join("")}
      ${mensagens.map((m) => `<li class="mlem-item mlem-mensagem" data-tipo="mensagem"><i class="fas fa-comment"></i><span class="mlem-texto">${m}</span></li>`).join("")}
    </ul>
  </fieldset>`;
}

async function renderizar(dialog, html) {
  const opt = dialog.options?.[OPCAO];
  if (opt && !opt.renderizado) {
    opt.renderizado = true;
    const bruto = montarCaixa(opt);
    if (bruto) {
      const TextEditor = foundry.applications.ux.TextEditor.implementation;
      const rico = await TextEditor.enrichHTML(bruto, {
        secrets: true, documents: true, links: false, rolls: true, rollData: dialog.rolls?.[0]?.data ?? {}
      });
      const tpl = document.createElement("template");
      tpl.innerHTML = rico;
      const caixa = tpl.content.firstElementChild;
      const ancora = html.querySelector('fieldset[data-application-part="configuration"]')
        ?? html.querySelector('[data-application-part="formulas"]');
      if (caixa && ancora) {
        ancora.after(caixa);
        prepararRolagensEmbutidas(dialog, caixa);
      }
    }
  }

  // Estilo do botão padrão.
  html.classList.toggle("mlem-largo", !!estado.botaoLargo);
  html.classList.toggle("mlem-cor", !!estado.corBotao && estado.corBotao !== "padrao");
  dialog.setPosition();
}

/** Rolagens embutidas na mensagem viram botões que somam a fórmula ao bônus situacional. */
function prepararRolagensEmbutidas(dialog, caixa) {
  for (const a of caixa.querySelectorAll("a.inline-roll")) {
    a.classList.remove("inline-roll");
    a.classList.add("mlem-rolagem");
    a.dataset.tooltip = t("SomarAoBonus");
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const formula = ev.currentTarget.dataset.formula;
      const input = dialog.element.querySelector('.rolls input[name="roll.0.situational"]');
      if (!formula || !input) return;
      input.value = input.value ? `${input.value} + ${formula}` : formula;
      dialog.rebuild();
    });
  }
}
