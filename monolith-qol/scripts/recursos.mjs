/**
 * Recursos do QoL Mods: cada um vem de um módulo de terceiros (licença permissiva) adaptado à V13.
 *
 * Definição de um recurso (scripts/<id>/index.mjs):
 *   {
 *     id, icone,                         // id também prefixa as configurações: "<id>.<chave>"
 *     original: "gm-vision",             // módulo que este recurso substitui
 *     recarregar: false,                 // true: ligar ou desligar só vale depois de recarregar
 *     opcoes: [{ chave, tipo, padrao, escopo, config, min, max, step, escolhas, aoMudar }],
 *     migracao: { "chave-original": "chaveNova" },
 *     iniciar() {},                      // no "init", se o original não estiver ativo
 *     pronto() {},                       // no "ready"
 *     aoAlternar(ligado) {}              // quando o Mestre liga ou desliga sem recarregar
 *   }
 * Nomes e dicas vêm do lang: MONOLITH_QOL.<id>.nome, .descricao, .nota e .opcoes.<chave>.nome/.dica.
 */
import { ID, esc, t, configAntiga } from "./util.mjs";

const RECURSOS = new Map();
const iniciados = new Set();

export function definirRecurso(def) {
  RECURSOS.set(def.id, def);
}

export const recursos = () => [...RECURSOS.values()];
export const opcao = (id, chave) => game.settings.get(ID, `${id}.${chave}`);
export const definirOpcao = (id, chave, valor) => game.settings.set(ID, `${id}.${chave}`, valor);
export const originalAtivo = (def) => !!game.modules.get(def.original)?.active;

/** O recurso está funcionando agora: iniciado neste carregamento e ligado pelo Mestre. */
export const ligado = (id) => iniciados.has(id) && !!opcao(id, "ligado");

/* ---------- Registro ---------- */

export function registrarRecursos() {
  game.settings.register(ID, "migrados", { scope: "world", config: false, type: Object, default: {} });

  for (const def of RECURSOS.values()) {
    game.settings.register(ID, `${def.id}.ligado`, {
      scope: "world", config: false, type: Boolean, default: true,
      onChange: (v) => { if (iniciados.has(def.id)) def.aoAlternar?.(v); }
    });
    for (const o of def.opcoes ?? []) {
      game.settings.register(ID, `${def.id}.${o.chave}`, {
        name: `MONOLITH_QOL.${def.id}.opcoes.${o.chave}.nome`,
        scope: o.escopo ?? "world", config: false, type: o.tipo, default: o.padrao,
        onChange: o.aoMudar
      });
    }
    game.settings.registerMenu(ID, def.id, {
      name: `MONOLITH_QOL.${def.id}.nome`,
      label: "MONOLITH_QOL.janela.abrir",
      hint: `MONOLITH_QOL.${def.id}.descricao`,
      icon: def.icone,
      type: criarJanela(def),
      restricted: true
    });

    if (originalAtivo(def)) continue;
    if (def.recarregar && !opcao(def.id, "ligado")) continue;
    try {
      def.iniciar?.();
      iniciados.add(def.id);
    } catch (err) {
      console.error(`${ID} | o recurso ${def.id} falhou ao iniciar`, err);
    }
  }
}

export function recursosProntos() {
  for (const id of iniciados) {
    try { RECURSOS.get(id).pronto?.(); } catch (err) { console.error(`${ID} | ${id}`, err); }
  }
}

/* ---------- Originais ativos e migração ---------- */

async function desativarModulos(ids) {
  const cfg = foundry.utils.deepClone(game.settings.get("core", "moduleConfiguration"));
  for (const m of ids) cfg[m] = false;
  await game.settings.set("core", "moduleConfiguration", cfg);
  foundry.utils.debouncedReload();
}

/** No "ready" do Mestre: avisa dos originais ainda ativos e traz as configurações deles uma vez. */
export async function prepararRecursos() {
  if (!game.user.isGM) return;

  const duplicados = recursos().filter(originalAtivo);
  if (duplicados.length) {
    const lista = duplicados.map((d) => `<li>${t("conflito.item", { original: esc(game.modules.get(d.original).title), recurso: esc(t(`${d.id}.nome`)) })}</li>`).join("");
    const ok = await foundry.applications.api.DialogV2.confirm({
      classes: ["mono"],
      window: { title: "MONOLITH_QOL.titulo", icon: "fas fa-screwdriver-wrench" },
      content: `<p>${t("conflito.texto")}</p><ul>${lista}</ul><p>${t("conflito.pergunta")}</p>`,
      yes: { label: "MONOLITH_QOL.conflito.sim" },
      no: { label: "MONOLITH_QOL.conflito.nao" }
    }).catch(() => false);
    if (ok) return desativarModulos(duplicados.map((d) => d.original));
  }

  if (!game.users.activeGM?.isSelf) return;
  const migrados = foundry.utils.deepClone(game.settings.get(ID, "migrados") ?? {});
  const trazidos = [];
  for (const def of recursos()) {
    if (migrados[def.id] || originalAtivo(def)) continue;
    let algum = false;
    try {
      for (const [velha, nova] of Object.entries(def.migracao ?? {})) {
        const v = configAntiga(def.original, velha);
        if (v === undefined) continue;
        await definirOpcao(def.id, nova, v);
        algum = true;
      }
    } catch (err) {
      console.error(`${ID} | migração de ${def.original} falhou`, err);
      continue;
    }
    migrados[def.id] = true;
    if (algum) trazidos.push(game.modules.get(def.original)?.title ?? def.original);
  }
  await game.settings.set(ID, "migrados", migrados);
  if (trazidos.length) ui.notifications.info(t("migracao.feita", { lista: trazidos.join(", ") }));
}

/* ---------- Janela de cada recurso ---------- */

const { ApplicationV2 } = foundry.applications.api;

function criarJanela(def) {
  const visiveis = () => (def.opcoes ?? []).filter((o) => o.config !== false);
  const nomeOpcao = (o, campo) => t(`${def.id}.opcoes.${o.chave}.${campo}`);

  function controle(o, valor) {
    const nome = `${def.id}.${o.chave}`;
    const id = `mqol-${def.id}-${o.chave}`;
    if (o.tipo === Boolean) return `<input class="mono-toggle" type="checkbox" role="switch" id="${id}" name="${nome}" ${valor ? "checked" : ""}>`;
    if (o.escolhas) {
      const ops = Object.entries(o.escolhas).map(([v, rotulo]) => `<option value="${esc(v)}" ${String(v) === String(valor) ? "selected" : ""}>${esc(t(rotulo))}</option>`).join("");
      return `<select class="mono-select" id="${id}" name="${nome}">${ops}</select>`;
    }
    if (o.tipo === Number) return `<input class="mono-input" type="number" id="${id}" name="${nome}" value="${esc(valor)}" ${o.min !== undefined ? `min="${o.min}"` : ""} ${o.max !== undefined ? `max="${o.max}"` : ""} step="${o.step ?? "any"}">`;
    return `<input class="mono-input" type="text" id="${id}" name="${nome}" value="${esc(valor)}">`;
  }

  const campo = (id, rotulo, ctrl, dica) => `<div class="mono-field"><label class="mono-field__label" for="${id}">${rotulo}</label>${ctrl}${dica ? `<p class="mono-field__hint">${dica}</p>` : ""}</div>`;

  return class JanelaRecurso extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: `monolith-qol-${def.id}`,
      classes: ["mono", "monolith-qol"],
      tag: "form",
      window: { title: `MONOLITH_QOL.${def.id}.nome`, icon: def.icone, resizable: true },
      position: { width: 560, height: "auto" },
      form: { handler: JanelaRecurso.#salvar, closeOnSubmit: true },
      actions: { padroes: JanelaRecurso.#padroes, desativarOriginal: JanelaRecurso.#desativarOriginal }
    };

    async _renderHTML() {
      const avisos = [];
      if (originalAtivo(def)) {
        const titulo = esc(game.modules.get(def.original).title);
        avisos.push(`<div class="mono-notice mono-notice--danger"><p class="mono-notice__title">${t("janela.originalTitulo")}</p>
          <p class="mono-notice__body">${t("janela.originalTexto", { original: titulo })}</p>
          <p class="mqol-acoes"><button type="button" class="mono-btn" data-action="desativarOriginal">${t("janela.desativarOriginal", { original: titulo })}</button></p></div>`);
      } else if (opcao(def.id, "ligado") && !iniciados.has(def.id)) {
        avisos.push(`<div class="mono-notice mono-notice--warn"><p class="mono-notice__title">${t("janela.recarregarTitulo")}</p><p class="mono-notice__body">${t("janela.recarregarTexto")}</p></div>`);
      }
      const nota = game.i18n.has(`MONOLITH_QOL.${def.id}.nota`) ? `<div class="mono-notice mono-notice--info"><p class="mono-notice__title">${t("janela.notaTitulo")}</p><p class="mono-notice__body">${t(`${def.id}.nota`)}</p></div>` : "";
      const opcoes = visiveis().map((o) => campo(`mqol-${def.id}-${o.chave}`, nomeOpcao(o, "nome"), controle(o, opcao(def.id, o.chave)), nomeOpcao(o, "dica"))).join("");
      const ligadoId = `mqol-${def.id}-ligado`;

      return `<div class="mqol-janela">
        ${avisos.join("")}
        <p class="mqol-descricao">${t(`${def.id}.descricao`)}</p>
        <h3 class="mono-heading">${t("janela.recurso")}</h3>
        ${campo(ligadoId, t("janela.ligado"), `<input class="mono-toggle" type="checkbox" role="switch" id="${ligadoId}" name="${def.id}.ligado" ${opcao(def.id, "ligado") ? "checked" : ""}>`, def.recarregar ? t("janela.ligadoRecarrega") : t("janela.ligadoDica"))}
        ${opcoes ? `<h3 class="mono-heading">${t("janela.opcoes")}</h3>${opcoes}` : ""}
        ${nota}
        <p class="mqol-origem">${t("janela.origem", { original: esc(t(`${def.id}.origem`)) })}</p>
        <footer class="mono-window__footer mqol-rodape">
          <button type="button" class="mono-btn mono-btn--ghost" data-action="padroes">${t("janela.padroes")}</button>
          <button type="submit" class="mono-btn mono-btn--primary"><i class="fas fa-save" inert></i> ${t("janela.salvar")}</button>
        </footer>
      </div>`;
    }

    _replaceHTML(result, content) { content.innerHTML = result; }

    /** Preenche o formulário com os valores padrão; só grava ao Salvar. */
    static #padroes() {
      const f = this.element.elements;
      if (f[`${def.id}.ligado`]) f[`${def.id}.ligado`].checked = true;
      for (const o of visiveis()) {
        const el = f[`${def.id}.${o.chave}`];
        if (!el) continue;
        if (o.tipo === Boolean) el.checked = !!o.padrao;
        else el.value = o.padrao;
      }
    }

    static async #desativarOriginal() {
      const titulo = game.modules.get(def.original)?.title ?? def.original;
      const ok = await foundry.applications.api.DialogV2.confirm({
        classes: ["mono"], window: { title: "MONOLITH_QOL.titulo" },
        content: `<p>${t("janela.desativarConfirma", { original: esc(titulo) })}</p>`
      }).catch(() => false);
      if (ok) await desativarModulos([def.original]);
    }

    static async #salvar(event, form) {
      const f = form.elements;
      const antes = opcao(def.id, "ligado");
      const agora = !!f[`${def.id}.ligado`]?.checked;
      for (const o of visiveis()) {
        const el = f[`${def.id}.${o.chave}`];
        if (!el) continue;
        let v;
        if (o.tipo === Boolean) v = el.checked;
        else if (o.tipo === Number) {
          v = Number(el.value);
          if (!Number.isFinite(v)) v = o.padrao;
          if (o.min !== undefined) v = Math.max(o.min, v);
          if (o.max !== undefined) v = Math.min(o.max, v);
        } else v = el.value;
        if (v !== opcao(def.id, o.chave)) await definirOpcao(def.id, o.chave, v);
      }
      if (agora !== antes) {
        await definirOpcao(def.id, "ligado", agora);
        if (def.recarregar && !originalAtivo(def)) await foundry.applications.settings.SettingsConfig.reloadConfirm({ world: true });
      }
    }
  };
}
