import { ID, TEMAS, classesDe } from "./temas.mjs";

const { ApplicationV2 } = foundry.applications.api;
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

const AMOSTRA = `<h2>Título</h2><p>Nova Albion continua entediante, exceto pelas partes erradas. Ladrões medíocres roubam coisas que exigem memória.</p><hr><p>Assinado, DK.</p>`;

/** Escolha do tema de um jornal (ou de uma página dele). */
export class SeletorTema extends ApplicationV2 {
  constructor(journal, pageId = null, options = {}) {
    super({ ...options, id: `monolith-journals-tema-${journal.id}` });
    this.journal = journal;
    this.pageId = pageId;
    const page = pageId ? journal.pages.get(pageId) : null;
    const atual = page?.getFlag(ID, "tema") ?? journal.getFlag(ID, "tema") ?? {};
    this.escopo = page?.getFlag(ID, "tema") ? "pagina" : "jornal";
    this.rascunho = { tema: atual.tema && atual.tema !== "nenhum" ? atual.tema : "documento", classes: [...(atual.classes ?? [])], semTitulo: !!atual.semTitulo };
  }

  static DEFAULT_OPTIONS = {
    classes: ["mono", "monolith-journals-seletor"],
    tag: "form",
    window: { title: "Tema do jornal", icon: "fas fa-scroll", resizable: true },
    position: { width: 760, height: Math.min(720, window.innerHeight - 100) },
    form: { handler: SeletorTema.#aplicar, closeOnSubmit: true },
    actions: { escolher: SeletorTema.#escolher, remover: SeletorTema.#remover }
  };

  get title() { return `Tema: ${this.journal.name}`; }

  async _renderHTML() {
    const r = this.rascunho;
    const def = TEMAS.find((t) => t.id === r.tema) ?? TEMAS[0];
    const cards = TEMAS.map((t) => {
      const cls = t.id === r.tema ? classesDe(r) : classesDe({ tema: t.id });
      return `<button type="button" class="mjs-card ${t.id === r.tema ? "ativo" : ""}" data-action="escolher" data-tema="${t.id}">
        <span class="mjs-palco"><span class="${cls.join(" ")} mj-amostra">${AMOSTRA}</span></span>
        <span class="mjs-nome">${t.nome}</span><span class="mjs-desc">${t.descricao}</span></button>`;
    }).join("");
    const grupos = def.grupos.map((g, i) => {
      const atual = r.classes.find((c) => c in g.opcoes) ?? "";
      const op = Object.entries(g.opcoes).map(([v, l]) => `<option value="${v}" ${v === atual ? "selected" : ""}>${l}</option>`).join("");
      return `<label>${g.nome} <select name="g${i}">${op}</select></label>`;
    }).join("");
    const page = this.pageId ? this.journal.pages.get(this.pageId) : null;
    return `<div class="mjs-corpo">
      <div class="mjs-grade">${cards}</div>
      <footer class="mjs-rodape">
        <div class="mjs-opcoes">${grupos}
          <label class="mjs-check"><input type="checkbox" name="semTitulo" ${r.semTitulo ? "checked" : ""}> Esconder o título da página</label>
        </div>
        <div class="mjs-escopo">
          <label><input type="radio" name="escopo" value="jornal" ${this.escopo === "jornal" ? "checked" : ""}> Jornal inteiro</label>
          ${page ? `<label><input type="radio" name="escopo" value="pagina" ${this.escopo === "pagina" ? "checked" : ""}> Só a página <b>${esc(page.name)}</b></label>` : ""}
        </div>
        <div class="mjs-botoes">
          <button type="button" data-action="remover"><i class="fas fa-eraser"></i> Sem tema</button>
          <button type="submit"><i class="fas fa-check"></i> Aplicar</button>
        </div>
      </footer>
    </div>`;
  }

  _replaceHTML(result, content) {
    const scroll = content.querySelector(".mjs-grade")?.scrollTop ?? 0;
    content.innerHTML = result;
    const grade = content.querySelector(".mjs-grade");
    if (grade) grade.scrollTop = scroll;
  }

  _onRender() {
    // Trocar uma variante redesenha a amostra do tema escolhido na hora.
    this.element.querySelectorAll(".mjs-opcoes select, .mjs-opcoes input, .mjs-escopo input").forEach((el) => el.addEventListener("change", () => { this.#ler(); this.render(); }));
  }

  #ler() {
    const f = this.element.elements;
    const def = TEMAS.find((t) => t.id === this.rascunho.tema);
    this.rascunho.classes = (def?.grupos ?? []).map((g, i) => f[`g${i}`]?.value ?? "").filter(Boolean);
    this.rascunho.semTitulo = !!f.semTitulo?.checked;
    this.escopo = f.escopo?.value ?? [...(f.escopo ?? [])].find?.((x) => x.checked)?.value ?? "jornal";
  }

  async #salvar(valor) {
    if (this.escopo === "pagina" && this.pageId) {
      const page = this.journal.pages.get(this.pageId);
      if (valor) await page.setFlag(ID, "tema", valor);
      else await page.setFlag(ID, "tema", { tema: "nenhum" });
    } else if (valor) {
      await this.journal.setFlag(ID, "tema", valor);
    } else {
      await this.journal.unsetFlag(ID, "tema");
      // Sem tema no jornal: também limpa as páginas que só herdavam.
      for (const p of this.journal.pages) if (p.getFlag(ID, "tema")?.tema === "nenhum") await p.unsetFlag(ID, "tema");
    }
  }

  static #escolher(ev, el) {
    this.#ler();
    if (this.rascunho.tema !== el.dataset.tema) { this.rascunho.tema = el.dataset.tema; this.rascunho.classes = []; }
    this.render();
  }

  static async #aplicar() {
    this.#ler();
    await this.#salvar({ ...this.rascunho });
  }

  static async #remover() {
    this.#ler();
    await this.#salvar(null);
    this.close();
  }
}
