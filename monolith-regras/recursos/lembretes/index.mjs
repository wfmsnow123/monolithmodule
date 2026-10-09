/**
 * Recurso "Lembretes de vantagem" (substitui adv-reminder, Advantage Reminder for dnd5e 5.0.2 de kaelad, MIT).
 * Nos diálogos de rolagem do dnd5e: marca vantagem/desvantagem/crítico vindos de efeitos e condições, mostra
 * de onde vieram, as mensagens escritas em efeitos e os lembretes de Monolith (Ênfase, exaustão, carga,
 * Perdição, Medidas armadas).
 */
import { atualizarCondicoes } from "./regras.mjs";
import { registrarRolagens } from "./rolagens.mjs";
import { todasAsChaves } from "./mensagens.mjs";
import { ANTIGO, OPCAO, PREFIXO, PREFIXO_ANTIGO, estado } from "./util.mjs";

const CORES = { padrao: "Padrão", jogador: "Cor do jogador", sangue: "Sangue", cobalto: "Cobalto", verde: "Verde", personalizada: "Personalizada" };
const FUNDO = { sangue: "#a3121b", cobalto: "#28479a", verde: "#2f6b2a" };

/** Cor do botão padrão: variáveis em :root lidas pelo estilo.css. */
function aplicarCor(ctx) {
  const modo = estado.corBotao;
  const fundo = modo === "jogador" ? (game.user?.color?.css ?? String(game.user?.color ?? ""))
    : modo === "personalizada" ? String(ctx.get("corPersonalizada") || "#a3121b")
    : FUNDO[modo];
  const root = document.documentElement.style;
  if (!fundo) {
    root.removeProperty("--mlem-botao-fundo");
    root.removeProperty("--mlem-botao-texto");
    return;
  }
  root.setProperty("--mlem-botao-fundo", fundo);
  root.setProperty("--mlem-botao-texto", textoLegivel(fundo));
}

function textoLegivel(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return "#f1ece2";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#07080b" : "#f1ece2";
}

/** Midi-QOL: efeitos em modo Personalizado com flags.midi-qol.* viram propriedades do ator (como o original). */
function aplicarMidi(actor, change) {
  const chaves = ["advantage.", "disadvantage.", "grants.", "critical.", "noCritical.", "fail."].map((k) => `flags.midi-qol.${k}`);
  if (!chaves.some((k) => change.key?.startsWith(k))) return;
  let v = change.value;
  if (typeof v === "string") {
    const s = v.trim();
    v = ["true", "1"].includes(s) ? true : ["false", "0"].includes(s) ? false : v;
  }
  foundry.utils.setProperty(actor, change.key, v);
}

/** Integração com o DAE: as chaves de mensagem aparecem no editor de efeitos, em modo Personalizado. */
function integrarDAE() {
  let campos;
  const lista = () => (campos ??= todasAsChaves(PREFIXO));
  Hooks.once("DAE.setupComplete", () => globalThis.DAE?.addAutoFields?.(lista()));
  Hooks.on("dae.modifySpecials", (specKey, specials) => {
    for (const f of lista()) specials[f] = [new foundry.data.fields.StringField(), 0];
  });
  Hooks.on("dae.setFieldData", (fieldData) => { fieldData["Lembretes"] = [...lista()]; });
}

/** Configurações de cliente do adv-reminder ficam no navegador de cada um: traz uma vez por navegador. */
async function migrarCliente(ctx) {
  const marca = "monolith-regras.lembretes.clienteMigrado";
  try {
    if (localStorage.getItem(marca)) return;
    localStorage.setItem(marca, "1");
  } catch { return; }
  const ler = (k) => {
    try {
      const bruto = localStorage.getItem(`${ANTIGO}.${k}`);
      return bruto === null ? undefined : JSON.parse(bruto);
    } catch { return undefined; }
  };
  const fontes = ler("showSources");
  if (typeof fontes === "boolean") await ctx.set("mostrarFontes", fontes);
  const estilo = ler("buttonStyle");
  if (estilo && typeof estilo === "object") {
    if (typeof estilo.wide === "boolean") await ctx.set("botaoLargo", estilo.wide);
    const cor = { default: "padrao", player: "jogador", green: "verde", custom: "personalizada" }[estilo.color];
    if (cor) await ctx.set("corBotao", cor);
    if (estilo.custom?.buttonColor) await ctx.set("corPersonalizada", estilo.custom.buttonColor);
  }
}

/** Troca o prefixo antigo das chaves de efeito pelo novo em todos os efeitos de um documento. */
async function migrarEfeitos(doc) {
  const updates = [];
  for (const e of doc?.effects ?? []) {
    const changes = e._source?.changes ?? e.changes ?? [];
    if (!changes.some((c) => c.key?.startsWith(PREFIXO_ANTIGO))) continue;
    updates.push({
      _id: e.id,
      changes: changes.map((c) => (c.key?.startsWith(PREFIXO_ANTIGO) ? { ...c, key: PREFIXO + c.key.slice(PREFIXO_ANTIGO.length) } : c))
    });
  }
  if (updates.length) await doc.updateEmbeddedDocuments("ActiveEffect", updates);
  return updates.length;
}

/** Flags no escopo antigo (o original não grava nenhuma, mas se alguém gravou à mão, vem junto). */
async function migrarFlags(ctx, doc) {
  const antigas = ctx.flagsAntigas(doc, ANTIGO);
  if (!antigas || foundry.utils.isEmpty(antigas)) return 0;
  const atuais = foundry.utils.getProperty(doc._source ?? {}, `flags.${ctx.ID}.lembretes`);
  if (atuais && !foundry.utils.isEmpty(atuais)) return 0;
  await doc.update({ [`flags.${ctx.ID}.lembretes`]: foundry.utils.deepClone(antigas) });
  return 1;
}

async function migrarAtor(ctx, actor) {
  let n = await migrarEfeitos(actor);
  n += await migrarFlags(ctx, actor);
  for (const item of actor.items ?? []) {
    n += await migrarEfeitos(item);
    n += await migrarFlags(ctx, item);
  }
  return n;
}

export default {
  id: "lembretes",
  nome: "Lembretes de vantagem",
  descricao: "Mostra na rolagem o que dá vantagem, desvantagem ou crítico (efeitos, condições, mensagens) e os lembretes de Monolith: Ênfase, exaustão, carga, Perdição e Medidas armadas.",
  original: [ANTIGO],
  padrao: true,

  iniciar(ctx) {
    const r = (k, dados) => ctx.registrar(k, { config: true, ...dados, name: ctx.t(`Config.${k}.nome`), hint: ctx.t(`Config.${k}.dica`) });
    r("mostrarFontes", { scope: "client", type: Boolean, default: true, onChange: (v) => (estado.mostrarFontes = v) });
    r("monolith", { scope: "client", type: Boolean, default: true, onChange: (v) => (estado.monolith = v) });
    r("atualizarCondicoes", { scope: "world", type: Boolean, default: true, requiresReload: true });
    r("botaoLargo", { scope: "client", type: Boolean, default: false, onChange: (v) => (estado.botaoLargo = v) });
    r("corBotao", {
      scope: "client", type: String, default: "padrao", choices: CORES,
      onChange: (v) => { estado.corBotao = v; aplicarCor(ctx); }
    });
    r("corPersonalizada", {
      scope: "client", type: new foundry.data.fields.ColorField({ nullable: false, initial: "#a3121b" }),
      default: "#a3121b", onChange: () => aplicarCor(ctx)
    });

    // Com o DAE ativo, ele mesmo impõe a desvantagem em Furtividade da armadura.
    registrarRolagens({ armaduraFurtividade: !game.modules.get("dae")?.active });
    Hooks.on("applyActiveEffect", aplicarMidi);
    integrarDAE();

    const lerEstado = () => {
      estado.mostrarFontes = ctx.get("mostrarFontes");
      estado.monolith = ctx.get("monolith");
      estado.botaoLargo = ctx.get("botaoLargo");
      estado.corBotao = ctx.get("corBotao");
    };
    Hooks.once("setup", () => {
      lerEstado();
      if (ctx.get("atualizarCondicoes")) atualizarCondicoes();
    });
    Hooks.once("ready", async () => {
      await migrarCliente(ctx).catch((err) => console.warn("monolith-regras | lembretes: migração do cliente", err));
      lerEstado();
      aplicarCor(ctx);
    });
  },

  async migrar(ctx) {
    const antigas = ctx.configsAntigas(ANTIGO);
    if (typeof antigas.updateStatusEffects === "boolean") await ctx.set("atualizarCondicoes", antigas.updateStatusEffects);

    let n = 0;
    for (const actor of game.actors) n += await migrarAtor(ctx, actor);
    for (const item of game.items) {
      n += await migrarEfeitos(item);
      n += await migrarFlags(ctx, item);
    }
    // Tokens não vinculados: efeitos e itens do ator sintético (gravados no delta do token).
    for (const scene of game.scenes) {
      for (const token of scene.tokens) {
        n += await migrarFlags(ctx, token);
        if (token.actorLink || !token.actor) continue;
        n += await migrarAtor(ctx, token.actor);
      }
    }
    if (n) console.log(`monolith-regras | lembretes: ${n} documento(s) migrado(s) do adv-reminder`);
  },

  /** Abre um diálogo de rolagem de amostra, com a caixinha e o botão no estilo escolhido. */
  configurar(ctx) {
    const opcoes = {
      mensagens: [ctx.t("Amostra.mensagem")],
      monolith: [
        { tipo: "enfase", icone: "fas fa-arrows-left-right-to-line", rotulo: "Ênfase armada", texto: "dois d20, vale o mais distante de 10" },
        { tipo: "penalidade", icone: "fas fa-face-tired", rotulo: "Exaustão 2", texto: "-2" }
      ],
      fontesVant: {
        override: null,
        advantages: { labels: [ctx.t("Amostra.vantagem")], suppressed: [] },
        disadvantages: { labels: [ctx.t("Amostra.desvantagem")], suppressed: [] }
      }
    };
    return CONFIG.Dice.D20Roll.build(
      { rolls: [{ parts: ["@mod", "@prof"], data: { mod: 3, prof: 2 }, options: {} }] },
      { options: { [OPCAO]: opcoes } },
      { create: false }
    );
  }
};
