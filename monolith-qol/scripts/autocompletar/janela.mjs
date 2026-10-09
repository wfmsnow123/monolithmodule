/**
 * A lista de propriedades que abre sobre o campo. Adaptada do Autocompleter do
 * Autocomplete Inline Properties (MIT), sem template Handlebars e no visual de Monolith.
 */
import { esc, t } from "../util.mjs";
import { DATA_MODE } from "./campos.mjs";

const { ApplicationV2 } = foundry.applications.api;

/** Formata o valor ao lado da chave. */
function formatar(valor) {
  switch (typeof valor) {
    case "undefined": return "undefined";
    case "object": return valor ? "{}" : "null";
    case "string": return `"${valor}"`;
    default: return String(valor);
  }
}

export class Autocompletar extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["mono", "monolith-qol", "mqol-autocompletar"],
    tag: "form",
    window: { title: "MONOLITH_QOL.autocompletar.nome", positioned: true, minimizable: false },
    position: { height: "auto" },
    form: { handler: Autocompletar.#inserir, submitOnChange: false, closeOnSubmit: true },
    actions: { voltar: Autocompletar.#voltar, escolher: Autocompletar.#escolher }
  };

  /**
   * @param {object} dados       objeto navegado pela lista
   * @param {HTMLInputElement} alvo
   * @param {string} chave       identifica o campo entre redesenhos da ficha
   * @param {object} cfg         configuração do campo (veja campos.mjs)
   * @param {Function} aoFechar
   */
  constructor(dados, alvo, chave, cfg, aoFechar) {
    super();
    this.dados = dados;
    this.alvo = alvo;
    this.chave = chave;
    this.filtradas = cfg.filteredKeys ?? null;
    const rollData = [DATA_MODE.ROLL_DATA, DATA_MODE.OWNING_ACTOR_ROLL_DATA].includes(cfg.dataMode);
    this.prefixo = cfg.inlinePrefix ?? (rollData ? "@" : "");
    this.caminho = cfg.defaultPath?.length ? this.#comPonto(cfg.defaultPath) : "";
    this.aoFechar = aoFechar;
    /** Índice escolhido com as setas; null segue a melhor correspondência. */
    this.escolhido = null;
  }

  get input() {
    return this.element?.querySelector("input.mqol-ac-input");
  }

  /** Acrescenta "." se a chave leva a um objeto (para continuar navegando). */
  #comPonto(chave) {
    const v = foundry.utils.getProperty(this.dados, chave);
    return chave + (v && typeof v === "object" ? "." : "");
  }

  /** Entradas no nível atual do caminho, primitivos primeiro e depois em ordem alfabética. */
  get entradas() {
    const base = this.caminho.split(".").slice(0, -1).join(".");
    const valor = base ? foundry.utils.getProperty(this.dados, base) : this.dados;
    if (valor === null || valor === undefined || typeof valor !== "object") return [];
    return Object.entries(valor)
      .map(([k, v]) => ({ key: base ? `${base}.${k}` : k, value: v }))
      .filter(({ key }) => !this.filtradas?.some((f) => key.startsWith(f)))
      .sort((a, b) => {
        const pa = typeof a.value !== "object", pb = typeof b.value !== "object";
        if (pa !== pb) return pa ? -1 : 1;
        return a.key.localeCompare(b.key);
      });
  }

  get melhorIndice() {
    return this.entradas.findIndex(({ key }) => key.startsWith(this.caminho));
  }

  get escolha() {
    const lista = this.entradas;
    return this.escolhido !== null ? lista[this.escolhido] : lista[this.melhorIndice];
  }

  /** A ficha foi redesenhada: aponta para o campo novo. */
  reapontar(alvo) {
    this.alvo = alvo;
    this.escolhido = null;
    this.render();
    this.bringToFront();
  }

  async _renderHTML() {
    const lista = this.entradas;
    let destaque = this.escolhido;
    const itens = lista.map(({ key, value }, i) => {
      const casa = key.startsWith(this.caminho) && this.caminho.length;
      if (casa && destaque === null) destaque = i;
      const rotulo = casa ? `<span class="mqol-ac-casa">${esc(key.slice(0, this.caminho.length))}</span>${esc(key.slice(this.caminho.length))}` : esc(key);
      return { i, key, rotulo, valor: formatar(value) };
    });
    destaque ??= 0;
    const li = itens.map((x) => `<li class="mqol-ac-item${x.i === destaque ? " destaque" : ""}">
        <span class="mqol-ac-prefixo">${esc(this.prefixo)}</span>
        <a class="mqol-ac-chave" data-action="escolher" data-key="${esc(x.key)}">${x.rotulo}</a>
        <span class="mqol-ac-valor" title="${esc(x.valor)}">${esc(x.valor)}</span>
      </li>`).join("");
    return `<ol class="mqol-ac-lista">${li || `<li class="mqol-ac-vazio">${t("autocompletar.vazio")}</li>`}</ol>
      <div class="mqol-ac-form">
        <button type="button" class="mono-btn" data-action="voltar" data-tooltip="MONOLITH_QOL.autocompletar.voltar"><i class="fa-solid fa-turn-left-up" inert></i></button>
        <input class="mqol-ac-input mono-input" type="text" value="${esc(this.caminho)}" spellcheck="false" autocomplete="off">
        <button type="submit" class="mono-btn mono-btn--primary" data-tooltip="MONOLITH_QOL.autocompletar.inserir"><i class="fa-solid fa-i-cursor" inert></i></button>
      </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const input = this.input;
    input.addEventListener("input", () => this.#mudou());
    input.addEventListener("keydown", (ev) => this.#tecla(ev));
    // O cursor fica sempre no fim do caminho.
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  /** Abre logo abaixo do campo; a altura final é ajustada em _updatePosition. */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    const r = this.alvo.getBoundingClientRect();
    options.position ??= {};
    Object.assign(options.position, { top: r.bottom, left: r.left, width: Math.max(300, r.width) });
    options.force = true;
  }

  /** Acima do campo, com a lista crescendo para cima, como no original. */
  _updatePosition(position) {
    if (!this.element) return super._updatePosition(position);
    const r = this.alvo.getBoundingClientRect();
    const altura = this.element.getBoundingClientRect().height;
    position.top = r.top - altura - 5 >= 0 ? r.top - altura - 5 : r.bottom + 5;
    return super._updatePosition(position);
  }

  /** Sem cabeçalho de janela: a lista é um balão sobre o campo. */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    const cab = frame.querySelector(".window-header");
    if (cab) cab.style.display = "none";
    return frame;
  }

  async close(options = {}) {
    this.aoFechar?.();
    return super.close(options);
  }

  #mudou() {
    this.caminho = this.input.value;
    this.escolhido = null;
    this.render();
  }

  /** @param {KeyboardEvent} ev */
  #tecla(ev) {
    const n = this.entradas.length;
    switch (ev.key) {
      case "Escape":
        ev.preventDefault();
        this.close();
        this.alvo.focus();
        return;
      case "ArrowUp":
      case "ArrowDown": {
        ev.preventDefault();
        ev.stopPropagation();
        if (!n) { this.escolhido = null; return; }
        // A lista cresce para cima: seta para cima avança no índice.
        const atual = this.escolhido ?? Math.max(0, this.melhorIndice);
        this.escolhido = (atual + (ev.key === "ArrowUp" ? 1 : n - 1)) % n;
        this.render();
        return;
      }
      case "Tab": {
        ev.preventDefault();
        ev.stopPropagation();
        const e = this.escolha;
        if (!e) {
          ui.notifications.warn(t("autocompletar.semChave", { chave: this.caminho }));
          this.caminho = "";
        } else this.caminho = this.#comPonto(e.key);
        this.escolhido = null;
        this.render();
      }
    }
  }

  static #escolher(event, alvo) {
    this.input.value = this.#comPonto(alvo.dataset.key);
    this.#mudou();
  }

  static #voltar(event) {
    event.preventDefault();
    const txt = this.input.value;
    const ultimo = txt.slice(0, -1).lastIndexOf(".");
    this.input.value = ultimo > 0 ? txt.slice(0, ultimo + 1) : "";
    this.#mudou();
  }

  /** Insere o caminho escolhido na posição do cursor do campo original. */
  static async #inserir(event) {
    event.preventDefault();
    const antigo = this.alvo.value;
    const ini = this.alvo.selectionStart ?? antigo.length;
    const fim = this.alvo.selectionEnd ?? antigo.length;
    const antes = antigo.slice(0, ini);
    const depois = antigo.slice(fim);
    const espA = !antes.length || antes.endsWith(" ") ? "" : " ";
    const espD = !depois.length || depois.startsWith(" ") ? "" : " ";
    const texto = `${espA}${this.prefixo}${this.escolha?.key ?? this.input.value}${espD}`;

    this.alvo.focus();
    const ev = new InputEvent("input", { bubbles: true, data: texto, inputType: "insertText", cancelable: true });
    if (this.alvo.dispatchEvent(ev)) {
      this.alvo.value = `${antes}${texto}${depois}`;
      const pos = antes.length + texto.length;
      this.alvo.setSelectionRange?.(pos, pos);
      // Avisa a ficha da mudança (fichas com submitOnChange salvam no "change").
      this.alvo.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}
