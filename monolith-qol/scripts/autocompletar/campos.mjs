/**
 * Quais campos ganham o autocompletar, e de onde vêm os dados.
 * Adaptado do Autocomplete Inline Properties (MIT): ficaram o core (Efeitos Ativos) e o dnd5e 5.2;
 * as configurações de pf1, sw5e e cosmere-rpg foram cortadas.
 */
import { ligado, opcao } from "../recursos.mjs";
import { Autocompletar } from "./janela.mjs";

/** O que é oferecido na lista. Mesmos valores do original, para quem usa a API. */
export const DATA_MODE = {
  DOCUMENT_DATA: "document",
  ROLL_DATA: "roll",
  OWNING_ACTOR_DATA: "owning-actor",
  OWNING_ACTOR_ROLL_DATA: "actor-roll",
  TARGET_ACTOR_DATA: "target-actor",
  CUSTOM: "custom"
};

/** Ator dono do documento; para efeito num item, o ator dono do item. */
const atorDono = (app) => {
  const p = app.document?.actor ?? app.document?.parent;
  if (p instanceof Actor) return p;
  return p?.actor instanceof Actor ? p.actor : null;
};
const atorAlvo = (app) => (app.document?.target instanceof Actor ? app.document.target : null);

export const DATA_GETTERS = {
  [DATA_MODE.DOCUMENT_DATA]: (app) => app.document?.toObject(false),
  [DATA_MODE.ROLL_DATA]: (app) => app.document?.getRollData(),
  [DATA_MODE.OWNING_ACTOR_DATA]: (app) => atorDono(app)?.toObject(false) ?? dadosAtorGenerico(),
  [DATA_MODE.OWNING_ACTOR_ROLL_DATA]: (app) => atorDono(app)?.getRollData() ?? rollDataAtorGenerico(),
  [DATA_MODE.TARGET_ACTOR_DATA]: (app) => atorAlvo(app)?.toObject(false) ?? dadosAtorGenerico(),
  [DATA_MODE.CUSTOM]: (app, getter) => getter(app)
};

/* ---------- Atores de mentira: dados de todos os tipos, para documentos sem dono ---------- */

let _atores, _dados, _rollData;

function atoresGenericos() {
  const cls = CONFIG.Actor.documentClass;
  _atores ??= cls.TYPES.filter((tipo) => tipo !== CONST.BASE_DOCUMENT_TYPE).flatMap((type) => {
    try { return [new cls({ type, name: "AIP" })]; } catch { return []; }
  });
  return _atores;
}

function dadosAtorGenerico() {
  if (!_dados) {
    _dados = {};
    for (const a of atoresGenericos()) foundry.utils.mergeObject(_dados, a.toObject(false));
  }
  return _dados;
}

function rollDataAtorGenerico() {
  if (!_rollData) {
    _rollData = {};
    for (const a of atoresGenericos()) foundry.utils.mergeObject(_rollData, a.getRollData());
  }
  return _rollData;
}

/** Roll data de um item (ou atividade) sem ator: o item é posto em cada ator de mentira e os dados somados. */
function rollDataItemSemAtor(item, atividadeId) {
  const dados = {};
  const fonte = item.toObject();
  const cls = CONFIG.Item.documentClass;
  for (const ator of atoresGenericos()) {
    try {
      const temp = new cls(fonte, { parent: ator });
      const alvo = atividadeId ? temp.system.activities?.get(atividadeId) ?? temp : temp;
      foundry.utils.mergeObject(dados, alvo.getRollData());
    } catch { /* tipo de ator que não aceita este item */ }
  }
  return dados;
}

/* ---------- Configuração dos campos ---------- */

/**
 * @typedef {object} ConfigCampo
 * @property {string} selector        seletor dos campos dentro da janela
 * @property {string} [defaultPath]   caminho já preenchido ao abrir
 * @property {boolean} showButton     mostra o botão @ ao passar o mouse
 * @property {boolean} allowHotkey    a tecla @ abre a lista
 * @property {string[]} [filteredKeys] chaves escondidas da lista
 * @property {string} dataMode        um de DATA_MODE
 * @property {string} [inlinePrefix]  prefixo inserido no campo (padrão: "@" nos modos de roll data)
 * @property {Function} [customDataGetter] com DATA_MODE.CUSTOM
 */

/** Lista de pacotes no formato do original: [{ packageName, sheetClasses: [{ name, fieldConfigs }] }]. */
export const PACKAGE_CONFIG = [];

const campo = (selector, dataMode, extra = {}) => ({ selector, showButton: true, allowHotkey: true, dataMode, ...extra });

export function montarConfig() {
  PACKAGE_CONFIG.length = 0;
  PACKAGE_CONFIG.push({
    packageName: "core",
    sheetClasses: [{
      name: "ActiveEffectConfig",
      fieldConfigs: [
        // Chave da mudança: caminho do ator, sem prefixo.
        campo(`.tab[data-tab="changes"] .key input[type="text"]`, DATA_MODE.OWNING_ACTOR_DATA, { defaultPath: "system", grupo: "efeitos" }),
        // Valor da mudança: aceita @fórmulas com a roll data do ator. O original apontava as duas
        // configurações para a chave; aqui a segunda vai para o valor, como pretendido.
        campo(`.tab[data-tab="changes"] .value input[type="text"]`, DATA_MODE.OWNING_ACTOR_ROLL_DATA, { inlinePrefix: "@", grupo: "efeitos" })
      ]
    }]
  });

  // dnd5e 5.2: atividades, itens e janelas de configuração do ator.
  // As configurações do original (ProficiencyConfig, attack.bonus no item) são da 3.x e não existem mais.
  const formulaItem = `input[type="text"]:is([name$="bonus"], [name*="bonuses."], [name$="formula"], [name$="uses.max"])`;
  const formula = formulaItem.replace(/\)$/, `, [name^="consumption.targets."][name$=".value"])`);
  PACKAGE_CONFIG.push({
    packageName: "dnd5e",
    sheetClasses: [
      {
        name: "ActivitySheet",
        fieldConfigs: [campo(formula, DATA_MODE.CUSTOM, {
          inlinePrefix: "@", grupo: "dnd5e",
          customDataGetter: (app) => {
            const item = app.item;
            if (!item) return null;
            return item.actor ? (app.document?.getRollData() ?? item.getRollData()) : rollDataItemSemAtor(item, app.document?.id);
          }
        })]
      },
      {
        name: "ItemSheet5e",
        fieldConfigs: [campo(formulaItem, DATA_MODE.CUSTOM, {
          inlinePrefix: "@", grupo: "dnd5e",
          customDataGetter: (app) => (app.document?.actor ? app.document.getRollData() : app.document && rollDataItemSemAtor(app.document))
        })]
      },
      {
        name: "BaseConfigSheet",
        fieldConfigs: [campo(`input[type="text"]:is([name*="bonuses"], [name$="bonus"], [name$="formula"])`, DATA_MODE.CUSTOM, {
          inlinePrefix: "@", grupo: "dnd5e",
          customDataGetter: (app) => (app.document instanceof Actor ? app.document.getRollData() : null)
        })]
      }
    ]
  });
}

/* ---------- Registro ---------- */

const pacoteAtivo = (nome) => nome === "core" || nome === game.system.id || game.modules.get(nome)?.active;
const grupoLigado = (cfg) => !cfg.grupo || opcao("autocompletar", cfg.grupo);

export function registrarCampos() {
  const vistos = new Set();
  for (const pkg of PACKAGE_CONFIG) {
    if (!pacoteAtivo(pkg.packageName)) continue;
    for (const sc of pkg.sheetClasses) {
      if (vistos.has(sc.name)) continue;
      vistos.add(sc.name);
      // ApplicationV2 dispara render<Classe> para cada classe da herança: subclasses também entram.
      Hooks.on(`render${sc.name}`, (app) => {
        if (!ligado("autocompletar")) return;
        const configs = PACKAGE_CONFIG.filter((p) => pacoteAtivo(p.packageName))
          .flatMap((p) => p.sheetClasses).filter((s) => s.name === sc.name).flatMap((s) => s.fieldConfigs);
        aplicarConfigs(app, configs);
      });
    }
  }
}

/** Reaplica o autocompletar a uma janela já aberta (API, como no original). */
export function refreshPackageConfig(app, packageName) {
  const nomes = [...app.constructor.inheritanceChain()].map((c) => c.name);
  const configs = PACKAGE_CONFIG
    .filter((p) => pacoteAtivo(p.packageName) && (packageName === undefined || p.packageName === packageName))
    .flatMap((p) => p.sheetClasses).filter((s) => nomes.includes(s.name)).flatMap((s) => s.fieldConfigs);
  aplicarConfigs(app, configs);
}

function aplicarConfigs(app, configs) {
  for (const cfg of configs) if (grupoLigado(cfg)) aplicarConfig(app, cfg);
}

let _janela = null;
let _botao = null;

export function dados(app, cfg) {
  const getter = DATA_GETTERS[cfg.dataMode];
  if (!getter) throw new Error(`Modo de dados desconhecido: "${cfg.dataMode}"`);
  return getter(app, cfg.customDataGetter);
}

function aplicarConfig(app, cfg) {
  const raiz = app.element;
  if (!raiz) return;
  try {
    if (!dados(app, cfg)) return;
  } catch (err) {
    console.error("monolith-qol | autocompletar", err, app, cfg);
    return;
  }

  const alvos = [...raiz.querySelectorAll(cfg.selector)].filter((e) => e.tagName === "TEXTAREA" || (e.tagName === "INPUT" && e.type === "text"));
  for (const alvo of alvos) {
    const chave = app.id + alvo.name;
    tirarOuvintes(alvo);

    if (cfg.showButton && opcao("autocompletar", "botao") && !alvo.disabled && !alvo.readOnly) {
      alvo.addEventListener("mouseenter", (alvo._mqolEntrar = () => mostrarBotao(alvo, chave, cfg, app)));
      alvo.addEventListener("mouseout", (alvo._mqolSair = (ev) => {
        if (!ev.relatedTarget?.closest?.("button.mqol-ac-botao")) tirarBotao();
      }));
      alvo.addEventListener("input", tirarBotao);
      raiz.addEventListener("wheel", tirarBotao, { passive: true });
    }

    if (cfg.allowHotkey && opcao("autocompletar", "tecla")) {
      alvo.addEventListener("keydown", (alvo._mqolTecla = (ev) => {
        if (ev.key !== "@") return;
        ev.preventDefault();
        abrir(alvo, chave, cfg, app);
      }));
    }

    // A janela foi redesenhada com a lista aberta: a lista passa a apontar para o campo novo.
    if (_janela?.chave === chave) _janela.reapontar(alvo);
  }
}

function tirarOuvintes(alvo) {
  if (alvo._mqolEntrar) alvo.removeEventListener("mouseenter", alvo._mqolEntrar);
  if (alvo._mqolSair) alvo.removeEventListener("mouseout", alvo._mqolSair);
  if (alvo._mqolTecla) alvo.removeEventListener("keydown", alvo._mqolTecla);
  delete alvo._mqolEntrar; delete alvo._mqolSair; delete alvo._mqolTecla;
}

function mostrarBotao(alvo, chave, cfg, app) {
  tirarBotao();
  const b = document.createElement("button");
  b.type = "button";
  b.className = "mqol-ac-botao";
  b.dataset.tooltip = "MONOLITH_QOL.autocompletar.botao";
  b.innerHTML = `<i class="fa-solid fa-at" inert></i>`;
  const r = alvo.getBoundingClientRect();
  const lado = Math.max(16, r.height - 4);
  Object.assign(b.style, { width: `${lado}px`, height: `${lado}px`, top: `${r.top + 2}px`, left: `${r.right - lado - 2}px`, fontSize: `${Math.max(10, lado - 8)}px` });
  b.addEventListener("click", (ev) => { ev.preventDefault(); abrir(alvo, chave, cfg, app); });
  b.addEventListener("mouseout", (ev) => { if (ev.relatedTarget !== alvo && !ev.relatedTarget?.closest?.("button.mqol-ac-botao")) tirarBotao(); });
  document.body.append(b);
  _botao = b;
}

export function tirarBotao() {
  _botao?.remove();
  _botao = null;
}

function abrir(alvo, chave, cfg, app) {
  tirarBotao();
  _janela?.close();
  _janela = new Autocompletar(dados(app, cfg), alvo, chave, cfg, () => { _janela = null; });
  _janela.render({ force: true });
}

/** Fecha a lista ao clicar fora dela. */
export function ouvirCliqueFora() {
  document.addEventListener("pointerdown", (ev) => {
    if (!_janela?.element) return;
    if (ev.target.closest?.("button.mqol-ac-botao") || _janela.element.contains(ev.target)) return;
    _janela.close();
  }, { passive: true });
}
