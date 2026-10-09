/**
 * Recursos do Regras da Casa: módulos de terceiros (MIT) incorporados e adaptados a Monolith.
 *
 * Cada recurso mora em recursos/<id>/index.mjs e exporta por padrão uma definição:
 *   {
 *     id: "percepcao",                 // também é o prefixo das configurações e das flags
 *     nome: "Percepção", descricao: "...",
 *     original: ["perceptive"],         // ids dos módulos que este recurso substitui
 *     padrao: true,                     // ligado num mundo novo
 *     iniciar(ctx) {},                  // chamado no "init", só se o recurso estiver ligado
 *     async migrar(ctx) {},             // uma vez, no "ready" do GM: traz configurações e flags do original
 *     configurar() {}                   // opcional: abre a janela de configuração do recurso
 *   }
 *
 * O ctx entregue ao recurso (veja contexto()) prefixa configurações, flags e mensagens de socket,
 * para os recursos não pisarem uns nos outros dentro do mesmo módulo.
 */
import { ID } from "./util.mjs";

const RECURSOS = new Map();
const ativosNesteMundo = new Set();

export function definirRecurso(def) {
  if (!def?.id) return;
  RECURSOS.set(def.id, def);
}

export const recursos = () => [...RECURSOS.values()];
export const recursoAtivo = (id) => ativosNesteMundo.has(id);

/* ---------- Socket compartilhado: module.monolith-regras, uma mensagem por recurso ---------- */

const ouvintes = new Map();
let socketPronto = false;
function prepararSocket() {
  if (socketPronto || !game.socket) return;
  socketPronto = true;
  game.socket.on(`module.${ID}`, (msg, userId) => {
    if (!msg?.recurso) return;
    for (const fn of ouvintes.get(msg.recurso) ?? []) {
      try { fn(msg.dados, userId); } catch (err) { console.error(`${ID} | socket ${msg.recurso}`, err); }
    }
  });
}

/* ---------- Leitura das configurações e flags dos módulos originais ---------- */

/** Valor guardado no mundo (ou no navegador, para config de cliente) por um módulo que não está mais registrado. */
export function configAntiga(modulo, chave) {
  const doc = game.settings.storage.get("world")?.find((s) => s.key === `${modulo}.${chave}`);
  let bruto = doc?.value ?? globalThis.localStorage?.getItem(`${modulo}.${chave}`);
  if (bruto === undefined || bruto === null) return undefined;
  try { return JSON.parse(bruto); } catch { return bruto; }
}

/** Todas as configurações antigas de um módulo: { chave: valor }. */
export function configsAntigas(modulo) {
  const out = {};
  for (const doc of game.settings.storage.get("world") ?? []) {
    if (!doc.key.startsWith(`${modulo}.`)) continue;
    try { out[doc.key.slice(modulo.length + 1)] = JSON.parse(doc.value); } catch { out[doc.key.slice(modulo.length + 1)] = doc.value; }
  }
  return out;
}

/** Flags de um documento no escopo de um módulo antigo (funciona com o módulo desativado). */
export const flagsAntigas = (doc, modulo) => doc?._source?.flags?.[modulo] ?? doc?.flags?.[modulo];

/* ---------- Contexto entregue a cada recurso ---------- */

export function contexto(def) {
  const p = (k) => `${def.id}.${k}`;
  return {
    ID,
    recurso: def.id,
    chave: p,
    /** game.settings.register com a chave prefixada. */
    registrar: (k, dados) => game.settings.register(ID, p(k), dados),
    registrarMenu: (k, dados) => game.settings.registerMenu(ID, p(k), dados),
    get: (k) => game.settings.get(ID, p(k)),
    set: (k, v) => game.settings.set(ID, p(k), v),
    /** Flags do recurso ficam em flags["monolith-regras"][<id>]. */
    getFlag: (doc, k) => doc?.getFlag(ID, p(k)),
    setFlag: (doc, k, v) => doc?.setFlag(ID, p(k), v),
    unsetFlag: (doc, k) => doc?.unsetFlag(ID, p(k)),
    caminhoFlag: (k) => `flags.${ID}.${p(k)}`,
    /** Localização: chaves em MONOLITH.<id>.<chave> (arquivo recursos/<id>/lang/pt-BR.json). */
    t: (k, dados) => (dados ? game.i18n.format(`MONOLITH.${def.id}.${k}`, dados) : game.i18n.localize(`MONOLITH.${def.id}.${k}`)),
    socket: {
      emitir(dados) { game.socket.emit(`module.${ID}`, { recurso: def.id, dados }); },
      ouvir(fn) { prepararSocket(); if (!ouvintes.has(def.id)) ouvintes.set(def.id, []); ouvintes.get(def.id).push(fn); }
    },
    configAntiga, configsAntigas, flagsAntigas,
    caminho: `modules/${ID}/recursos/${def.id}`
  };
}

/* ---------- Registro, ligar e desligar ---------- */

export function registrarRecursos() {
  game.settings.register(ID, "recursosAtivos", { scope: "world", config: false, type: Object, default: {}, requiresReload: true });
  game.settings.register(ID, "recursosMigrados", { scope: "world", config: false, type: Object, default: {} });
  game.settings.registerMenu(ID, "recursos", {
    name: "Recursos", label: "Ligar e configurar recursos", icon: "fas fa-puzzle-piece",
    hint: "Percepção, Visão, Montaria, Lembretes, Barra de Chefe, Inventário, Troca e Retratos: cada um pode ser ligado, desligado e configurado aqui.",
    type: JanelaRecursos, restricted: true
  });

  const escolhas = game.settings.get(ID, "recursosAtivos") ?? {};
  for (const def of RECURSOS.values()) {
    const ligado = escolhas[def.id] ?? def.padrao ?? true;
    const originalAtivo = (def.original ?? []).some((m) => game.modules.get(m)?.active);
    if (!ligado || originalAtivo) continue;
    try {
      def.iniciar?.(contexto(def));
      ativosNesteMundo.add(def.id);
    } catch (err) {
      console.error(`${ID} | recurso ${def.id} falhou ao iniciar`, err);
    }
  }
}

/** No "ready" do GM: oferece desligar os módulos originais e migra os dados de cada recurso uma vez. */
export async function prepararRecursos() {
  if (!game.user.isGM) return;
  const escolhas = game.settings.get(ID, "recursosAtivos") ?? {};
  const duplicados = [];
  for (const def of RECURSOS.values()) {
    if (!(escolhas[def.id] ?? def.padrao ?? true)) continue;
    for (const m of def.original ?? []) if (game.modules.get(m)?.active) duplicados.push({ def, mod: game.modules.get(m) });
  }
  if (duplicados.length) {
    const lista = duplicados.map((d) => `<li><b>${d.mod.title}</b>: agora é o recurso <b>${d.def.nome}</b></li>`).join("");
    const ok = await foundry.applications.api.DialogV2.confirm({
      classes: ["mono"], window: { title: "Monolith: Regras da Casa" },
      content: `<p>Estes módulos foram incorporados ao Regras da Casa e estão ativos ao mesmo tempo. Enquanto o original estiver ligado, o recurso fica desligado para não duplicar.</p><ul>${lista}</ul><p>Desativar os originais agora? As configurações de vocês vêm junto. O mundo recarrega.</p>`
    }).catch(() => false);
    if (ok) {
      const cfg = foundry.utils.deepClone(game.settings.get("core", "moduleConfiguration"));
      for (const d of duplicados) cfg[d.mod.id] = false;
      await game.settings.set("core", "moduleConfiguration", cfg);
      return foundry.utils.debouncedReload();
    }
  }
  if (!game.users.activeGM?.isSelf) return;
  const migrados = foundry.utils.deepClone(game.settings.get(ID, "recursosMigrados") ?? {});
  let mudou = false;
  for (const id of ativosNesteMundo) {
    const def = RECURSOS.get(id);
    if (migrados[id] || !def.migrar) continue;
    try {
      await def.migrar(contexto(def));
      migrados[id] = true;
      mudou = true;
    } catch (err) {
      console.error(`${ID} | migração do recurso ${id} falhou`, err);
    }
  }
  if (mudou) await game.settings.set(ID, "recursosMigrados", migrados);
}

/* ---------- Janela de recursos ---------- */

const { ApplicationV2 } = foundry.applications.api;

class JanelaRecursos extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "monolith-regras-recursos",
    classes: ["mono", "monolith-recursos"],
    tag: "form",
    window: { title: "Regras da Casa: recursos", icon: "fas fa-puzzle-piece", resizable: true },
    position: { width: 620, height: Math.min(720, window.innerHeight - 100) },
    form: { handler: JanelaRecursos.#salvar, closeOnSubmit: true },
    actions: { configurar: JanelaRecursos.#configurar }
  };

  async _renderHTML() {
    const escolhas = game.settings.get(ID, "recursosAtivos") ?? {};
    const linhas = recursos().map((def) => {
      const ligado = escolhas[def.id] ?? def.padrao ?? true;
      const original = (def.original ?? []).map((m) => game.modules.get(m)).filter((m) => m?.active);
      const estado = original.length ? `<span class="mr-aviso">Desligado: ${original.map((m) => m.title).join(", ")} está ativo</span>`
        : ligado && !recursoAtivo(def.id) ? `<span class="mr-aviso">Recarregue o mundo para ligar</span>` : "";
      return `<li class="${ligado ? "on" : ""}">
        <label class="mr-chave"><input type="checkbox" name="${def.id}" ${ligado ? "checked" : ""}><span></span></label>
        <div class="mr-texto"><b>${def.nome}</b><p>${def.descricao ?? ""}</p>${estado}</div>
        ${def.configurar && recursoAtivo(def.id) ? `<button type="button" data-action="configurar" data-id="${def.id}"><i class="fas fa-sliders"></i> Configurar</button>` : ""}
      </li>`;
    }).join("");
    return `<div class="mr-recursos"><ul>${linhas}</ul>
      <footer><span class="hint">Ligar ou desligar um recurso recarrega o mundo.</span><button type="submit"><i class="fas fa-save"></i> Salvar</button></footer></div>`;
  }

  _replaceHTML(result, content) { content.innerHTML = result; }

  static async #salvar(ev, form) {
    const novo = {};
    for (const def of recursos()) novo[def.id] = !!form.elements[def.id]?.checked;
    await game.settings.set(ID, "recursosAtivos", novo);
  }

  static #configurar(ev, el) { RECURSOS.get(el.dataset.id)?.configurar?.(contexto(RECURSOS.get(el.dataset.id))); }
}
