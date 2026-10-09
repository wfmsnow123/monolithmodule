import { ID, esc, dadosDoc } from "./itemizar.mjs";

const { ApplicationV2 } = foundry.applications.api;

/** Leitura de um documento itemizado, a partir da cópia guardada no item. */
export class Leitor extends ApplicationV2 {
  static instancias = new Map();

  static abrir(item, { mostradoPor = null } = {}) {
    if (!item || !dadosDoc(item)) return null;
    let app = this.instancias.get(item.uuid);
    if (!app) { app = new this(item); this.instancias.set(item.uuid, app); }
    app.mostradoPor = mostradoPor;
    app.render({ force: true });
    return app;
  }

  static atualizar(item) {
    const app = this.instancias.get(item?.uuid);
    if (app?.rendered) app.render();
  }

  constructor(item, options = {}) {
    super({ ...options, id: `monolith-leitor-${item.uuid.replaceAll(".", "-")}` });
    this.item = item;
  }

  static DEFAULT_OPTIONS = {
    classes: ["mono", "monolith-leitor"],
    window: { title: "Documento", icon: "fas fa-book-open", resizable: true },
    position: { width: 820, height: Math.min(860, window.innerHeight - 80) },
    actions: { mostrar: Leitor.#mostrar, original: Leitor.#original, ir: Leitor.#ir }
  };

  get title() { return this.item.name; }

  async _renderHTML() {
    const d = dadosDoc(this.item);
    const conteudo = d?.conteudo ?? [];
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const paginas = [];
    for (const [i, p] of conteudo.entries()) {
      const html = await TextEditor.enrichHTML(p.html ?? "", { relativeTo: this.item, secrets: game.user.isGM });
      const temTema = p.classes?.length;
      paginas.push(`<article class="mi-pagina" data-i="${i}">
        ${p.titulo ? `<h2 class="mi-titulo">${esc(p.nome)}</h2>` : ""}
        <section class="journal-page-content ${temTema ? p.classes.join(" ") : "mi-simples"}">${html}</section>
      </article>`);
    }
    const podeMostrar = game.user.isGM || this.item.isOwner;
    const indice = conteudo.length > 1
      ? `<nav class="mi-indice">${conteudo.map((p, i) => `<a data-action="ir" data-i="${i}">${esc(p.nome)}</a>`).join("")}</nav>` : "";
    return `<div class="mi-leitor">
      <div class="mi-barra">
        ${this.mostradoPor ? `<span class="mi-aviso"><i class="fas fa-eye"></i> Mostrado por ${esc(this.mostradoPor)}</span>` : ""}
        ${indice}
        <span class="mi-acoes">
          ${podeMostrar ? `<button type="button" data-action="mostrar" data-tooltip="Mostrar a todos os jogadores"><i class="fas fa-eye"></i> Mostrar</button>` : ""}
          ${game.user.isGM && d?.origem ? `<button type="button" data-action="original" data-tooltip="Abrir o jornal de origem"><i class="fas fa-book"></i> Jornal</button>` : ""}
        </span>
      </div>
      <div class="mi-paginas">${paginas.join("") || `<p class="mi-vazio">Este documento está em branco.</p>`}</div>
    </div>`;
  }

  _replaceHTML(result, content) {
    const box = content.querySelector(".mi-paginas");
    const scroll = box?.scrollTop ?? 0;
    content.innerHTML = result;
    const novo = content.querySelector(".mi-paginas");
    if (novo) novo.scrollTop = scroll;
  }

  _onClose(options) {
    super._onClose(options);
    Leitor.instancias.delete(this.item.uuid);
  }

  static #mostrar() {
    game.socket.emit(`module.${ID}`, { acao: "mostrar", uuid: this.item.uuid, por: game.user.name });
    ui.notifications.info(`${this.item.name}: mostrado aos jogadores.`);
  }

  static async #original() {
    const j = await fromUuid(dadosDoc(this.item)?.origem);
    if (j) j.sheet.render(true);
    else ui.notifications.warn("O jornal de origem não existe mais.");
  }

  static #ir(ev, el) {
    this.element.querySelector(`.mi-pagina[data-i="${el.dataset.i}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
